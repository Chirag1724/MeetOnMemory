import mongoose from "mongoose";
import { jest } from "@jest/globals";
import { initCalendarSyncCron } from "../services/calendarSyncService.js";

// Mock external services
jest.mock("../services/calendarService.js", () => {
  return {
    __esModule: true,
    default: jest.fn(),
    createGoogleEvent: jest.fn().mockResolvedValue("mock-google-id"),
    createMicrosoftEvent: jest.fn().mockResolvedValue("mock-microsoft-id"),
    getGoogleOAuthClient: jest.fn(),
    decryptToken: jest.fn((token) => token),
    encryptToken: jest.fn((token) => token),
  };
});

jest.mock("../utils/embeddingUtils.js", () => ({
  indexMeeting: jest.fn().mockResolvedValue(true),
  deleteMeetingFromPinecone: jest.fn().mockResolvedValue(true),
}));

jest.mock("../models/Webhook.js", () => ({
  __esModule: true,
  default: {
    find: jest.fn().mockResolvedValue([]),
    findByIdAndUpdate: jest.fn().mockResolvedValue(true),
  },
}));

const mockMeetingModel = {
  findByIdAndUpdate: jest.fn().mockResolvedValue(true),
  find: jest.fn().mockResolvedValue([]),
};
jest.mock("../models/meetingModel.js", () => ({
  __esModule: true,
  default: mockMeetingModel,
}));

jest.mock("../services/MeetingStorageService.js", () => ({
  createMeetingRecord: jest.fn().mockImplementation((data) => {
    return {
      ...data,
      _id: new mongoose.Types.ObjectId(),
      save: jest.fn().mockResolvedValue(true),
    };
  }),
  findMeetingById: jest.fn(),
}));

jest.mock("../models/calendarConnectionModel.js", () => ({
  __esModule: true,
  default: {
    find: jest.fn().mockResolvedValue([]),
  },
}));

describe("Meeting Lifecycle & Webhook Sync Integrations", () => {
  let mockOrgId;

  beforeAll(async () => {
    mockOrgId = new mongoose.Types.ObjectId();

    // We import webhookDispatcherService to register the eventBus listeners
    await import("../services/webhookDispatcherService.js");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Webhook Dispatcher Service Utility", () => {
    it("should safely generate a valid HMAC signature", async () => {
      const { generateSignature } =
        await import("../services/webhookDispatcherService.js");
      const payload = { event: "meeting.created", data: { id: "123" } };
      const secret = "test_secret_12345";
      const timestamp = new Date().toISOString();

      const signature = generateSignature(payload, timestamp, secret);

      expect(typeof signature).toBe("string");
      expect(signature).toHaveLength(64); // SHA-256 hex length
    });

    it("should handle string payload when generating signature", async () => {
      const { generateSignature } =
        await import("../services/webhookDispatcherService.js");
      const payload = "plain_string_payload";
      const secret = "test_secret_12345";
      const timestamp = new Date().toISOString();

      const signature = generateSignature(payload, timestamp, secret);

      expect(typeof signature).toBe("string");
      expect(signature).toHaveLength(64); // SHA-256 hex length
    });
  });

  describe("MeetingService buildDuplicateMeetingData", () => {
    it("should build duplicate data from a given meeting object", async () => {
      const { buildDuplicateMeetingData } =
        await import("../services/MeetingService.js");
      const mockMeeting = {
        _id: new mongoose.Types.ObjectId(),
        title: "Original Meeting",
        description: "Test desc",
        organization: mockOrgId,
        duration: 30,
        participants: [
          { name: "Alice", email: "alice@test.com", role: "host" },
        ],
      };

      const dupData = buildDuplicateMeetingData(mockMeeting);

      expect(dupData.title).toBe("Original Meeting (Copy)");
      expect(dupData.description).toBe("Test desc");
      expect(dupData.duration).toBe(30);
      expect(dupData.participants).toHaveLength(1);
      expect(dupData.participants[0].name).toBe("Alice");
    });

    it("should handle missing optional fields when building duplicate", async () => {
      const { buildDuplicateMeetingData } =
        await import("../services/MeetingService.js");
      const mockMeeting = {
        _id: new mongoose.Types.ObjectId(),
      };

      const dupData = buildDuplicateMeetingData(mockMeeting);

      expect(dupData.title).toBe("Untitled Meeting (Copy)");
      expect(dupData.description).toBe("");
      expect(dupData.duration).toBeNull();
      expect(dupData.participants).toEqual([]);
    });
  });

  describe("Calendar Sync Cron Error Resilience", () => {
    it("should not crash if token refresh throws an error", async () => {
      const CalendarConnection = (
        await import("../models/calendarConnectionModel.js")
      ).default;
      jest
        .spyOn(CalendarConnection, "find")
        .mockRejectedValue(new Error("Database connection failed"));

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const cronMock = await import("node-cron");
      let registeredTask = null;
      jest
        .spyOn(cronMock.default, "schedule")
        .mockImplementation((time, task) => {
          registeredTask = task;
        });

      initCalendarSyncCron();

      await registeredTask();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Cron job error:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });
});
