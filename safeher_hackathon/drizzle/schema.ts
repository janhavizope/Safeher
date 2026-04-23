import { integer, json, numeric, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const incidentTypeEnum = pgEnum("incidentType", [
  "harassment",
  "assault",
  "stalking",
  "theft",
  "unsafe_area",
  "other",
]);
export const severityEnum = pgEnum("severity", ["low", "medium", "high", "critical"]);
export const statusEnum = pgEnum("status", ["pending", "verified", "resolved", "dismissed"]);

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull().$onUpdateFn(() => new Date()),
  lastSignedIn: timestamp("lastSignedIn", { mode: "date" }).defaultNow().notNull(),
  isVolunteer: integer("isVolunteer").default(0).notNull(), // 0: no, 1: yes
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Incidents table for storing anonymous safety reports.
 * All personal data is anonymized; only location and incident details are stored.
 */
export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
  latitude: numeric("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: numeric("longitude", { precision: 11, scale: 8 }).notNull(),
  incidentType: incidentTypeEnum("incidentType").notNull(),
  severity: severityEnum("severity").notNull(),
  description: text("description").notNull(),
  mediaUrls: json("mediaUrls").$type<string[]>(),
  reportedAt: timestamp("reportedAt", { mode: "date" }).notNull(),
  submittedAt: timestamp("submittedAt", { mode: "date" }).defaultNow().notNull(),
  ipHash: varchar("ipHash", { length: 64 }).notNull(),
  status: statusEnum("status").default("pending").notNull(),
  adminNotes: text("adminNotes"),
  llmClassification: json("llmClassification").$type<{
    type: string;
    severity: string;
    confidence: number;
  }>(),
  evidenceScore: integer("evidenceScore").default(0),
  trackingPin: varchar("trackingPin", { length: 10 }),
  reporterAlias: text("reporterAlias"),
});

export const alertSubscriptions = pgTable("alertSubscriptions", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 8 }).notNull(),
  radiusKm: numeric("radiusKm", { precision: 5, scale: 2 }).notNull().default("5.00"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Audit logs for moderator actions.
 */
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  incidentId: integer("incidentId"),
  actorName: varchar("actorName", { length: 255 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  details: text("details"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = typeof incidents.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Media attachments table for tracking uploaded files.
 */
export const mediaAttachments = pgTable("media_attachments", {
  id: serial("id").primaryKey(),
  incidentId: integer("incidentId").notNull(),
  s3Key: varchar("s3Key", { length: 255 }).notNull(),
  s3Url: varchar("s3Url", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 50 }).notNull(),
  fileSize: integer("fileSize").notNull(),
  uploadedAt: timestamp("uploadedAt", { mode: "date" }).defaultNow().notNull(),
});

export type MediaAttachment = typeof mediaAttachments.$inferSelect;
export type InsertMediaAttachment = typeof mediaAttachments.$inferInsert;

/**
 * Rate limit log table for tracking submission attempts.
 */
export const rateLimitLog = pgTable("rate_limit_log", {
  id: serial("id").primaryKey(),
  ipHash: varchar("ipHash", { length: 64 }).notNull(),
  attemptedAt: timestamp("attemptedAt", { mode: "date" }).defaultNow().notNull(),
  endpoint: varchar("endpoint", { length: 100 }).notNull(),
});

/**
 * Live sessions for SafeWalk feature.
 */
export const safeWalkSessions = pgTable("safe_walk_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id),
  secretToken: varchar("secretToken", { length: 16 }).notNull().unique(),
  currentLat: numeric("currentLat", { precision: 10, scale: 8 }).notNull(),
  currentLng: numeric("currentLng", { precision: 11, scale: 8 }).notNull(),
  destinationLat: numeric("destinationLat", { precision: 10, scale: 8 }),
  destinationLng: numeric("destinationLng", { precision: 11, scale: 8 }),
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, reached, emergency
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

/**
 * Community support group posts.
 */
export const communityPosts = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  authorAlias: text("authorAlias").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});