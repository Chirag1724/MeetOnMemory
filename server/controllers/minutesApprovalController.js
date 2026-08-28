// server/controllers/minutesApprovalController.js
import * as minutesApprovalService from "../services/minutesApprovalService.js";
import User from "../models/userModel.js";

// Mock storage database schema for MoM Records
const minutesStore = {};

export const getApprovalStatus = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const status = await minutesApprovalService.getApprovalStatus(meetingId);
    return res.status(200).json(status);
  } catch (error) {
    console.error("Error in getApprovalStatus:", error);
    return res.status(500).json({ message: "Failed to get approval status", error: error.message });
  }
};

export const submitApproval = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { summary, approverIds } = req.body;

    const clerkUserId = req.auth?.userId || req.auth?.clerkUserId;
    let localUser = null;
    if (clerkUserId) {
      localUser = await User.findOne({ clerkUserId });
    }
    const submitterId = localUser?._id || req.user?._id;

    if (!summary || !approverIds || !Array.isArray(approverIds)) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const result = await minutesApprovalService.submitForApproval(
      meetingId,
      submitterId,
      summary,
      approverIds
    );
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in submitApproval:", error);
    return res.status(500).json({ message: "Failed to submit for approval", error: error.message });
  }
};

export const respondApproval = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { status, comment } = req.body;

    const clerkUserId = req.auth?.userId || req.auth?.clerkUserId;
    let localUser = null;
    if (clerkUserId) {
      localUser = await User.findOne({ clerkUserId });
    }
    const approverId = localUser?._id || req.user?._id;

    if (!status) {
      return res.status(400).json({ message: "Missing status field" });
    }
    const result = await minutesApprovalService.respondToApproval(
      meetingId,
      approverId,
      status,
      comment
    );
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in respondApproval:", error);
    return res.status(500).json({ message: "Failed to respond to approval", error: error.message });
  }
};

export const handleApprovalAction = async (req, res) => {
  try {
    const { minutesId } = req.params;
    const { userId, role, action, feedback } = req.body;
    // action: 'APPROVE' | 'REQUEST_CHANGES'

    // Authorization Guard
    if (role !== "BOARD_MEMBER" && role !== "APPROVER") {
      return res
        .status(403)
        .json({ error: "UNAUTHORIZED_ACTION: User lacks approval authority" });
    }

    if (!minutesStore[minutesId]) {
      minutesStore[minutesId] = {
        status: "PENDING",
        quorumTarget: 3, // Configurable quorum requirement threshold
        votes: {},
        auditTrail: [],
      };
    }

    const meetingMinutes = minutesStore[minutesId];

    // Persist voter choice mapping and append to log
    meetingMinutes.votes[userId] = action;
    meetingMinutes.auditTrail.push({
      userId,
      role,
      action,
      feedback: feedback || "",
      timestamp: new Date().toISOString(),
    });

    // Recalculate Quorum Gating Constraints
    const totalVotes = Object.values(meetingMinutes.votes);
    const approvalCount = totalVotes.filter((v) => v === "APPROVE").length;
    const changesRequestedCount = totalVotes.filter(
      (v) => v === "REQUEST_CHANGES",
    ).length;

    if (changesRequestedCount > 0) {
      meetingMinutes.status = "CHANGES_REQUESTED";
    } else if (approvalCount >= meetingMinutes.quorumTarget) {
      meetingMinutes.status = "APPROVED";
    } else {
      meetingMinutes.status = "PENDING";
    }

    return res.status(200).json({ success: true, data: meetingMinutes });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Internal approval processing fault" });
  }
};

export const exportAuditTrail = async (req, res) => {
  try {
    const { minutesId } = req.params;
    const record = minutesStore[minutesId] || { auditTrail: [] };

    // Provide file attachment download triggers back to clients
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=minutes_audit_${minutesId}.json`,
    );

    return res.status(200).send(JSON.stringify(record.auditTrail, null, 2));
  } catch (error) {
    return res.status(500).json({ error: "Audit export pipeline failure" });
  }
};
