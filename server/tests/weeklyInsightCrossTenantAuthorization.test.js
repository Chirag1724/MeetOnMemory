/**
 * Issue #2571 — Weekly insight routes must never query with the `:orgId`
 * taken from the URL.
 *
 * Before the fix, `requireRole` proved the caller had *a* role and the
 * controller then queried `WeeklyInsight` with whatever organization id the
 * path carried, so any authenticated user could read another tenant's
 * insights (and, on `/generate`, run generation against its data).
 *
 * These tests exercise the real route + controller + model stack against an
 * in-memory MongoDB; only authentication is stubbed.
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";

let currentUser = null;

jest.unstable_mockModule("../middleware/userAuth.js", () => ({
  default: (req, res, next) => {
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    req.user = currentUser;
    next();
  },
}));

const generateInsightSpy = jest.fn();
jest.unstable_mockModule("../services/weeklyInsightService.js", () => ({
  generateInsight: (...args) => generateInsightSpy(...args),
}));

const sendNotificationEmailSpy = jest.fn();
jest.unstable_mockModule("../services/EmailService.js", () => ({
  default: {
    sendNotificationEmail: (...args) => sendNotificationEmailSpy(...args),
  },
}));

const { default: weeklyInsightRoutes } =
  await import("../routes/weeklyInsightRoutes.js");
const WeeklyInsight = (await import("../models/weeklyInsightModel.js")).default;
// getLatestInsight populates stalledActionItems.{actionItem,meetingId}; both
// schemas must be registered or the populate throws MissingSchemaError (500).
await import("../models/ActionItem.js");
await import("../models/meetingModel.js");

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();

const memberOfOrgA = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "admin",
};

const plainMemberOfOrgA = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "member",
};

const adminOfOrgB = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_B,
  role: "admin",
};

const userWithoutOrganization = {
  _id: new mongoose.Types.ObjectId(),
  organization: null,
  role: "admin",
};

let app;
let orgAInsight;

const buildInsight = (organization, summary) => ({
  organization,
  startDate: new Date("2026-01-01T00:00:00.000Z"),
  endDate: new Date("2026-01-07T00:00:00.000Z"),
  aiSummary: summary,
});

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(
      `${process.env.TEST_MONGODB_URI}/weekly_insight_2571`,
    );
  }

  app = express();
  app.use(express.json());
  app.use("/api/weekly-insights", weeklyInsightRoutes);
});

beforeEach(async () => {
  currentUser = memberOfOrgA;
  generateInsightSpy.mockReset();
  sendNotificationEmailSpy.mockReset();

  await WeeklyInsight.deleteMany({});
  await WeeklyInsight.create(buildInsight(ORG_A, "org A insight"));
  await WeeklyInsight.create(buildInsight(ORG_B, "org B insight"));
  orgAInsight = await WeeklyInsight.findOne({ organization: ORG_A });
});

describe("weekly insight cross-tenant scoping (#2571)", () => {
  describe("GET /api/weekly-insights/:orgId/latest", () => {
    it("returns the caller's own organization insight", async () => {
      const res = await request(app).get(
        `/api/weekly-insights/${ORG_A.toString()}/latest`,
      );

      expect(res.status).toBe(200);
      expect(res.body.aiSummary).toBe("org A insight");
    });

    it("rejects another organization's id with 403 and leaks nothing", async () => {
      const res = await request(app).get(
        `/api/weekly-insights/${ORG_B.toString()}/latest`,
      );

      expect(res.status).toBe(403);
      expect(res.body.aiSummary).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain("org B insight");
    });

    it("returns 400 for a malformed organization id", async () => {
      const res = await request(app).get(
        "/api/weekly-insights/not-an-id/latest",
      );

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/weekly-insights/:orgId", () => {
    it("returns only the caller's organization history", async () => {
      const res = await request(app).get(
        `/api/weekly-insights/${ORG_A.toString()}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.totalPages).toBe(1);
      expect(res.body.insights).toHaveLength(1);
      expect(res.body.insights[0].aiSummary).toBe("org A insight");
    });

    it("rejects another organization's history with 403", async () => {
      const res = await request(app).get(
        `/api/weekly-insights/${ORG_B.toString()}`,
      );

      expect(res.status).toBe(403);
      expect(res.body.insights).toBeUndefined();
    });
  });

  describe("POST /api/weekly-insights/:orgId/generate", () => {
    it("generates for the caller's own organization only", async () => {
      generateInsightSpy.mockResolvedValue(orgAInsight);

      const res = await request(app).post(
        `/api/weekly-insights/${ORG_A.toString()}/generate`,
      );

      expect(res.status).toBe(201);
      expect(generateInsightSpy).toHaveBeenCalledTimes(1);
      expect(String(generateInsightSpy.mock.calls[0][0])).toBe(
        ORG_A.toString(),
      );
    });

    it("never runs generation against another tenant's data", async () => {
      const res = await request(app).post(
        `/api/weekly-insights/${ORG_B.toString()}/generate`,
      );

      expect(res.status).toBe(403);
      expect(generateInsightSpy).not.toHaveBeenCalled();
    });

    it("still enforces the role requirement", async () => {
      currentUser = plainMemberOfOrgA;

      const res = await request(app).post(
        `/api/weekly-insights/${ORG_A.toString()}/generate`,
      );

      expect(res.status).toBe(403);
      expect(generateInsightSpy).not.toHaveBeenCalled();
    });
  });

  describe("share / email", () => {
    it("rejects sharing an insight through another organization's path", async () => {
      const res = await request(app).post(
        `/api/weekly-insights/${ORG_B.toString()}/insights/${orgAInsight._id.toString()}/share`,
      );

      expect(res.status).toBe(403);
      expect(res.body.shareLink).toBeUndefined();
    });

    it("rejects emailing through another organization's path", async () => {
      const res = await request(app).post(
        `/api/weekly-insights/${ORG_B.toString()}/insights/${orgAInsight._id.toString()}/email`,
      );

      expect(res.status).toBe(403);
      expect(sendNotificationEmailSpy).not.toHaveBeenCalled();
    });

    it("shares the caller's own insight", async () => {
      const res = await request(app).post(
        `/api/weekly-insights/${ORG_A.toString()}/insights/${orgAInsight._id.toString()}/share`,
      );

      expect(res.status).toBe(200);
      expect(res.body.shareLink).toContain(ORG_A.toString());
    });
  });

  describe("membership", () => {
    it("rejects a caller without an organization", async () => {
      currentUser = userWithoutOrganization;

      const res = await request(app).get(
        `/api/weekly-insights/${ORG_A.toString()}/latest`,
      );

      expect(res.status).toBe(403);
    });

    it("keeps org B's data invisible to an org B admin querying org A", async () => {
      currentUser = adminOfOrgB;

      const res = await request(app).get(
        `/api/weekly-insights/${ORG_A.toString()}/latest`,
      );

      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain("org A insight");
    });
  });
});
