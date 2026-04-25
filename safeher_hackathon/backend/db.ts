import { eq, desc, and, gte, lte, like, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "node:path";
import { promises as fs } from "node:fs";
import { InsertUser, users, incidents, InsertIncident, Incident, rateLimitLog, mediaAttachments, alertSubscriptions, auditLogs, InsertAuditLog, AuditLog, safeWalkSessions, communityPosts } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _dbPool: Pool | null = null;
let _dbInitPromise: Promise<ReturnType<typeof drizzle> | null> | null = null;

type IncidentRecord = Incident;
type MediaAttachmentRecord = {
  id: number;
  incidentId: number;
  s3Key: string;
  s3Url: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: Date;
};
type RateLimitLogRecord = {
  id: number;
  ipHash: string;
  endpoint: string;
  attemptedAt: Date;
};

type CommunityPostRecord = {
  id: number;
  authorAlias: string;
  category: string;
  content: string;
  createdAt: Date;
  mediaUrls?: CommunityMediaRecord[];
};

type CommunityMediaRecord = {
  key: string;
  url: string;
  mimeType: string;
  fileSize: number;
};

const localStore = {
  incidents: [] as IncidentRecord[],
  mediaAttachments: [] as MediaAttachmentRecord[],
  rateLimitLog: [] as RateLimitLogRecord[],
  nextIncidentId: 1,
  nextAttachmentId: 1,
  nextRateLimitId: 1,
  subscriptions: [] as any[],
  auditLogs: [] as AuditLog[],
  nextAuditId: 1,
  safeWalkSessions: [] as any[],
  communityPosts: [] as CommunityPostRecord[],
  communityPostMedia: {} as Record<number, CommunityMediaRecord[]>,
  nextCommunityPostId: 1,
};

const LOCAL_STORE_FILE = path.resolve(process.cwd(), ".local-incidents.json");
let _localStoreLoaded = false;

async function ensureLocalIncidentStoreLoaded(): Promise<void> {
  if (_localStoreLoaded) return;
  _localStoreLoaded = true;

  try {
    const raw = await fs.readFile(LOCAL_STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as {
      incidents?: IncidentRecord[];
      nextIncidentId?: number;
    };

    if (Array.isArray(parsed.incidents)) {
      localStore.incidents = parsed.incidents.map(item => ({
        ...item,
        reportedAt: new Date(item.reportedAt as any),
        submittedAt: new Date(item.submittedAt as any),
      }));
    }

    if (typeof parsed.nextIncidentId === "number" && parsed.nextIncidentId > 0) {
      localStore.nextIncidentId = parsed.nextIncidentId;
    } else {
      const maxId = localStore.incidents.reduce((max, incident) => Math.max(max, Number(incident.id) || 0), 0);
      localStore.nextIncidentId = maxId + 1;
    }
  } catch {
    // First run or invalid file: keep defaults.
  }
}

async function persistLocalIncidentStore(): Promise<void> {
  try {
    const payload = {
      incidents: localStore.incidents,
      nextIncidentId: localStore.nextIncidentId,
    };
    await fs.writeFile(LOCAL_STORE_FILE, JSON.stringify(payload, null, 2), "utf8");
  } catch (error) {
    console.warn("[Database] Failed to persist local incident store:", error);
  }
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "object" && value !== null && "toString" in value) {
    const parsed = Number((value as { toString: () => string }).toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => String(item));
  }
  return [];
}

function appendStatusHistoryEvent(
  existingNotes: string | null | undefined,
  status: 'verified' | 'resolved' | 'dismissed',
  actorName?: string,
  note?: string
): string {
  const eventPayload = {
    at: new Date().toISOString(),
    actor: actorName?.trim() || "Moderator",
    status,
    note: note?.trim() || null,
  };

  const eventLine = `[STATUS_EVENT] ${JSON.stringify(eventPayload)}`;
  const base = existingNotes?.trim();
  return base ? `${base}\n${eventLine}` : eventLine;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (_db) {
    return _db;
  }

  if (!process.env.DATABASE_URL) {
    await ensureLocalIncidentStoreLoaded();
    return null;
  }

  if (!_dbInitPromise) {
    _dbInitPromise = (async () => {
      try {
        const connectionUrl = new URL(process.env.DATABASE_URL!);
        connectionUrl.searchParams.delete("sslmode");

        const pool = new Pool({
          connectionString: connectionUrl.toString(),
          ssl: { rejectUnauthorized: false },
        });

        const db = drizzle(pool);
        try {
          await migrate(db, {
            migrationsFolder: path.resolve(process.cwd(), "drizzle_pg"),
          });
          console.log("[Database] Migration successful");
        } catch (migError) {
          console.warn("[Database] Migration skipped or failed (schema might already exist):", migError instanceof Error ? migError.message : migError);
        }

        _dbPool = pool;
        _db = db;
        return db;
      } catch (error) {
        console.warn("[Database] Failed to connect or migrate:", error);
        if (_dbPool) {
          await _dbPool.end().catch(() => undefined);
          _dbPool = null;
        }
        _db = null;
        return null;
      } finally {
        _dbInitPromise = null;
      }
    })();
  }

  return _dbInitPromise;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// Incident Database Helpers
// ============================================================================

/**
 * Create a new incident report
 */
export async function createIncident(data: InsertIncident): Promise<Incident | null> {
  const db = await getDb();
  if (!db) {
    const created: IncidentRecord = {
      id: localStore.nextIncidentId++,
      latitude: String(data.latitude ?? "0") as any,
      longitude: String(data.longitude ?? "0") as any,
      incidentType: (data.incidentType ?? "other") as any,
      severity: (data.severity ?? "medium") as any,
      description: data.description ?? "",
      mediaUrls: parseJsonArray(data.mediaUrls),
      reportedAt: data.reportedAt ?? new Date(),
      submittedAt: data.submittedAt ?? new Date(),
      ipHash: data.ipHash ?? "",
      status: (data.status ?? "pending") as any,
      adminNotes: (data.adminNotes as any) ?? null,
      llmClassification: (data.llmClassification as any) ?? null,
      trackingPin: (data.trackingPin as any) ?? null,
      reporterAlias: (data.reporterAlias as any) ?? null,
      evidenceScore: 0,
    };

    // Calculate evidence score for local store
    let score = 0;
    if (created.mediaUrls && created.mediaUrls.length > 0) score += 50;
    if (created.llmClassification?.confidence) {
      score += Math.round(created.llmClassification.confidence * 50);
    }
    created.evidenceScore = score;

    localStore.incidents.push(created);
    await persistLocalIncidentStore();
    return created;
  }

  try {
    // Calculate evidence score
    let score = 0;
    if (data.mediaUrls && (data.mediaUrls as string[]).length > 0) score += 50;
    
    // Check if llmClassification is provided and has confidence
    const classification = data.llmClassification as any;
    if (classification && classification.confidence) {
      score += Math.round(classification.confidence * 50);
    }
    
    const dataWithScore = { ...data, evidenceScore: score };
    const created = await db.insert(incidents).values(dataWithScore as any).returning();
    return created.length > 0 ? created[0] : null;
  } catch (error) {
    console.warn("[Database] Failed to create incident in PostgreSQL, using local fallback:", error);

    const created: IncidentRecord = {
      id: localStore.nextIncidentId++,
      latitude: String(data.latitude ?? "0") as any,
      longitude: String(data.longitude ?? "0") as any,
      incidentType: (data.incidentType ?? "other") as any,
      severity: (data.severity ?? "medium") as any,
      description: data.description ?? "",
      mediaUrls: parseJsonArray(data.mediaUrls),
      reportedAt: data.reportedAt ?? new Date(),
      submittedAt: data.submittedAt ?? new Date(),
      ipHash: data.ipHash ?? "",
      status: (data.status ?? "pending") as any,
      adminNotes: (data.adminNotes as any) ?? null,
      llmClassification: (data.llmClassification as any) ?? null,
      trackingPin: (data.trackingPin as any) ?? null,
      reporterAlias: (data.reporterAlias as any) ?? null,
      evidenceScore: 0,
    };

    localStore.incidents.push(created);
    await persistLocalIncidentStore();
    return created;
  }
}

/**
 * Persist uploaded media metadata for an incident.
 */
export async function createMediaAttachments(
  incidentId: number,
  attachments: Array<{
    s3Key: string;
    s3Url: string;
    mimeType: string;
    fileSize: number;
  }>
): Promise<void> {
  const db = await getDb();
  if (attachments.length === 0) {
    return;
  }

  if (!db) {
    attachments.forEach(item => {
      localStore.mediaAttachments.push({
        id: localStore.nextAttachmentId++,
        incidentId,
        s3Key: item.s3Key,
        s3Url: item.s3Url,
        mimeType: item.mimeType,
        fileSize: item.fileSize,
        uploadedAt: new Date(),
      });
    });
    return;
  }

  try {
    await db.insert(mediaAttachments).values(
      attachments.map(item => ({
        incidentId,
        s3Key: item.s3Key,
        s3Url: item.s3Url,
        mimeType: item.mimeType,
        fileSize: item.fileSize,
        uploadedAt: new Date(),
      }))
    );
  } catch (error) {
    console.error("[Database] Failed to create media attachments:", error);
    throw error;
  }
}

/**
 * Get incidents by geographic bounds and filters
 */
export async function getIncidentsByBounds(
  bounds?: { north: number; south: number; east: number; west: number },
  types?: string[],
  dateRange?: { start: Date; end: Date },
  limit: number = 100
) {
  const db = await getDb();
  if (!db) {
    let result = [...localStore.incidents];

    if (bounds) {
      result = result.filter(incident => {
        const lat = toNumber(incident.latitude);
        const lng = toNumber(incident.longitude);
        return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
      });
    }

    if (types && types.length > 0) {
      const typeSet = new Set(types);
      result = result.filter(incident => typeSet.has(incident.incidentType));
    }

    // Only return verified incidents for public maps
    result = result.filter(incident => incident.status === 'verified');

    if (dateRange) {
      result = result.filter(incident => {
        const at = new Date(incident.reportedAt).getTime();
        return at >= dateRange.start.getTime() && at <= dateRange.end.getTime();
      });
    }

    return result
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .slice(0, limit);
  }

  try {
    const conditions: any[] = [];

    if (bounds) {
      conditions.push(
        and(
          gte(incidents.latitude, bounds.south as any),
          lte(incidents.latitude, bounds.north as any),
          gte(incidents.longitude, bounds.west as any),
          lte(incidents.longitude, bounds.east as any)
        )
      );
    }

    if (types && types.length > 0) {
      conditions.push(inArray(incidents.incidentType, types as any));
    }

    // Only return verified incidents for public maps
    conditions.push(eq(incidents.status, 'verified'));

    if (dateRange) {
      conditions.push(
        and(
          gte(incidents.reportedAt, dateRange.start),
          lte(incidents.reportedAt, dateRange.end)
        )
      );
    }

    let query: any = db.select().from(incidents);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query
      .orderBy(desc(incidents.submittedAt))
      .limit(limit);

    return result;
  } catch (error) {
    console.error("[Database] Failed to get incidents by bounds:", error);
    throw error;
  }
}

/**
 * Get heatmap data (aggregated incident counts by location)
 */
export async function getHeatmapData(
  bounds?: { north: number; south: number; east: number; west: number },
  daysBack: number = 30
) {
  const db = await getDb();
  if (!db) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    return localStore.incidents.filter(incident => {
      if (incident.status !== 'verified') return false;
      const submittedAt = new Date(incident.submittedAt).getTime();
      if (submittedAt < startDate.getTime()) return false;
      if (!bounds) return true;

      const lat = toNumber(incident.latitude);
      const lng = toNumber(incident.longitude);
      return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
    });
  }

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const conditions: any[] = [
      gte(incidents.submittedAt, startDate),
      eq(incidents.status, 'verified')
    ];

    if (bounds) {
      conditions.push(
        and(
          gte(incidents.latitude, bounds.south as any),
          lte(incidents.latitude, bounds.north as any),
          gte(incidents.longitude, bounds.west as any),
          lte(incidents.longitude, bounds.east as any)
        )
      );
    }

    let query: any = db.select().from(incidents);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query;
    return result;
  } catch (error) {
    console.error("[Database] Failed to get heatmap data:", error);
    throw error;
  }
}

/**
 * Get all incidents for admin dashboard with filtering
 */
export async function getAdminIncidents(
  page: number = 1,
  limit: number = 20,
  filters?: {
    types?: string[];
    severity?: string[];
    status?: string[];
    dateRange?: { start: Date; end: Date };
  },
  search?: string,
  sortBy: 'submitted' | 'severity' | 'type' = 'submitted'
) {
  const db = await getDb();
  if (!db) {
    let result = [...localStore.incidents];

    if (filters?.types && filters.types.length > 0) {
      const set = new Set(filters.types);
      result = result.filter(incident => set.has(incident.incidentType));
    }

    if (filters?.severity && filters.severity.length > 0) {
      const set = new Set(filters.severity);
      result = result.filter(incident => set.has(incident.severity));
    }

    if (filters?.status && filters.status.length > 0) {
      const set = new Set(filters.status);
      result = result.filter(incident => set.has(incident.status));
    }

    if (filters?.dateRange) {
      result = result.filter(incident => {
        const at = new Date(incident.submittedAt).getTime();
        return at >= filters.dateRange!.start.getTime() && at <= filters.dateRange!.end.getTime();
      });
    }

    if (search) {
      const queryText = search.toLowerCase();
      result = result.filter(incident => incident.description.toLowerCase().includes(queryText));
    }

    if (sortBy === "severity") {
      const rank: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
      result.sort((a, b) => (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0));
    } else if (sortBy === "type") {
      result.sort((a, b) => a.incidentType.localeCompare(b.incidentType));
    } else {
      result.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    }

    const total = result.length;
    const offset = (page - 1) * limit;
    return {
      incidents: result.slice(offset, offset + limit),
      total,
    };
  }

  try {
    const conditions: any[] = [];

    if (filters?.types && filters.types.length > 0) {
      conditions.push(inArray(incidents.incidentType, filters.types as any));
    }

    if (filters?.severity && filters.severity.length > 0) {
      conditions.push(inArray(incidents.severity, filters.severity as any));
    }

    if (filters?.status && filters.status.length > 0) {
      conditions.push(inArray(incidents.status, filters.status as any));
    }

    if (filters?.dateRange) {
      conditions.push(
        and(
          gte(incidents.submittedAt, filters.dateRange.start),
          lte(incidents.submittedAt, filters.dateRange.end)
        )
      );
    }

    if (search) {
      conditions.push(like(incidents.description, `%${search}%`));
    }

    let query: any = db.select().from(incidents);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Sort
    if (sortBy === 'severity') {
      query = query.orderBy(desc(incidents.severity));
    } else if (sortBy === 'type') {
      query = query.orderBy(incidents.incidentType);
    } else {
      query = query.orderBy(desc(incidents.submittedAt));
    }

    // Get total count
    const countResult = await query;
    const total = countResult.length;

    // Paginate
    const offset = (page - 1) * limit;
    const result = await query.limit(limit).offset(offset);

    return { incidents: result, total };
  } catch (error) {
    console.error("[Database] Failed to get admin incidents:", error);
    throw error;
  }
}

/**
 * Get incident statistics
 */
export async function getIncidentStatistics(verifiedOnly: boolean = false) {
  const db = await getDb();
  if (!db) {
    const allIncidents = localStore.incidents;
    const stats = {
      totalIncidents: allIncidents.length,
      incidentsByType: {} as Record<string, number>,
      incidentsBySeverity: {} as Record<string, number>,
      incidentsByDate: {} as Record<string, number>,
      highSeverityCount: 0,
      pendingCount: 0,
    };

    allIncidents.forEach((incident) => {
      if (verifiedOnly && incident.status !== 'verified') return;
      
      stats.incidentsByType[incident.incidentType] = (stats.incidentsByType[incident.incidentType] || 0) + 1;
      stats.incidentsBySeverity[incident.severity] = (stats.incidentsBySeverity[incident.severity] || 0) + 1;
      if (incident.severity === "high" || incident.severity === "critical") {
        stats.highSeverityCount++;
      }
      if (incident.status === "pending") {
        stats.pendingCount++;
      }
      const dateKey = new Date(incident.submittedAt).toISOString().split("T")[0];
      stats.incidentsByDate[dateKey] = (stats.incidentsByDate[dateKey] || 0) + 1;
    });

    return stats;
  }

  try {
    const allIncidents = await db.select().from(incidents);

    const stats = {
      totalIncidents: allIncidents.length,
      incidentsByType: {} as Record<string, number>,
      incidentsBySeverity: {} as Record<string, number>,
      incidentsByDate: {} as Record<string, number>,
      highSeverityCount: 0,
      pendingCount: 0,
    };

    allIncidents.forEach((incident) => {
      if (verifiedOnly && incident.status !== 'verified') return;

      // By type
      stats.incidentsByType[incident.incidentType] = (stats.incidentsByType[incident.incidentType] || 0) + 1;

      // By severity
      stats.incidentsBySeverity[incident.severity] = (stats.incidentsBySeverity[incident.severity] || 0) + 1;

      // High severity
      if (incident.severity === 'high' || incident.severity === 'critical') {
        stats.highSeverityCount++;
      }

      // Pending
      if (incident.status === 'pending') {
        stats.pendingCount++;
      }

      // By date
      const dateKey = new Date(incident.submittedAt).toISOString().split('T')[0];
      stats.incidentsByDate[dateKey] = (stats.incidentsByDate[dateKey] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error("[Database] Failed to get statistics:", error);
    throw error;
  }
}

/**
 * Update incident status and notes
 */
export async function updateIncidentStatus(
  incidentId: number,
  status: 'verified' | 'resolved' | 'dismissed',
  notes?: string,
  actorName?: string
) {
  const db = await getDb();
  if (!db) {
    const target = localStore.incidents.find(item => item.id === incidentId);
    if (!target) return null;
    target.status = status as any;
    target.adminNotes = appendStatusHistoryEvent(target.adminNotes, status, actorName, notes);
    await persistLocalIncidentStore();
    
    await createAuditLog({
      incidentId,
      actorName: actorName || "Moderator",
      action: "status_update",
      details: `Changed status to ${status}. Note: ${notes || "None"}`,
    });

    return target;
  }

  try {
    const existing = await db.select().from(incidents).where(eq(incidents.id, incidentId)).limit(1);
    if (existing.length === 0) {
      return null;
    }

    const updateData: any = {
      status,
      adminNotes: appendStatusHistoryEvent(existing[0].adminNotes, status, actorName, notes),
    };

    await db.update(incidents).set(updateData).where(eq(incidents.id, incidentId));
    
    await createAuditLog({
      incidentId,
      actorName: actorName || "Moderator",
      action: "status_update",
      details: `Changed status to ${status} from ${existing[0].status}. Note: ${notes || "None"}`,
    });

    const updated = await db.select().from(incidents).where(eq(incidents.id, incidentId)).limit(1);
    return updated.length > 0 ? updated[0] : null;
  } catch (error) {
    console.error("[Database] Failed to update incident:", error);
    throw error;
  }
}

/**
 * Update incident details (description, location)
 */
export async function updateIncidentDetails(
  incidentId: number,
  data: { description?: string; latitude?: number; longitude?: number; status?: 'pending' | 'verified' | 'resolved' | 'dismissed' }
) {
  const db = await getDb();
  if (!db) {
    const target = localStore.incidents.find(item => item.id === incidentId);
    if (!target) return null;
    if (data.description !== undefined) target.description = data.description;
    if (data.latitude !== undefined) target.latitude = String(data.latitude) as any;
    if (data.longitude !== undefined) target.longitude = String(data.longitude) as any;
    if (data.status !== undefined) target.status = data.status;
    await persistLocalIncidentStore();

    await createAuditLog({
      incidentId,
      actorName: "Moderator",
      action: "details_edit",
      details: `Updated incident details: ${JSON.stringify(data)}`,
    });

    return target;
  }

  try {
    const updateData: any = {};
    if (data.description !== undefined) updateData.description = data.description;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;
    if (data.status !== undefined) updateData.status = data.status;

    if (Object.keys(updateData).length > 0) {
      await db.update(incidents).set(updateData).where(eq(incidents.id, incidentId));
      
      await createAuditLog({
        incidentId,
        actorName: "Moderator",
        action: "details_edit",
        details: `Updated incident details: ${Object.keys(updateData).join(", ")}`,
      });
    }

    const updated = await db.select().from(incidents).where(eq(incidents.id, incidentId)).limit(1);
    return updated.length > 0 ? updated[0] : null;
  } catch (error) {
    console.error("[Database] Failed to update incident details:", error);
    throw error;
  }
}

/**
 * Get incident by tracking PIN
 */
export async function getIncidentByPin(pin: string) {
  const db = await getDb();
  if (!db) {
    return localStore.incidents.find(item => item.trackingPin === pin) || null;
  }
  
  try {
    const result = await db.select().from(incidents)
      .where(eq(incidents.trackingPin, pin))
      .limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get incident by pin:", error);
    throw error;
  }
}

// ============================================================================
// Geofenced Alerts Helpers
// ============================================================================

export function computeDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function createSubscription(email: string, lat: number, lng: number, radiusKm: number) {
  const db = await getDb();
  if (!db) {
     localStore.subscriptions.push({ id: Date.now(), email, latitude: lat, longitude: lng, radiusKm });
     return true;
  }
  
  try {
    await db.insert(alertSubscriptions).values({
      email,
      latitude: lat.toString() as any,
      longitude: lng.toString() as any,
      radiusKm: radiusKm.toString() as any,
    });
    return true;
  } catch (error) {
    console.error("[Database] Failed to create subscription:", error);
    throw error;
  }
}

export async function getOverlappingSubscriptions(lat: number, lng: number) {
  const db = await getDb();
  let subs = [];
  if (!db) {
    subs = localStore.subscriptions;
  } else {
    try {
      subs = await db.select().from(alertSubscriptions);
    } catch(e) {
      console.warn("Failed to select alertSubscriptions", e);
      subs = [];
    }
  }

  // Filter in memory 
  return subs.filter((s: any) => {
    const sLat = parseFloat(s.latitude.toString());
    const sLng = parseFloat(s.longitude.toString());
    const rad = parseFloat(s.radiusKm.toString());
    const dist = computeDistanceKm(lat, lng, sLat, sLng);
    return dist <= rad;
  });
}

// ============================================================================
// Rate Limiting Helpers
// ============================================================================

/**
 * Check if IP has exceeded rate limit
 */
export async function checkRateLimit(ipHash: string, endpoint: string = 'incidents.submit'): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  const db = await getDb();
  if (!db) {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const matching = localStore.rateLimitLog.filter(
      attempt => attempt.ipHash === ipHash && attempt.endpoint === endpoint
    );
    const hourlyAttempts = matching.filter(attempt => attempt.attemptedAt.getTime() >= oneHourAgo);
    const dailyAttempts = matching.filter(attempt => attempt.attemptedAt.getTime() >= oneDayAgo);
    return hourlyAttempts.length >= 5 || dailyAttempts.length >= 20;
  }

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const hourlyAttempts = await db
      .select()
      .from(rateLimitLog)
      .where(
        and(
          eq(rateLimitLog.ipHash, ipHash),
          eq(rateLimitLog.endpoint, endpoint),
          gte(rateLimitLog.attemptedAt, oneHourAgo)
        )
      );

    const dailyAttempts = await db
      .select()
      .from(rateLimitLog)
      .where(
        and(
          eq(rateLimitLog.ipHash, ipHash),
          eq(rateLimitLog.endpoint, endpoint),
          gte(rateLimitLog.attemptedAt, oneDayAgo)
        )
      );

    // Max 5 per hour, 20 per day
    return hourlyAttempts.length >= 5 || dailyAttempts.length >= 20;
  } catch (error) {
    console.error("[Database] Failed to check rate limit:", error);
    return false; // Allow if error
  }
}

/**
 * Log a submission attempt for rate limiting
 */
export async function logSubmissionAttempt(ipHash: string, endpoint: string = 'incidents.submit'): Promise<void> {
  const db = await getDb();
  if (!db) {
    localStore.rateLimitLog.push({
      id: localStore.nextRateLimitId++,
      ipHash,
      endpoint,
      attemptedAt: new Date(),
    });
    return;
  }

  try {
    await db.insert(rateLimitLog).values({
      ipHash,
      endpoint,
      attemptedAt: new Date(),
    });
  } catch (error) {
    console.error("[Database] Failed to log attempt:", error);
    // Don't throw - rate limiting shouldn't break the app
  }
}

/**
 * Clean up old rate limit logs (older than 7 days)
 */
export async function cleanupOldRateLimitLogs(): Promise<void> {
  const db = await getDb();
  if (!db) {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    localStore.rateLimitLog = localStore.rateLimitLog.filter(
      entry => entry.attemptedAt.getTime() >= sevenDaysAgo
    );
    return;
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await db.delete(rateLimitLog).where(lte(rateLimitLog.attemptedAt, sevenDaysAgo));
  } catch (error) {
    console.error("[Database] Failed to cleanup rate limit logs:", error);
  }
}

// ============================================================================
// Moderator Audit Helpers
// ============================================================================

export async function createAuditLog(data: InsertAuditLog): Promise<void> {
  const db = await getDb();
  if (!db) {
    localStore.auditLogs.push({
      id: localStore.nextAuditId++,
      incidentId: data.incidentId ?? null,
      actorName: data.actorName,
      action: data.action,
      details: data.details ?? null,
      createdAt: new Date(),
    });
    return;
  }

  try {
    await db.insert(auditLogs).values(data);
  } catch (error) {
    console.error("[Database] Failed to create audit log:", error);
  }
}

export async function getAuditLogs(search?: string, limit: number = 50) {
  const db = await getDb();
  if (!db) {
    let result = [...localStore.auditLogs];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(log => 
        log.actorName.toLowerCase().includes(q) || 
        (log.details?.toLowerCase().includes(q) ?? false) ||
        log.action.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  }

  try {
    let query: any = db.select().from(auditLogs);
    if (search) {
      query = query.where(like(auditLogs.details, `%${search}%`));
    }
    return await query.orderBy(desc(auditLogs.createdAt)).limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get audit logs:", error);
    return [];
  }
}

// ============================================================================
// Bulk Actions Helpers
// ============================================================================

export async function bulkUpdateIncidentStatus(
  incidentIds: number[],
  status: 'verified' | 'resolved' | 'dismissed',
  notes?: string,
  actorName?: string
) {
  const db = await getDb();
  if (!db) {
    const updated = [];
    for (const id of incidentIds) {
      const incident = localStore.incidents.find(i => i.id === id);
      if (incident) {
        incident.status = status as any;
        incident.adminNotes = appendStatusHistoryEvent(incident.adminNotes, status, actorName, notes);
        updated.push(incident);
      }
    }
    await persistLocalIncidentStore();
    
    await createAuditLog({
      actorName: actorName || "Moderator",
      action: "bulk_status_update",
      details: `Bulk updated ${incidentIds.length} incidents to ${status}. IDs: ${incidentIds.join(", ")}`,
    });
    
    return updated;
  }

  try {
    const existing = await db.select().from(incidents).where(inArray(incidents.id, incidentIds));
    
    for (const incident of existing) {
       await db.update(incidents).set({
         status,
         adminNotes: appendStatusHistoryEvent(incident.adminNotes, status, actorName, notes),
       }).where(eq(incidents.id, incident.id));
    }

    await createAuditLog({
      actorName: actorName || "Moderator",
      action: "bulk_status_update",
      details: `Bulk updated ${incidentIds.length} incidents to ${status}. Note: ${notes || "None"}`,
    });

    return await db.select().from(incidents).where(inArray(incidents.id, incidentIds));
  } catch (error) {
    console.error("[Database] Failed bulk status update:", error);
    throw error;
  }
}
/**
 * Update a user's volunteer status
 */
export async function updateVolunteerStatus(userId: number, isVolunteer: boolean) {
  const db = await getDb();
  if (!db) {
    // Local store not supported for users yet
    return;
  }
  await db.update(users).set({ isVolunteer: isVolunteer ? 1 : 0 }).where(eq(users.id, userId));
}

/**
 * Get active volunteers nearby.
 */
export async function getNearbyVolunteers(lat: number, lng: number, radiusKm: number = 5) {
  const db = await getDb();
  if (!db) return [];
  
  // For hackathon, just return all volunteers in the system since we don't have real live location yet
  const result = await db.select().from(users).where(eq(users.isVolunteer, 1));
  return result;
}

/**
 * Create a SafeWalk session
 */
export async function createSafeWalkSession(userId: number | null, startLat: number, startLng: number, destLat?: number, destLng?: number) {
  const db = await getDb();
  const secretToken = Math.random().toString(36).substring(2, 10).toUpperCase() + Math.random().toString(36).substring(2, 10).toUpperCase();
  
  const data = {
    userId,
    secretToken,
    currentLat: startLat.toString() as any,
    currentLng: startLng.toString() as any,
    destinationLat: destLat?.toString() as any,
    destinationLng: destLng?.toString() as any,
    status: "active",
  };

  if (!db) {
     const session = { ...data, id: Date.now(), createdAt: new Date(), updatedAt: new Date() };
     localStore.safeWalkSessions.push(session);
     return session;
  }
  
  const result = await db.insert(safeWalkSessions).values(data as any).returning();
  return result.length > 0 ? result[0] : null;
}

/**
 * Update SafeWalk location
 */
export async function updateSafeWalkLocation(token: string, lat: number, lng: number, status?: string) {
  const db = await getDb();
  if (!db) {
    const session = localStore.safeWalkSessions.find(s => s.secretToken === token);
    if (session) {
      session.currentLat = lat.toString();
      session.currentLng = lng.toString();
      if (status) session.status = status;
      session.updatedAt = new Date();
    }
    return;
  }
  const updateData: any = {
    currentLat: lat.toString() as any,
    currentLng: lng.toString() as any,
    updatedAt: new Date()
  };
  if (status) updateData.status = status;

  await db.update(safeWalkSessions).set(updateData).where(eq(safeWalkSessions.secretToken, token));
}

/**
 * Get SafeWalk by token
 */
export async function getSafeWalkByToken(token: string) {
  const db = await getDb();
  if (!db) {
    return localStore.safeWalkSessions.find(s => s.secretToken === token) || null;
  }
  const result = await db.select().from(safeWalkSessions).where(eq(safeWalkSessions.secretToken, token)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Create a community post
 */
export async function createCommunityPost(
  authorAlias: string,
  category: string,
  content: string,
  mediaUrls: CommunityMediaRecord[] = [],
) {
  const db = await getDb();
  if (!db) {
    const created: CommunityPostRecord = {
      id: localStore.nextCommunityPostId++,
      authorAlias,
      category,
      content,
      createdAt: new Date(),
      mediaUrls,
    };
    localStore.communityPosts.unshift(created);
    return created;
  }

  try {
    const result = await db
      .insert(communityPosts)
      .values({
        authorAlias,
        category,
        content,
        mediaUrls,
      } as any)
      .returning();
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    try {
      const retry = await db.insert(communityPosts).values({ authorAlias, category, content }).returning();
      const created = retry.length > 0 ? retry[0] : null;
      if (created && mediaUrls.length > 0) {
        localStore.communityPostMedia[created.id] = mediaUrls;
        return {
          ...created,
          mediaUrls,
        };
      }
      return created;
    } catch (retryError) {
      console.warn("[Database] community_posts insert failed, using local fallback:", retryError || error);
      const created: CommunityPostRecord = {
        id: localStore.nextCommunityPostId++,
        authorAlias,
        category,
        content,
        createdAt: new Date(),
        mediaUrls,
      };
      localStore.communityPosts.unshift(created);
      return created;
    }
  }
}

/**
 * Get community posts
 */
export async function getCommunityPosts(limit: number = 50) {
  const db = await getDb();
  if (!db) {
    return localStore.communityPosts
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  try {
    const rows = await db.select().from(communityPosts).orderBy(desc(communityPosts.createdAt)).limit(limit);
    return rows.map((row: any) => {
      const rowMedia = Array.isArray(row.mediaUrls) ? row.mediaUrls : [];
      const fallbackMedia = localStore.communityPostMedia[row.id] || [];
      return {
        ...row,
        mediaUrls: rowMedia.length > 0 ? rowMedia : fallbackMedia,
      };
    });
  } catch (error) {
    console.warn("[Database] community_posts query failed, using local fallback:", error);
    return localStore.communityPosts
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
