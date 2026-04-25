import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  bulkUpdateIncidentStatus,
  getAuditLogs,
  createAuditLog,
  updateVolunteerStatus,
  getNearbyVolunteers,
  createSafeWalkSession,
  updateSafeWalkLocation,
  getSafeWalkByToken,
  createCommunityPost,
  getCommunityPosts,
  checkRateLimit,
  logSubmissionAttempt,
  createIncident,
  createMediaAttachments,
  getIncidentsByBounds,
  getHeatmapData,
  getIncidentByPin,
  getIncidentStatistics,
  createSubscription,
  getAdminIncidents,
  updateIncidentStatus,
  getOverlappingSubscriptions,
  updateIncidentDetails,
} from "./db";
import { broadcastIncidentEvent } from "./_core/incidentEvents";
import { notifyOwner } from "./_core/notification";
import { classifyIncident } from "./llmClassification";
import {
  generateRandomSuffix,
  getClientDeviceId,
  getClientIp,
  hashIp,
  isValidFileSize,
  isValidMediaType,
  sanitizeDescription,
} from "./security";
import { TRPCError } from "@trpc/server";
import { storagePut } from "./storage";

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

type StatusTimelineEntry = {
  at: string;
  actor: string;
  status: string;
  note: string | null;
};

function extractStatusTimeline(adminNotes: unknown): StatusTimelineEntry[] {
  if (typeof adminNotes !== "string" || !adminNotes.trim()) {
    return [];
  }

  const lines = adminNotes.split("\n");
  const timeline: StatusTimelineEntry[] = [];

  for (const line of lines) {
    if (!line.startsWith("[STATUS_EVENT] ")) continue;
    try {
      const jsonPart = line.slice("[STATUS_EVENT] ".length);
      const parsed = JSON.parse(jsonPart) as StatusTimelineEntry;
      if (!parsed?.at || !parsed?.status) continue;
      timeline.push(parsed);
    } catch {
      // Ignore malformed historical lines.
    }
  }

  return timeline;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function uploadToLocalDisk(
  fileName: string,
  fileBuffer: Buffer,
  ctx: { req: any }
): Promise<{ key: string; url: string }> {
  const uploadDir = path.resolve(process.cwd(), ".uploads");
  await fs.mkdir(uploadDir, { recursive: true });

  const safeName = sanitizeFileName(fileName);
  const localName = `${Date.now()}_${generateRandomSuffix()}_${safeName}`;
  const absolutePath = path.join(uploadDir, localName);
  await fs.writeFile(absolutePath, fileBuffer);

  const host = ctx.req.headers.host;
  const protocol = ctx.req.protocol || "http";
  return {
    key: `local/${localName}`,
    url: `${protocol}://${host}/api/uploads/${localName}`,
  };
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  incidents: router({
    /**
     * Submit a new anonymous incident report
     */
    submit: publicProcedure
      .input(
        z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          description: z.string().min(10).max(5000),
          incidentType: z.enum(["harassment", "assault", "stalking", "theft", "unsafe_area", "other"]).optional(),
          severity: z.enum(["low", "medium", "high", "critical"]).optional(),
          reportedAt: z.coerce.date(),
          mediaUrls: z.array(z.string().min(1)).optional(),
          reporterAlias: z.string().max(100).optional(),
          media: z
            .array(
              z.object({
                key: z.string().min(1),
                url: z.string().min(1),
                mimeType: z.string().min(1),
                fileSize: z.number().int().positive(),
              })
            )
            .optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          // Get client IP and hash it
          const clientIp = getClientIp(ctx.req);
          const ipHash = hashIp(clientIp);

          // Check rate limit
          const isRateLimited = await checkRateLimit(ipHash);
          if (isRateLimited) {
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message: "Too many submissions. Please try again later.",
            });
          }

          // Log the submission attempt
          await logSubmissionAttempt(ipHash);

          // Sanitize description
          const sanitized = sanitizeDescription(input.description);

          // Classify the incident if type/severity not provided
          let classification = null;
          let finalType = input.incidentType || "other";
          let finalSeverity = input.severity || "medium";

          if (!input.incidentType || !input.severity) {
            classification = await classifyIncident(sanitized);
            finalType = input.incidentType || classification.type;
            finalSeverity = input.severity || classification.severity;
          }

          // Create the incident
          const mediaUrls =
            input.mediaUrls && input.mediaUrls.length > 0
              ? input.mediaUrls
              : input.media?.map(item => item.url) ?? [];

          const trackingPin = Math.random().toString(36).substring(2, 8).toUpperCase();

          const incident = await createIncident({
            latitude: input.latitude.toString() as any,
            longitude: input.longitude.toString() as any,
            incidentType: finalType as any,
            severity: finalSeverity as any,
            description: sanitized,
            mediaUrls,
            reportedAt: input.reportedAt,
            submittedAt: new Date(),
            ipHash,
            status: "pending",
            llmClassification: classification ? (classification as any) : null,
            trackingPin,
            reporterAlias: input.reporterAlias?.trim() || null,
          });

          if (!incident) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create incident",
            });
          }

          if (input.media && input.media.length > 0) {
            await createMediaAttachments(
              incident.id,
              input.media.map(item => ({
                s3Key: item.key,
                s3Url: item.url,
                mimeType: item.mimeType,
                fileSize: item.fileSize,
              }))
            );
          }

          broadcastIncidentEvent({
            type: "submitted",
            incidentId: incident.id,
            status: "pending",
          });

          // Notify admin if high severity
          if (finalSeverity === "high" || finalSeverity === "critical") {
            try {
              await notifyOwner({
                title: `🚨 High-Severity Incident Reported: ${finalType}`,
                content: `A ${finalSeverity} incident has been reported.\n\nType: ${finalType}\nLocation: ${input.latitude.toFixed(4)}, ${input.longitude.toFixed(4)}\nTime: ${new Date(input.reportedAt).toLocaleString()}\n\nCheck the admin dashboard for details.`,
              });
            } catch (error) {
              console.error("Failed to notify owner:", error);
              // Don't fail the submission if notification fails
            }
          }

          return {
            success: true,
            incidentId: incident.id,
            trackingPin,
            message: "Incident reported successfully. Thank you for helping keep our community safe.",
          };
        } catch (error) {
          if (error instanceof TRPCError) {
            throw error;
          }
          console.error("[Incidents.submit] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to submit incident",
          });
        }
      }),

    uploadMedia: publicProcedure
      .input(
        z.object({
          fileName: z.string().min(1).max(200),
          mimeType: z.string().min(1).max(100),
          fileSize: z.number().int().positive(),
          contentBase64: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!isValidMediaType(input.mimeType)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Unsupported media type",
          });
        }

        if (!isValidFileSize(input.fileSize, MAX_UPLOAD_SIZE_BYTES)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "File size exceeds 10MB limit",
          });
        }

        try {
          const safeFileName = sanitizeFileName(input.fileName);
          const key = `incidents/${Date.now()}_${generateRandomSuffix()}_${safeFileName}`;
          const fileBuffer = Buffer.from(input.contentBase64, "base64");

          let uploaded: { key: string; url: string };
          try {
            uploaded = await storagePut(key, fileBuffer, input.mimeType);
          } catch (error) {
            console.warn("[Incidents.uploadMedia] Cloud storage unavailable, using local upload fallback.", error);
            uploaded = await uploadToLocalDisk(input.fileName, fileBuffer, ctx);
          }

          return {
            key: uploaded.key,
            url: uploaded.url,
            mimeType: input.mimeType,
            fileSize: input.fileSize,
          };
        } catch (error) {
          console.error("[Incidents.uploadMedia] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to upload media",
          });
        }
      }),

    /**
     * Get incidents for map visualization (public, anonymized)
     */
    list: publicProcedure
      .input(
        z.object({
          bounds: z
            .object({
              north: z.number(),
              south: z.number(),
              east: z.number(),
              west: z.number(),
            })
            .optional(),
          types: z.array(z.string()).optional(),
          dateRange: z
            .object({
              start: z.date(),
              end: z.date(),
            })
            .optional(),
          limit: z.number().min(1).max(500).default(100),
        })
      )
      .query(async ({ input }) => {
        try {
          const incidents = await getIncidentsByBounds(
            input.bounds,
            input.types,
            input.dateRange,
            input.limit
          );

          return {
            incidents: incidents.map((i: any) => ({
              id: i.id,
              latitude: parseFloat(i.latitude.toString()),
              longitude: parseFloat(i.longitude.toString()),
              incidentType: i.incidentType,
              severity: i.severity,
              reportedAt: i.reportedAt,
              submittedAt: i.submittedAt,
              mediaUrls: Array.isArray(i.mediaUrls) ? i.mediaUrls : [],
            })),
          };
        } catch (error) {
          console.error("[Incidents.list] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch incidents",
          });
        }
      }),

    /**
     * Get heatmap data for visualization
     */
    heatmapData: publicProcedure
      .input(
        z.object({
          bounds: z
            .object({
              north: z.number(),
              south: z.number(),
              east: z.number(),
              west: z.number(),
            })
            .optional(),
          daysBack: z.number().min(1).max(365).default(30),
        })
      )
      .query(async ({ input }) => {
        try {
          const data = await getHeatmapData(input.bounds, input.daysBack);

          return {
            heatmapPoints: data.map((i: any) => ({
              latitude: parseFloat(i.latitude.toString()),
              longitude: parseFloat(i.longitude.toString()),
              // Weight by severity
              weight: i.severity === "critical" ? 4 : i.severity === "high" ? 3 : i.severity === "medium" ? 2 : 1,
            })),
          };
        } catch (error) {
          console.error("[Incidents.heatmapData] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch heatmap data",
          });
        }
      }),

    /**
     * Track the status of a reported incident securely via its PIN
     */
    trackStatus: publicProcedure
      .input(
        z.object({
          pin: z.string().min(6).max(10),
        })
      )
      .query(async ({ input }) => {
        try {
          const incident = await getIncidentByPin(input.pin.toUpperCase());
          if (!incident) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Invalid Tracking PIN or incident not found.",
            });
          }
          const timeline = extractStatusTimeline(incident.adminNotes);
          const latestNote = timeline.length > 0 ? timeline[timeline.length - 1].note : null;

          return {
            success: true,
            incidentType: incident.incidentType,
            severity: incident.severity,
            status: incident.status,
            adminNotes: incident.adminNotes,
            latestNote,
            statusTimeline: timeline,
            reportedAt: incident.reportedAt,
            submittedAt: incident.submittedAt,
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[Incidents.trackStatus] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to track incident",
          });
        }
      }),

    /**
     * Get aggregate statistics for public dashboard
     */
    stats: publicProcedure.query(async () => {
      try {
        const stats = await getIncidentStatistics(true);
        return {
          totalIncidents: stats.totalIncidents,
          highSeverityCount: stats.highSeverityCount,
          // Only share counts, no sensitive details
        };
      } catch (error) {
        console.error("[Incidents.stats] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch stats",
        });
      }
    }),

    /**
     * Subscribe to safety alerts within a location radius
     */
    subscribeToAlerts: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          latitude: z.number(),
          longitude: z.number(),
          radiusKm: z.number().min(1).max(50).default(5),
        })
      )
      .mutation(async ({ input }) => {
        try {
          await createSubscription(input.email, input.latitude, input.longitude, input.radiusKm);
          return { success: true, message: "Successfully subscribed to alerts in this area." };
        } catch (error) {
          console.error("[Incidents.subscribe] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create subscription",
          });
        }
      }),
  }),

  admin: router({
    /**
     * Get all incidents for admin dashboard
     */
    incidents: publicProcedure
      .input(
        z.object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20),
          filters: z
            .object({
              types: z.array(z.string()).optional(),
              severity: z.array(z.string()).optional(),
              status: z.array(z.string()).optional(),
              dateRange: z
                .object({
                  start: z.date(),
                  end: z.date(),
                })
                .optional(),
            })
            .optional(),
          search: z.string().optional(),
          sortBy: z.enum(["submitted", "severity", "type"]).default("submitted"),
        })
      )
      .query(async ({ input }) => {
        try {
          const result = await getAdminIncidents(
            input.page,
            input.limit,
            input.filters,
            input.search,
            input.sortBy
          );

          return {
            incidents: result.incidents.map((i: any) => ({
              id: i.id,
              latitude: parseFloat(i.latitude.toString()),
              longitude: parseFloat(i.longitude.toString()),
              incidentType: i.incidentType,
              severity: i.severity,
              description: i.description,
              reportedAt: i.reportedAt,
              submittedAt: i.submittedAt,
              status: i.status,
              adminNotes: i.adminNotes,
              reporterAlias: i.reporterAlias,
              evidenceScore: i.evidenceScore || 0,
              mediaUrls: Array.isArray(i.mediaUrls) ? i.mediaUrls : [],
            })),
            total: result.total,
            page: input.page,
          };
        } catch (error) {
          console.error("[Admin.incidents] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch incidents",
          });
        }
      }),

    /**
     * Get incident statistics
     */
    statistics: publicProcedure.query(async () => {
      try {
        const stats = await getIncidentStatistics();
        return stats;
      } catch (error) {
        console.error("[Admin.statistics] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch statistics",
        });
      }
    }),

    /**
     * Update incident status
     */
    updateStatus: publicProcedure
      .input(
        z.object({
          incidentId: z.number(),
          status: z.enum(["verified", "resolved", "dismissed"]),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const actorName = ctx.user?.name || ctx.user?.openId || "Moderator";
          const updated = await updateIncidentStatus(input.incidentId, input.status, input.notes, actorName);
          if (!updated) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Incident not found",
            });
          }

          // Trigger geofence alerts if verified and critical/high
          if (input.status === "verified" && (updated.severity === "high" || updated.severity === "critical")) {
            const overlaps = await getOverlappingSubscriptions(
              parseFloat(updated.latitude.toString()), 
              parseFloat(updated.longitude.toString())
            );
            if (overlaps.length > 0) {
              await notifyOwner({
                title: "SafeHer Geofence Alert Triggered",
                content: `A ${updated.severity} severity incident was just verified! We are mass-alerting ${overlaps.length} subscribed users in the affected radius.\n\nType: ${updated.incidentType}\nLocation: ${updated.latitude}, ${updated.longitude}`
              });
            }
          }

          broadcastIncidentEvent({
            type: "status-updated",
            incidentId: updated.id,
            status: updated.status,
          });

          return { success: true };
        } catch (error) {
          if (error instanceof TRPCError) {
            throw error;
          }
          console.error("[Admin.updateStatus] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update incident",
          });
        }
      }),

    /**
     * Admin capability to edit sensitive details of an incident
     */
    editIncident: publicProcedure
      .input(
        z.object({
          incidentId: z.number(),
          description: z.string().optional(),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const updated = await updateIncidentDetails(input.incidentId, {
            description: input.description,
            latitude: input.latitude,
            longitude: input.longitude,
          });
          
          if (!updated) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Incident not found",
            });
          }

          broadcastIncidentEvent({
            type: "details-updated",
            incidentId: updated.id,
            status: updated.status,
          });

          return { success: true };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[Admin.editIncident] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to edit incident details",
          });
        }
      }),

    /**
     * Bulk update incident statuses
     */
    bulkUpdateStatus: publicProcedure
      .input(
        z.object({
          incidentIds: z.array(z.number()),
          status: z.enum(["verified", "resolved", "dismissed"]),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const actorName = ctx.user?.name || ctx.user?.openId || "Moderator";
          const updated = await bulkUpdateIncidentStatus(
            input.incidentIds,
            input.status,
            input.notes,
            actorName
          );

          // Broadcast events for each updated incident
          updated.forEach((i: any) => {
            broadcastIncidentEvent({
              type: "status-updated",
              incidentId: i.id,
              status: i.status,
            });
          });

          return { success: true, count: updated.length };
        } catch (error) {
          console.error("[Admin.bulkUpdateStatus] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to bulk update incidents",
          });
        }
      }),

    /**
     * Get moderator audit logs
     */
    auditLogs: publicProcedure
      .input(
        z.object({
          search: z.string().optional(),
          limit: z.number().min(1).max(200).default(50),
        })
      )
      .query(async ({ input }) => {
        try {
          const logs = await getAuditLogs(input.search, input.limit);
          return { logs };
        } catch (error) {
          console.error("[Admin.auditLogs] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch audit logs",
          });
        }
      }),
  }),

  safety: router({
    toggleVolunteer: publicProcedure
      .input(z.object({ isVolunteer: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await updateVolunteerStatus(ctx.user.id, input.isVolunteer);
        return { success: true };
      }),

    getNearbyVolunteers: publicProcedure
      .input(z.object({ lat: z.number(), lng: z.number() }))
      .query(async ({ input }) => {
        const volunteers = await getNearbyVolunteers(input.lat, input.lng);
        return {
          volunteers: volunteers.map(v => ({
            id: v.id,
            name: v.name || "Guardian",
            // Accurate dots for trust but obscured identity if needed (can add later)
          }))
        };
      }),

    startSafeWalk: publicProcedure
      .input(z.object({ 
        startLat: z.number(), 
        startLng: z.number(), 
        destLat: z.number().optional(), 
        destLng: z.number().optional() 
      }))
      .mutation(async ({ input, ctx }) => {
        const session = await createSafeWalkSession(
          ctx.user?.id || null,
          input.startLat,
          input.startLng,
          input.destLat,
          input.destLng
        );
        return session;
      }),

    updateWalk: publicProcedure
      .input(z.object({ 
        token: z.string(), 
        lat: z.number(), 
        lng: z.number(),
        status: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        await updateSafeWalkLocation(input.token, input.lat, input.lng, input.status);
        return { success: true };
      }),

    getPublicWalk: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const session = await getSafeWalkByToken(input.token);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        return session;
      }),
  }),

  community: router({
    createPost: publicProcedure
      .input(z.object({ 
        authorAlias: z.string().max(100).optional(), 
        category: z.string(), 
        content: z.string().min(1),
        media: z
          .array(
            z.object({
              key: z.string().min(1),
              url: z.string().min(1),
              mimeType: z.string().min(1),
              fileSize: z.number().int().positive(),
            })
          )
          .max(4)
          .optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const deviceId = getClientDeviceId(ctx.req);
        if (!deviceId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only verified users can post in Sisterhood Hub.",
          });
        }

        const normalizedAlias = input.authorAlias?.trim() || `Anonymous Sister ${Math.floor(1000 + Math.random() * 9000)}`;
        const post = await createCommunityPost(normalizedAlias, input.category, input.content, input.media ?? []);
        return post;
      }),

    list: publicProcedure.query(async () => {
      const posts = await getCommunityPosts();
      return { posts };
    }),
  }),
});

export type AppRouter = typeof appRouter;
