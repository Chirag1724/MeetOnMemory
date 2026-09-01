import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../models/meetingModel.js", () => {
  const MockMeeting = {
    findById: vi.fn(),
  };
  return { default: MockMeeting };
});

vi.mock("../services/EmailService.js", () => ({
  default: {
    dispatchBriefingAlerts: vi.fn().mockResolvedValue(),
    sendNotificationEmail: vi.fn().mockResolvedValue(),
  },
}));

const Meeting = (await import("../models/meetingModel.js")).default;
const EmailService = (await import("../services/EmailService.js")).default;
const {
  checkMeetingOrgAccess,
  generateBriefing,
  regenerateBriefing,
  shareBriefingWithParticipants,
  getBriefing,
} = await import("../controllers/preMeetingBriefingController.js");

describe("Pre-Meeting Briefing Controller Access Control Tests (IDOR Defense) (#2468)", () => {
  const orgA = "507f1f77bcf86cd799439011";
  const orgB = "507f1f77bcf86cd799439022";
  const userAId = "507f1f77bcf86cd799439033";
  const userBId = "507f1f77bcf86cd799439044";
  const validMeetingId = "507f1f77bcf86cd799439055";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkMeetingOrgAccess Helper", () => {
    it("should grant access if user is direct uploader of the meeting", () => {
      const meeting = {
        _id: validMeetingId,
        uploadedBy: userAId,
        organization: orgB,
      };
      const user = { _id: userAId, organization: orgA };

      expect(checkMeetingOrgAccess(meeting, user)).toBe(true);
    });

    it("should grant access if user belongs to meeting host organization", () => {
      const meeting = {
        _id: validMeetingId,
        uploadedBy: userBId,
        organization: orgA,
      };
      const user = { _id: userAId, organization: orgA };

      expect(checkMeetingOrgAccess(meeting, user)).toBe(true);
    });

    it("should DENY access (403 IDOR defense) if user belongs to a foreign organization", () => {
      const meeting = {
        _id: validMeetingId,
        uploadedBy: userBId,
        organization: orgB,
      };
      const user = { _id: userAId, organization: orgA };

      expect(checkMeetingOrgAccess(meeting, user)).toBe(false);
    });
  });

  describe("generateBriefing Controller", () => {
    it("should return 400 Bad Request for invalid meetingId format", async () => {
      const req = {
        params: { meetingId: "invalid-id" },
        user: { _id: userAId, organization: orgA },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await generateBriefing(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Invalid meetingId format.",
        }),
      );
    });

    it("should return 404 Not Found if meeting does not exist", async () => {
      Meeting.findById.mockResolvedValue(null);

      const req = {
        params: { meetingId: validMeetingId },
        user: { _id: userAId, organization: orgA },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await generateBriefing(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Meeting not found.",
        }),
      );
    });

    it("should return 403 Forbidden if user belongs to a foreign organization (IDOR defense)", async () => {
      const foreignMeeting = {
        _id: validMeetingId,
        title: "Confidential Strategy Meeting",
        organization: orgB,
        uploadedBy: userBId,
      };
      Meeting.findById.mockResolvedValue(foreignMeeting);

      const req = {
        params: { meetingId: validMeetingId },
        user: { _id: userAId, organization: orgA },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await generateBriefing(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/Unauthorized/i),
        }),
      );
    });

    it("should return 201 Created with briefing package for authorized organization member", async () => {
      const authorizedMeeting = {
        _id: validMeetingId,
        title: "Sprint Planning",
        organization: orgA,
        uploadedBy: userBId,
        participants: [{ name: "Alice", email: "alice@org-a.com" }],
      };
      Meeting.findById.mockResolvedValue(authorizedMeeting);

      const req = {
        params: { meetingId: validMeetingId },
        user: { _id: userAId, organization: orgA },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await generateBriefing(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          briefing: expect.objectContaining({
            title: "Sprint Planning",
          }),
        }),
      );
    });
  });

  describe("regenerateBriefing Controller", () => {
    it("should return 404 Not Found if meeting does not exist", async () => {
      Meeting.findById.mockResolvedValue(null);

      const req = {
        params: { meetingId: validMeetingId },
        user: { _id: userAId, organization: orgA },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await regenerateBriefing(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Meeting not found." }),
      );
    });

    it("should return 403 Forbidden for unauthorized user during regeneration", async () => {
      const foreignMeeting = {
        _id: validMeetingId,
        title: "Private Exec Meeting",
        organization: orgB,
        uploadedBy: userBId,
      };
      Meeting.findById.mockResolvedValue(foreignMeeting);

      const req = {
        params: { meetingId: validMeetingId },
        user: { _id: userAId, organization: orgA },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await regenerateBriefing(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/Unauthorized/i),
        }),
      );
    });

    it("should return 200 OK with fresh regenerated briefing for authorized user", async () => {
      const authorizedMeeting = {
        _id: validMeetingId,
        title: "Sprint Review & Planning",
        organization: orgA,
        uploadedBy: userAId,
        participants: [{ name: "Bob", email: "bob@org-a.com" }],
      };
      Meeting.findById.mockResolvedValue(authorizedMeeting);

      const req = {
        params: { meetingId: validMeetingId },
        user: { _id: userAId, organization: orgA },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await regenerateBriefing(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          briefing: expect.objectContaining({
            title: "Sprint Review & Planning",
          }),
        }),
      );
    });
  });

  describe("shareBriefingWithParticipants Controller", () => {
    it("should dispatch briefing email alerts and return 200 OK for authorized host", async () => {
      const authorizedMeeting = {
        _id: validMeetingId,
        title: "Q4 Business Review",
        organization: orgA,
        uploadedBy: userAId,
        participants: ["alice@org-a.com", "bob@org-a.com"],
      };
      Meeting.findById.mockResolvedValue(authorizedMeeting);

      const req = {
        params: { meetingId: validMeetingId },
        user: { _id: userAId, organization: orgA },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await shareBriefingWithParticipants(req, res, next);

      expect(EmailService.dispatchBriefingAlerts).toHaveBeenCalledWith(
        ["alice@org-a.com", "bob@org-a.com"],
        expect.any(String),
        "Q4 Business Review",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Briefing successfully shared with attendees.",
        }),
      );
    });
  });

  describe("getBriefing Controller", () => {
    it("should return 403 Forbidden if user belongs to a foreign organization", async () => {
      const foreignMeeting = {
        _id: validMeetingId,
        title: "Confidential Org B Briefing",
        organization: orgB,
        uploadedBy: userBId,
      };
      Meeting.findById.mockResolvedValue(foreignMeeting);

      const req = {
        params: { meetingId: validMeetingId },
        user: { _id: userAId, organization: orgA },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await getBriefing(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/Unauthorized/i),
        }),
      );
    });

    it("should return 200 OK with briefing for authorized user", async () => {
      const authorizedMeeting = {
        _id: validMeetingId,
        title: "Org A Weekly Sync",
        organization: orgA,
        uploadedBy: userBId,
      };
      Meeting.findById.mockResolvedValue(authorizedMeeting);

      const req = {
        params: { meetingId: validMeetingId },
        user: { _id: userAId, organization: orgA },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await getBriefing(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          briefing: expect.objectContaining({
            title: "Org A Weekly Sync",
          }),
        }),
      );
    });
  });
});
