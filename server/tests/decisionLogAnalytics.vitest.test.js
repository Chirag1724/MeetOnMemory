import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

const mockFind = vi.fn();
const mockFindByIdAndUpdate = vi.fn();
const mockFindById = vi.fn();
const mockFindByIdAndDelete = vi.fn();
const mockAggregate = vi.fn();

vi.mock("../models/decisionLogEntryModel.js", () => ({
  default: {
    find: (...args) => mockFind(...args),
    findByIdAndUpdate: (...args) => mockFindByIdAndUpdate(...args),
    findById: (...args) => mockFindById(...args),
    findByIdAndDelete: (...args) => mockFindByIdAndDelete(...args),
    aggregate: (...args) => mockAggregate(...args),
  },
}));

vi.mock("../models/decisionModel.js", () => ({
  default: {
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

const { default: decisionLogService } =
  await import("../services/decisionLogService.js");
const { getDecisionAnalytics } =
  await import("../controllers/decisionLogController.js");

describe("Decision Log Analytics Suite (#2440)", () => {
  const orgId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("decisionLogService.getDecisionAnalytics", () => {
    it("should aggregate live decision metrics accurately", async () => {
      const mockEntries = [
        {
          _id: new mongoose.Types.ObjectId(),
          outcome: "implemented",
          tags: ["Architecture", "Backend"],
          impactAssessment: "High performance impact",
          createdAt: new Date("2026-06-01"),
          updatedAt: new Date("2026-06-08"),
          meetingId: { date: new Date("2026-05-28") },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          outcome: "pending",
          tags: ["Policy"],
          impactAssessment: "Medium compliance impact",
          createdAt: new Date("2026-06-15"),
          updatedAt: new Date("2026-06-15"),
          meetingId: { date: new Date("2026-06-10") },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          outcome: "reversed",
          tags: ["Tooling"],
          impactAssessment: "Low risk",
          createdAt: new Date("2026-07-01"),
          updatedAt: new Date("2026-07-02"),
          meetingId: { date: new Date("2026-06-30") },
        },
      ];

      mockFind.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        then: (resolve) => resolve(mockEntries),
      });

      const analytics = await decisionLogService.getDecisionAnalytics(orgId, {
        outcome: "all",
      });

      expect(analytics.stats.totalDecisions).toBe(3);
      expect(analytics.stats.implementedCount).toBe(1);
      expect(analytics.stats.pendingCount).toBe(1);
      expect(analytics.stats.reversedCount).toBe(1);
      expect(analytics.stats.implementationRate).toBeCloseTo(33.3, 0);
      expect(analytics.stats.avgDaysToDecide).toBeGreaterThan(0);
      expect(analytics.stats.avgDaysToImplement).toBeGreaterThan(0);
      expect(analytics.categoryData.length).toBeGreaterThan(0);
      expect(analytics.recommendations.length).toBeGreaterThan(0);
    });

    it("should handle empty decision log records gracefully without zero division error", async () => {
      mockFind.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        then: (resolve) => resolve([]),
      });

      const analytics = await decisionLogService.getDecisionAnalytics(orgId);

      expect(analytics.stats.totalDecisions).toBe(0);
      expect(analytics.stats.implementedCount).toBe(0);
      expect(analytics.stats.implementationRate).toBe(0);
      expect(analytics.categoryData).toEqual([]);
      expect(analytics.trend).toEqual([]);
      expect(analytics.recommendations).toBeDefined();
    });
  });

  describe("getDecisionAnalytics Controller", () => {
    it("should respond with 200 and analytics payload for valid request", async () => {
      const mockResult = {
        stats: { totalDecisions: 5, implementedCount: 3 },
        trend: [],
        categoryData: [],
      };
      vi.spyOn(decisionLogService, "getDecisionAnalytics").mockResolvedValue(
        mockResult,
      );

      const req = {
        organization: { _id: orgId },
        query: { status: "all" },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await getDecisionAnalytics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          stats: expect.objectContaining({ totalDecisions: 5 }),
        }),
      );
    });

    it("should handle service errors with 500 status", async () => {
      vi.spyOn(decisionLogService, "getDecisionAnalytics").mockRejectedValue(
        new Error("Database failure"),
      );

      const req = {
        organization: { _id: orgId },
        query: {},
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await getDecisionAnalytics(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Failed to fetch decision analytics",
        }),
      );
    });
  });
});
