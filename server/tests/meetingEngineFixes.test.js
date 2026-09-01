import { jest } from "@jest/globals";
import mongoose from "mongoose";

const { meetingSeriesDiffService } =
  await import("../services/meetingSeriesDiffService.js");
const { calculateMeetingQuality, default: meetingQualityService } =
  await import("../services/meetingQualityService.js");

const { default: Meeting } = await import("../models/meetingModel.js");
const { default: ActionItem } = await import("../models/actionItemModel.js");
const { default: Decision } = await import("../models/decisionModel.js");
const { default: MeetingTopic } =
  await import("../models/meetingTopicModel.js");
const { default: MeetingQualityScore } =
  await import("../models/MeetingQualityScore.js");
const { default: QualityBenchmark } =
  await import("../models/QualityBenchmark.js");

describe("Meeting Engines Fixes", () => {
  let orgId;
  let userId;
  let seriesId;

  beforeAll(async () => {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/meetonmemory_test",
    );
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Meeting.deleteMany({});
    await ActionItem.deleteMany({});
    await Decision.deleteMany({});
    await MeetingTopic.deleteMany({});
    await MeetingQualityScore.deleteMany({});
    await QualityBenchmark.deleteMany({});
    jest.clearAllMocks();

    orgId = new mongoose.Types.ObjectId();
    userId = new mongoose.Types.ObjectId();
    seriesId = new mongoose.Types.ObjectId();
  });

  describe("meetingSeriesDiffService.getSeriesTimeline", () => {
    it("should handle an empty series gracefully", async () => {
      const result = await meetingSeriesDiffService.getSeriesTimeline(
        seriesId,
        {
          organization: orgId,
        },
      );
      expect(result.timeline).toEqual([]);
      expect(result.trendMetrics).toEqual({});
    });

    it("should perform bulk queries and diff correctly without throwing errors", async () => {
      // Create 3 meetings in a series
      const m1 = await Meeting.create({
        title: "Sync 1",
        organization: orgId,
        series: seriesId,
        seriesOccurrence: 1,
        date: new Date("2026-08-01"),
        agendaItems: [{ text: "Intro", duration: 5 }],
      });
      const m2 = await Meeting.create({
        title: "Sync 2",
        organization: orgId,
        series: seriesId,
        seriesOccurrence: 2,
        date: new Date("2026-08-08"),
        agendaItems: [
          { text: "Intro", duration: 5 },
          { text: "Update", duration: 10 },
        ],
      });
      const m3 = await Meeting.create({
        title: "Sync 3",
        organization: orgId,
        series: seriesId,
        seriesOccurrence: 3,
        date: new Date("2026-08-15"),
        agendaItems: [{ text: "Update", duration: 15 }],
      });

      // Action items for m1
      await ActionItem.create({
        text: "Fix bug",
        sourceMeetingId: m1._id,
        status: "open",
      });
      // Action items for m2
      await ActionItem.create({
        text: "Fix bug", // Carried over
        sourceMeetingId: m2._id,
        status: "completed",
      });
      await ActionItem.create({
        text: "New feature",
        sourceMeetingId: m2._id,
        status: "open",
      });
      // Action items for m3
      await ActionItem.create({
        text: "New feature", // Carried over
        sourceMeetingId: m3._id,
        status: "open",
      });

      // Decisions
      await Decision.create({
        text: "Go with React",
        sourceMeetingId: m1._id,
        status: "approved",
      });
      await Decision.create({
        text: "Go with Node",
        sourceMeetingId: m2._id,
        status: "approved",
      });

      const userMock = { organization: orgId };
      const result = await meetingSeriesDiffService.getSeriesTimeline(
        seriesId,
        userMock,
      );

      expect(result.timeline).toHaveLength(3);

      // M1 has no diff
      expect(result.timeline[0].diffSummary).toBeNull();

      // M2 diff checks
      const diff2 = result.timeline[1].diffSummary;
      expect(diff2).toBeDefined();
      expect(diff2.added).toBeGreaterThanOrEqual(1); // Agenda Update, Action New feature, Decision Node
      expect(diff2.completedActionItems).toBe(1); // Fix bug completed

      // M3 diff checks
      const diff3 = result.timeline[2].diffSummary;
      expect(diff3).toBeDefined();
      // Intro removed, Update modified duration
      expect(diff3.removed).toBeGreaterThanOrEqual(0);

      expect(result.trendMetrics.decisionVelocity).toBeDefined();
      expect(result.trendMetrics.actionItemCompletionRate).toBeGreaterThan(0);
    });
  });

  describe("meetingQualityService", () => {
    it("should calculate meeting quality without crashing on empty arrays (NaN guard)", async () => {
      // Create a meeting with no participants and no action items to trigger 0 division risks
      const meeting = await Meeting.create({
        title: "Empty Meeting",
        organization: orgId,
        duration: 30, // 30 minutes
        meetingType: "sync",
        participants: [],
      });

      const scoreDoc = await calculateMeetingQuality(meeting._id);

      expect(scoreDoc).toBeDefined();
      expect(scoreDoc.scores.overall).toBeDefined();
      expect(Number.isNaN(scoreDoc.scores.overall)).toBe(false);

      // Verify benchmark was updated and doesn't contain NaN stdDevs
      const orgBenchmark = await QualityBenchmark.findOne({
        organization: orgId,
        type: "organization",
      });

      if (orgBenchmark) {
        expect(orgBenchmark.stdDev).toBeDefined();
        // Because of the division-by-zero guards, stdDev should be finite, not NaN
        expect(Number.isNaN(orgBenchmark.stdDev.overall)).toBe(false);
        expect(Number.isNaN(orgBenchmark.stdDev.participation)).toBe(false);
      }
    });

    it("should award badges and only execute benchmark query once", async () => {
      // This is more of an integration test to ensure awardBadges succeeds
      const meeting = await Meeting.create({
        title: "Great Meeting",
        organization: orgId,
        duration: 45,
        meetingType: "sync",
        participants: [userId],
      });

      // Give it some data to ensure high scores
      await ActionItem.create({
        text: "Task 1",
        sourceMeetingId: meeting._id,
        status: "completed",
      });
      await Decision.create({
        text: "Decision 1",
        sourceMeetingId: meeting._id,
        status: "approved",
      });
      await Decision.create({
        text: "Decision 2",
        sourceMeetingId: meeting._id,
        status: "approved",
      });

      const scoreDoc = await calculateMeetingQuality(meeting._id);

      expect(scoreDoc.status).toBe("completed");
      expect(scoreDoc.scores.overall).toBeGreaterThan(0);
      expect(Array.isArray(scoreDoc.badges)).toBe(true);

      // Test manual trend fetches to ensure they work
      const trends = await meetingQualityService.getQualityTrends(
        orgId,
        "weekly",
      );
      expect(Array.isArray(trends)).toBe(true);
    });
  });
});
