// server/tests/audioAnalyticsService.test.js
import { analyzeMeeting } from "../services/audioAnalyticsService.js";
import Meeting from "../models/meetingModel.js";
import Transcript from "../models/transcriptModel.js";
import User from "../models/userModel.js";
import MeetingAnalytics from "../models/MeetingAnalytics.js";
import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";

jest.mock("../models/meetingModel.js");
jest.mock("../models/transcriptModel.js");
jest.mock("../models/userModel.js");
jest.mock("../models/MeetingAnalytics.js");
jest.mock("../models/decisionModel.js");
jest.mock("../models/actionItemModel.js");

describe("audioAnalyticsService.analyzeMeeting decision/action item counts (#2640)", () => {
  const meetingId = "507f1f77bcf86cd799439011";
  const speakerId = "507f1f77bcf86cd799439044";

  const meetingFixture = {
    _id: meetingId,
    organization: "507f1f77bcf86cd799439033",
    participants: [{ _id: speakerId }],
  };

  const transcriptFixture = {
    segments: [
      {
        speaker: speakerId,
        speakerName: "Jane Doe",
        timestamp: 0,
        duration: 10,
        text: "Let's decide on the roadmap.",
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    Meeting.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(meetingFixture),
    });

    Transcript.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue(transcriptFixture),
    });

    User.findById.mockResolvedValue(null);

    MeetingAnalytics.findOne.mockResolvedValue(null);
    MeetingAnalytics.mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue(true),
    }));
  });

  it("reflects real decision and action item counts when fixtures exist", async () => {
    Decision.countDocuments.mockResolvedValue(3);
    ActionItem.countDocuments.mockResolvedValue(2);

    const analytics = await analyzeMeeting(meetingId);

    expect(Decision.countDocuments).toHaveBeenCalledWith({
      sourceMeetingId: meetingId,
    });
    expect(ActionItem.countDocuments).toHaveBeenCalledWith({
      sourceMeetingId: meetingId,
    });
    expect(analytics.metrics.decisionCount).toBe(3);
    expect(analytics.metrics.actionItemCount).toBe(2);
    expect(analytics.metrics.decisionCount).not.toBe(0);
    expect(analytics.metrics.actionItemCount).not.toBe(0);
  });

  it("falls back to 0 and does not throw when a count query fails", async () => {
    Decision.countDocuments.mockRejectedValue(new Error("db down"));
    ActionItem.countDocuments.mockResolvedValue(1);

    const analytics = await analyzeMeeting(meetingId);

    expect(analytics.metrics.decisionCount).toBe(0);
    expect(analytics.metrics.actionItemCount).toBe(1);
  });
});