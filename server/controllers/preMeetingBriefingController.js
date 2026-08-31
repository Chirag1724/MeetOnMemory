// server/controllers/preMeetingBriefingController.js
/**
 * Pre-meeting Briefing Controller
 *
 * Handles HTTP requests for pre-meeting briefings with strict meeting and organization access controls (IDOR defense).
 */

import Meeting from "../models/meetingModel.js";
import {
  generatePreMeetingBriefing,
  getPreMeetingBriefing,
} from "../services/preMeetingBriefingService.js";
import EmailService from "../services/EmailService.js";

/**
 * Helper function to validate authorization for accessing a meeting.
 * Ensures the authenticated user is either the direct uploader or belongs to the meeting's host organization.
 *
 * @param {Object} meeting
 * @param {Object} user
 * @returns {boolean}
 */
export const checkMeetingOrgAccess = (meeting, user) => {
  if (!meeting || !user) return false;

  const userId = user._id?.toString() || user.id?.toString();
  const userOrgId =
    user.organization?.toString() || user.organizationId?.toString();
  const meetingOrgId = meeting.organization?.toString();
  const uploaderId =
    meeting.uploadedBy?.toString() ||
    meeting.organizerId?.toString() ||
    meeting.hostId?.toString();

  // Access granted if user is direct uploader / organizer
  if (uploaderId && userId && uploaderId === userId) {
    return true;
  }

  // Access granted if user belongs to the meeting's host organization
  if (meetingOrgId && userOrgId && meetingOrgId === userOrgId) {
    return true;
  }

  return false;
};

/**
 * POST /api/briefings/:meetingId/generate
 * Generates a pre-meeting briefing package for a meeting.
 * Enforces meeting existence and tenant organization authorization (IDOR defense).
 */
export const generateBriefing = async (req, res, next) => {
  try {
    const meetingId = req.params.meetingId || req.params.id;

    if (
      !meetingId ||
      typeof meetingId !== "string" ||
      !/^[0-9a-fA-F]{24}$/.test(meetingId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid meetingId format.",
      });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found.",
      });
    }

    // Access Control Validation: Ensure authenticated user belongs to host organization or uploaded the meeting
    if (!checkMeetingOrgAccess(meeting, req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Unauthorized: You do not have permission to generate briefings for this meeting.",
      });
    }

    const briefing = await generatePreMeetingBriefing(meeting);

    return res.status(201).json({
      success: true,
      message: "Pre-meeting briefing generated successfully.",
      briefing,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/briefings/:meetingId/regenerate or /api/meeting/:id/briefing/regenerate
 * Force regeneration pipeline from the latest context.
 */
export const regenerateBriefing = async (req, res, next) => {
  try {
    const meetingId = req.params.meetingId || req.params.id;

    if (
      !meetingId ||
      typeof meetingId !== "string" ||
      !/^[0-9a-fA-F]{24}$/.test(meetingId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid meetingId format.",
      });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found.",
      });
    }

    if (!checkMeetingOrgAccess(meeting, req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Unauthorized: You do not have permission to regenerate briefings for this meeting.",
      });
    }

    const freshBriefing = await generatePreMeetingBriefing(meeting);

    return res.status(200).json({
      success: true,
      message: "Briefing regenerated successfully.",
      briefing: freshBriefing,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/briefings/:meetingId/share or /api/meeting/:id/briefing/share
 * Share briefing with participants via email alerts.
 */
export const shareBriefingWithParticipants = async (req, res, next) => {
  try {
    const meetingId = req.params.meetingId || req.params.id;

    if (
      !meetingId ||
      typeof meetingId !== "string" ||
      !/^[0-9a-fA-F]{24}$/.test(meetingId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid meetingId format.",
      });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found.",
      });
    }

    if (!checkMeetingOrgAccess(meeting, req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Unauthorized: You do not have permission to share briefings for this meeting.",
      });
    }

    const briefingUrl =
      meeting.briefingUrl || `/meeting/${meeting._id}/briefing`;
    if (
      EmailService &&
      typeof EmailService.dispatchBriefingAlerts === "function"
    ) {
      await EmailService.dispatchBriefingAlerts(
        meeting.participants || [],
        briefingUrl,
        meeting.title,
      );
    } else if (
      meeting.participants &&
      Array.isArray(meeting.participants) &&
      EmailService?.sendNotificationEmail
    ) {
      for (const p of meeting.participants) {
        const email = typeof p === "string" ? p : p?.email;
        if (email) {
          await EmailService.sendNotificationEmail(
            email,
            `Pre-Meeting Briefing: ${meeting.title || "Meeting Briefing"}`,
            `A pre-meeting briefing is available for your review: ${briefingUrl}`,
          );
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Briefing successfully shared with attendees.",
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/briefings/:meetingId
 * Retrieves pre-meeting briefing details for a meeting.
 * Enforces meeting existence and tenant organization authorization (IDOR defense).
 */
export const getBriefing = async (req, res, next) => {
  try {
    const meetingId = req.params.meetingId || req.params.id;

    if (
      !meetingId ||
      typeof meetingId !== "string" ||
      !/^[0-9a-fA-F]{24}$/.test(meetingId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid meetingId format.",
      });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found.",
      });
    }

    // Access Control Validation: Ensure authenticated user belongs to host organization or uploaded the meeting
    if (!checkMeetingOrgAccess(meeting, req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Unauthorized: You do not have permission to view briefings for this meeting.",
      });
    }

    const briefing = await getPreMeetingBriefing(meeting);

    return res.status(200).json({
      success: true,
      briefing,
    });
  } catch (err) {
    return next(err);
  }
};
