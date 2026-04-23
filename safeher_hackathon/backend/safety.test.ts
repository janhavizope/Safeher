import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  updateVolunteerStatus: vi.fn(),
  getNearbyVolunteers: vi.fn(),
  createSafeWalkSession: vi.fn(),
  updateSafeWalkLocation: vi.fn(),
  getSafeWalkByToken: vi.fn(),
  createCommunityPost: vi.fn(),
  getCommunityPosts: vi.fn(),
}));

function createMockContext(user: any = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {}, socket: {} } as any,
    res: {} as any,
  };
}

describe("Safety & Community Routers", () => {
  
  describe("safety.toggleVolunteer", () => {
    it("should allow a logged in user to toggle volunteer status", async () => {
      const { updateVolunteerStatus } = await import("./db");
      const caller = appRouter.createCaller(createMockContext({ id: 1, name: "Test User" }));
      
      await caller.safety.toggleVolunteer({ isVolunteer: true });
      expect(updateVolunteerStatus).toHaveBeenCalledWith(1, true);
    });
  });

  describe("safety.startSafeWalk", () => {
    it("should create a new safewalk session and return a token", async () => {
      const { createSafeWalkSession } = await import("./db");
      const caller = appRouter.createCaller(createMockContext({ id: 1 }));
      
      vi.mocked(createSafeWalkSession).mockResolvedValueOnce({
        id: 1,
        secretToken: "xyz-safe-token",
        status: "active",
        userId: 1,
        startLat: "19.0",
        startLng: "72.0",
        currentLat: "19.0",
        currentLng: "72.0",
        createdAt: new Date(),
      } as any);

      const result = await caller.safety.startSafeWalk({
        startLat: 19.0,
        startLng: 72.0
      });

      expect(result.secretToken).toBe("xyz-safe-token");
      expect(createSafeWalkSession).toHaveBeenCalled();
    });
  });

  describe("community.createPost", () => {
    it("should allow creating an anonymous post", async () => {
      const { createCommunityPost } = await import("./db");
      const caller = appRouter.createCaller(createMockContext());
      
      vi.mocked(createCommunityPost).mockResolvedValueOnce({
        id: 1,
        authorAlias: "BraveSister",
        category: "general",
        content: "Be safe everyone!",
        createdAt: new Date(),
      } as any);

      const result = await caller.community.createPost({
        authorAlias: "BraveSister",
        category: "general",
        content: "Be safe everyone!"
      });

      expect(result.authorAlias).toBe("BraveSister");
    });
  });

});
