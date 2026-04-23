import { describe, it, expect, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  createIncident: vi.fn(),
  createMediaAttachments: vi.fn(),
  getIncidentsByBounds: vi.fn(),
  getHeatmapData: vi.fn(),
  getAdminIncidents: vi.fn(),
  getIncidentStatistics: vi.fn(),
  updateIncidentStatus: vi.fn(),
  checkRateLimit: vi.fn(),
  logSubmissionAttempt: vi.fn(),
}));

// Mock LLM classification
vi.mock("./llmClassification", () => ({
  classifyIncident: vi.fn().mockResolvedValue({
    type: "harassment",
    severity: "medium",
    confidence: 0.85,
    reasoning: "Test classification",
  }),
}));

// Mock notification
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock security functions
vi.mock("./security", () => ({
  hashIp: vi.fn((ip) => `hashed_${ip}`),
  getClientIp: vi.fn(() => "192.168.1.1"),
  sanitizeDescription: vi.fn((desc) => desc),
  getClientDeviceId: vi.fn((req) => req?.headers?.["x-device-id"] ?? null),
  hashIdentifier: vi.fn((value) => `device_${value}`),
}));

function createMockContext(user: any = null): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {
        "x-device-id": "test-device-id-1234567890",
      },
      socket: { remoteAddress: "192.168.1.1" },
    } as any,
    res: {} as any,
  };
}

describe("Incidents Router", () => {
  describe("incidents.submit", () => {
    it("should submit a valid incident", async () => {
      const { createIncident } = await import("./db");
      const caller = appRouter.createCaller(createMockContext());

      vi.mocked(createIncident).mockResolvedValueOnce({
        id: 1,
        latitude: "37.7749",
        longitude: "-122.4194",
        incidentType: "harassment",
        severity: "medium",
        description: "Test incident",
        mediaUrls: [],
        reportedAt: new Date(),
        submittedAt: new Date(),
        ipHash: "hashed_192.168.1.1",
        status: "pending",
        adminNotes: null,
        llmClassification: null,
      });

      const result = await caller.incidents.submit({
        latitude: 37.7749,
        longitude: -122.4194,
        description: "This is a test incident that needs to be at least 10 characters",
        incidentType: "harassment",
        severity: "medium",
        reportedAt: new Date(),
      });

      expect(result.success).toBe(true);
      expect(result.incidentId).toBe(1);
      expect(result.message).toContain("successfully");
    });

    it("should reject incidents with short descriptions", async () => {
      const caller = appRouter.createCaller(createMockContext());

      await expect(
        caller.incidents.submit({
          latitude: 37.7749,
          longitude: -122.4194,
          description: "short",
          incidentType: "harassment",
          severity: "medium",
          reportedAt: new Date(),
        })
      ).rejects.toThrow();
    });

    it("should reject incidents with invalid coordinates", async () => {
      const caller = appRouter.createCaller(createMockContext());

      await expect(
        caller.incidents.submit({
          latitude: 91, // Invalid latitude
          longitude: -122.4194,
          description: "This is a test incident that needs to be at least 10 characters",
          incidentType: "harassment",
          severity: "medium",
          reportedAt: new Date(),
        })
      ).rejects.toThrow();
    });

    it("should respect rate limiting", async () => {
      const { checkRateLimit } = await import("./db");
      const caller = appRouter.createCaller(createMockContext());

      vi.mocked(checkRateLimit).mockResolvedValueOnce(true);

      await expect(
        caller.incidents.submit({
          latitude: 37.7749,
          longitude: -122.4194,
          description: "This is a test incident that needs to be at least 10 characters",
          incidentType: "harassment",
          severity: "medium",
          reportedAt: new Date(),
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should auto-classify incidents when type/severity not provided", async () => {
      const { createIncident } = await import("./db");
      const caller = appRouter.createCaller(createMockContext());

      vi.mocked(createIncident).mockResolvedValueOnce({
        id: 2,
        latitude: "37.7749",
        longitude: "-122.4194",
        incidentType: "harassment",
        severity: "medium",
        description: "Test incident for classification",
        mediaUrls: [],
        reportedAt: new Date(),
        submittedAt: new Date(),
        ipHash: "hashed_192.168.1.1",
        status: "pending",
        adminNotes: null,
        llmClassification: JSON.stringify({
          type: "harassment",
          severity: "medium",
          confidence: 0.85,
        }),
      });

      const result = await caller.incidents.submit({
        latitude: 37.7749,
        longitude: -122.4194,
        description: "This is a test incident that needs to be at least 10 characters",
        reportedAt: new Date(),
      });

      expect(result.success).toBe(true);
      expect(vi.mocked(createIncident)).toHaveBeenCalled();
    });
  });

  describe("incidents.list", () => {
    it("should return incidents", async () => {
      const { getIncidentsByBounds } = await import("./db");
      const caller = appRouter.createCaller(createMockContext());

      vi.mocked(getIncidentsByBounds).mockResolvedValueOnce([
        {
          id: 1,
          latitude: "37.7749",
          longitude: "-122.4194",
          incidentType: "harassment",
          severity: "medium",
          description: "Test incident",
          mediaUrls: [],
          reportedAt: new Date(),
          submittedAt: new Date(),
          ipHash: "hashed_192.168.1.1",
          status: "pending",
          adminNotes: null,
          llmClassification: null,
        },
      ]);

      const result = await caller.incidents.list({ limit: 100 });

      expect(result.incidents).toHaveLength(1);
      expect(result.incidents[0].incidentType).toBe("harassment");
    });

    it("should filter incidents by type", async () => {
      const { getIncidentsByBounds } = await import("./db");
      const caller = appRouter.createCaller(createMockContext());

      vi.mocked(getIncidentsByBounds).mockResolvedValueOnce([]);

      await caller.incidents.list({ types: ["assault"], limit: 100 });

      expect(vi.mocked(getIncidentsByBounds)).toHaveBeenCalledWith(
        undefined,
        ["assault"],
        undefined,
        100
      );
    });
  });

  describe("incidents.heatmapData", () => {
    it("should return heatmap data with weighted points", async () => {
      const { getHeatmapData } = await import("./db");
      const caller = appRouter.createCaller(createMockContext());

      vi.mocked(getHeatmapData).mockResolvedValueOnce([
        {
          id: 1,
          latitude: "37.7749",
          longitude: "-122.4194",
          incidentType: "harassment",
          severity: "critical",
          description: "Test incident",
          mediaUrls: [],
          reportedAt: new Date(),
          submittedAt: new Date(),
          ipHash: "hashed_192.168.1.1",
          status: "pending",
          adminNotes: null,
          llmClassification: null,
        },
      ]);

      const result = await caller.incidents.heatmapData({ daysBack: 30 });

      expect(result.heatmapPoints).toHaveLength(1);
      expect(result.heatmapPoints[0].weight).toBe(4); // Critical = 4
    });
  });

  describe("admin.incidents", () => {
    it("should reject non-admin users", async () => {
      const caller = appRouter.createCaller(createMockContext({ role: "user" }));

      await expect(caller.admin.incidents({ page: 1 })).rejects.toThrow(TRPCError);
    });

    it("should return incidents for admin users", async () => {
      const { getAdminIncidents } = await import("./db");
      const caller = appRouter.createCaller(
        createMockContext({ id: 1, role: "admin", openId: "admin-user" })
      );

      vi.mocked(getAdminIncidents).mockResolvedValueOnce({
        incidents: [
          {
            id: 1,
            latitude: "37.7749",
            longitude: "-122.4194",
            incidentType: "harassment",
            severity: "medium",
            description: "Test incident",
            mediaUrls: [],
            reportedAt: new Date(),
            submittedAt: new Date(),
            ipHash: "hashed_192.168.1.1",
            status: "pending",
            adminNotes: null,
            llmClassification: null,
          },
        ],
        total: 1,
      });

      const result = await caller.admin.incidents({ page: 1 });

      expect(result.incidents).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("admin.statistics", () => {
    it("should reject non-admin users", async () => {
      const caller = appRouter.createCaller(createMockContext({ role: "user" }));

      await expect(caller.admin.statistics()).rejects.toThrow(TRPCError);
    });

    it("should return statistics for admin users", async () => {
      const { getIncidentStatistics } = await import("./db");
      const caller = appRouter.createCaller(
        createMockContext({ id: 1, role: "admin", openId: "admin-user" })
      );

      vi.mocked(getIncidentStatistics).mockResolvedValueOnce({
        totalIncidents: 10,
        incidentsByType: { harassment: 5, assault: 3, other: 2 },
        incidentsBySeverity: { low: 2, medium: 5, high: 2, critical: 1 },
        incidentsByDate: { "2026-04-13": 3, "2026-04-12": 2 },
        highSeverityCount: 3,
        pendingCount: 5,
      });

      const result = await caller.admin.statistics();

      expect(result.totalIncidents).toBe(10);
      expect(result.highSeverityCount).toBe(3);
      expect(result.pendingCount).toBe(5);
    });
  });

  describe("admin.updateStatus", () => {
    it("should reject non-admin users", async () => {
      const caller = appRouter.createCaller(createMockContext({ role: "user" }));

      await expect(
        caller.admin.updateStatus({
          incidentId: 1,
          status: "verified",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should update incident status for admin users", async () => {
      const { updateIncidentStatus } = await import("./db");
      const caller = appRouter.createCaller(
        createMockContext({ id: 1, role: "admin", openId: "admin-user" })
      );

      vi.mocked(updateIncidentStatus).mockResolvedValueOnce({
        id: 1,
        latitude: "37.7749",
        longitude: "-122.4194",
        incidentType: "harassment",
        severity: "medium",
        description: "Test incident",
        mediaUrls: [],
        reportedAt: new Date(),
        submittedAt: new Date(),
        ipHash: "hashed_192.168.1.1",
        status: "verified",
        adminNotes: "Verified by admin",
        llmClassification: null,
      });

      const result = await caller.admin.updateStatus({
        incidentId: 1,
        status: "verified",
        notes: "Verified by admin",
      });

      expect(result.success).toBe(true);
      expect(vi.mocked(updateIncidentStatus)).toHaveBeenCalledWith(1, "verified", "Verified by admin");
    });
  });
});
