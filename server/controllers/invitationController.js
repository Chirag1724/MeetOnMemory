// server/controllers/invitationController.js
import Invitation from "../models/invitationModel.js";
import Membership from "../models/membershipModel.js";
import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import crypto from "crypto";
import mongoose from "mongoose";
import EmailService from "../services/EmailService.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

/**
 * Validate MongoDB ObjectId
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Sanitize and validate email (ReDoS-safe)
 */
const sanitizeEmail = (email) => {
  if (!email || typeof email !== "string") return null;
  const sanitized = email.trim().toLowerCase();
  // Simple, ReDoS-safe email validation
  if (sanitized.length > 254) return null; // Max email length
  if (!sanitized.includes("@") || !sanitized.includes(".")) return null;
  const parts = sanitized.split("@");
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (!local || !domain) return null;
  if (local.length > 64) return null; // Max local part length
  if (domain.length > 255) return null; // Max domain length
  if (domain.split(".").length < 2) return null; // At least one dot in domain
  return sanitized;
};

/**
 * Whitelist allowed status values
 */
const allowedStatuses = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "expired",
];
const isValidStatus = (status) => allowedStatuses.includes(status);

/**
 * Whitelist allowed role values
 */
const allowedRoles = ["admin", "member"];
const isValidRole = (role) => allowedRoles.includes(role);

/**
 * Generate unique invitation token
 */
const generateInvitationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * ✅ Create Invitation
 * POST /api/invitations
 */
export const createInvitation = async (req, res) => {
  try {
    const { organizationId, email, role, message, expiresIn } = req.body;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    if (!organizationId || !email) {
      return sendError(res, 400, "Organization ID and email are required.");
    }

    // Validate organizationId
    if (!isValidObjectId(organizationId)) {
      return sendError(res, 400, "Invalid organization ID.");
    }

    const cleanOrganizationId = new mongoose.Types.ObjectId(
      String(organizationId),
    );

    // Validate and sanitize email
    const sanitizedEmail = sanitizeEmail(email);
    if (!sanitizedEmail) {
      return sendError(res, 400, "Invalid email address.");
    }

    // Validate role if provided
    if (role && !isValidRole(role)) {
      return sendError(res, 400, "Invalid role. Must be 'admin' or 'member'.");
    }

    const cleanRole =
      role && isValidRole(role)
        ? allowedRoles.find((r) => r === role)
        : "member";

    const userId = req.user.id;

    // Check if organization exists
    const organization = await Organization.findById(cleanOrganizationId);

    if (!organization) {
      return sendError(res, 404, "Organization not found.");
    }

    // Check if user is admin or owner
    const membership = await Membership.findOne({
      user: userId,
      organization: cleanOrganizationId,
      role: "admin",
      status: "active",
    }).lean();

    const isOwner = organization.owner.toString() === userId.toString();

    if (!membership && !isOwner) {
      return sendError(res, 403, "Not authorized to create invitations.");
    }

    // Check if email already has an active membership
    const existingUser = await userModel
      .findOne({ email: sanitizedEmail })
      .lean();
    if (existingUser) {
      const existingMembership = await Membership.findOne({
        user: existingUser._id,
        organization: cleanOrganizationId,
        status: "active",
      }).lean();

      if (existingMembership) {
        return sendError(
          res,
          400,
          "User is already a member of this organization.",
        );
      }
    }

    // Check if there's a pending invitation for this email
    const existingInvitation = await Invitation.findOne({
      email: sanitizedEmail,
      organization: cleanOrganizationId,
      status: "pending",
    }).lean();

    if (existingInvitation) {
      return sendError(
        res,
        409,
        "Pending invitation already exists for this email.",
      );
    }

    // Calculate expiration time (default 7 days)
    const expiresAt = new Date();
    const expiresInDays =
      typeof expiresIn === "number" && expiresIn > 0 ? expiresIn : 7;
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create invitation with validated fields
    const invitationData = {
      organization: cleanOrganizationId,
      email: sanitizedEmail,
      invitedBy: userId,
      token: generateInvitationToken(),
      role: cleanRole,
      status: "pending",
      expiresAt,
      message: message ? String(message).trim().substring(0, 500) : "",
    };

    const invitation = await Invitation.create(invitationData);

    // Send invitation email
    const inviteLink = `${req.headers.origin || "http://localhost:5173"}/join-organization?token=${invitation.token}`;
    await EmailService.sendInvitation({
      to: sanitizedEmail,
      organizationName: organization.name,
      invitedBy: req.user.name || "Admin",
      inviteLink,
    });

    sendSuccess(res, { invitation }, "Invitation created successfully.", 201);
  } catch (error) {
    console.error("❌ Error creating invitation:", error);
    if (error.code === 11000) {
      return sendError(res, 409, "Duplicate invitation not allowed.");
    }
    sendError(res, 500, "Server error");
  }
};

/**
 * ✅ Get Organization Invitations
 * GET /api/invitations/organization/:organizationId
 */
export const getOrganizationInvitations = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { status } = req.query;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    // Validate organizationId
    if (!isValidObjectId(organizationId)) {
      return sendError(res, 400, "Invalid organization ID.");
    }

    const cleanOrganizationId = new mongoose.Types.ObjectId(
      String(organizationId),
    );

    // Validate status if provided
    if (status && !isValidStatus(status)) {
      return sendError(res, 400, "Invalid status value.");
    }

    const cleanStatus =
      status && isValidStatus(status)
        ? allowedStatuses.find((s) => s === status)
        : undefined;

    const organization = await Organization.findById(cleanOrganizationId);

    if (!organization) {
      return sendError(res, 404, "Organization not found.");
    }

    // Check if user is admin or owner
    const membership = await Membership.findOne({
      user: req.user.id,
      organization: cleanOrganizationId,
      role: "admin",
      status: "active",
    });

    const isOwner = organization.owner.toString() === req.user.id.toString();

    if (!membership && !isOwner) {
      return sendError(res, 403, "Not authorized to view invitations.");
    }

    const filter = { organization: cleanOrganizationId };
    if (cleanStatus) {
      filter.status = cleanStatus;
    }

    const invitations = await Invitation.find(filter)
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    sendSuccess(res, { invitations });
  } catch (error) {
    console.error("❌ Error fetching invitations:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * ✅ Get User's Invitations
 * GET /api/invitations/user
 */
export const getUserInvitations = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const user = await userModel.findById(req.user.id);

    if (!user) {
      return sendError(res, 404, "User not found.");
    }

    const invitations = await Invitation.find({
      email: user.email,
      status: "pending",
      expiresAt: { $gt: new Date() },
    })
      .populate("organization", "name slug description logo")
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 });

    sendSuccess(res, { invitations });
  } catch (error) {
    console.error("❌ Error fetching user invitations:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * ✅ Accept Invitation
 * POST /api/invitations/:token/accept
 */
export const acceptInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const invitation = await Invitation.findOne({ token }).populate(
      "organization",
    );

    if (!invitation) {
      return sendError(res, 404, "Invitation not found.");
    }

    if (invitation.status !== "pending") {
      return sendError(res, 400, "Invitation is not in pending status.");
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = "expired";
      await invitation.save();
      return sendError(res, 400, "Invitation has expired.");
    }

    // Verify email matches
    const user = await userModel.findById(req.user.id);

    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return sendError(res, 403, "Invitation is not for this user.");
    }

    // Check if user already has an active membership
    const existingMembership = await Membership.findOne({
      user: req.user.id,
      organization: invitation.organization._id,
      status: "active",
    });

    if (existingMembership) {
      return sendError(res, 400, "Already a member of this organization.");
    }

    // Update invitation status
    invitation.status = "accepted";
    invitation.acceptedBy = req.user.id;
    invitation.acceptedAt = new Date();
    await invitation.save();

    // Create membership
    const newMembership = await Membership.create({
      user: req.user.id,
      organization: invitation.organization._id,
      role: invitation.role,
      status: "active",
    });

    // Update user model for backward compatibility
    await userModel.findByIdAndUpdate(req.user.id, {
      role: invitation.role,
      organization: invitation.organization._id,
      hasCompletedOnboarding: true,
    });

    sendSuccess(
      res,
      { invitation, membership: newMembership },
      "Invitation accepted successfully.",
    );
  } catch (error) {
    console.error("❌ Error accepting invitation:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * ✅ Reject Invitation
 * POST /api/invitations/:token/reject
 */
export const rejectInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const invitation = await Invitation.findOne({ token });

    if (!invitation) {
      return sendError(res, 404, "Invitation not found.");
    }

    if (invitation.status !== "pending") {
      return sendError(res, 400, "Invitation is not in pending status.");
    }

    // Verify email matches
    const user = await userModel.findById(req.user.id);

    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return sendError(res, 403, "Invitation is not for this user.");
    }

    // Update invitation status
    invitation.status = "declined";
    await invitation.save();

    sendSuccess(res, { invitation }, "Invitation declined successfully.");
  } catch (error) {
    console.error("❌ Error rejecting invitation:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * ✅ Revoke Invitation
 * DELETE /api/invitations/:id
 */
export const revokeInvitation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid invitation ID.");
    }

    const cleanInvitationId = new mongoose.Types.ObjectId(String(id));
    const invitation =
      await Invitation.findById(cleanInvitationId).populate("organization");

    if (!invitation) {
      return sendError(res, 404, "Invitation not found.");
    }

    // Check if user is admin or owner
    const membership = await Membership.findOne({
      user: req.user.id,
      organization: invitation.organization._id,
      role: "admin",
      status: "active",
    });

    const isOwner =
      invitation.organization.owner.toString() === req.user.id.toString();

    if (!membership && !isOwner) {
      return sendError(res, 403, "Not authorized to revoke invitations.");
    }

    if (invitation.status !== "pending") {
      return sendError(res, 400, "Can only cancel pending invitations.");
    }

    invitation.status = "cancelled";
    await invitation.save();

    sendSuccess(res, { invitation }, "Invitation cancelled successfully.");
  } catch (error) {
    console.error("❌ Error revoking invitation:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * ✅ Get Invitation by Token
 * GET /api/invitations/:token
 */
export const getInvitationByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await Invitation.findOne({ token })
      .populate("organization", "name slug description logo")
      .populate("invitedBy", "name email");

    if (!invitation) {
      return sendError(res, 404, "Invitation not found.");
    }

    if (invitation.status !== "pending") {
      return sendError(res, 400, "Invitation is not in pending status.");
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = "expired";
      await invitation.save();
      return sendError(res, 400, "Invitation has expired.");
    }

    sendSuccess(res, { invitation });
  } catch (error) {
    console.error("❌ Error fetching invitation:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * ✅ Resend Invitation
 * POST /api/invitations/:id/resend
 */
export const resendInvitation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid invitation ID.");
    }

    const cleanInvitationId = new mongoose.Types.ObjectId(String(id));
    const invitation =
      await Invitation.findById(cleanInvitationId).populate("organization");

    if (!invitation) {
      return sendError(res, 404, "Invitation not found.");
    }

    // Check if user is admin or owner
    const membership = await Membership.findOne({
      user: req.user.id,
      organization: invitation.organization._id,
      role: "admin",
      status: "active",
    });

    const isOwner =
      invitation.organization.owner.toString() === req.user.id.toString();

    if (!membership && !isOwner) {
      return sendError(res, 403, "Not authorized to resend invitations.");
    }

    // Generate new token and set expiration to +7 days from now
    const newToken = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    invitation.token = newToken;
    invitation.expiresAt = expiresAt;
    invitation.status = "pending";
    await invitation.save();

    // Send the email
    const inviteLink = `${req.headers.origin || "http://localhost:5173"}/join-organization?token=${newToken}`;
    await EmailService.sendInvitation({
      to: invitation.email,
      organizationName: invitation.organization.name,
      invitedBy: req.user.name || "Admin",
      inviteLink,
    });

    sendSuccess(res, { invitation }, "Invitation resent successfully.");
  } catch (error) {
    console.error("❌ Error resending invitation:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * ✅ Expire Invitation Manually
 * POST /api/invitations/:id/expire
 */
export const expireInvitation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid invitation ID.");
    }

    const cleanInvitationId = new mongoose.Types.ObjectId(String(id));
    const invitation =
      await Invitation.findById(cleanInvitationId).populate("organization");

    if (!invitation) {
      return sendError(res, 404, "Invitation not found.");
    }

    // Check if user is admin or owner
    const membership = await Membership.findOne({
      user: req.user.id,
      organization: invitation.organization._id,
      role: "admin",
      status: "active",
    });

    const isOwner =
      invitation.organization.owner.toString() === req.user.id.toString();

    if (!membership && !isOwner) {
      return sendError(res, 403, "Not authorized to expire invitations.");
    }

    if (invitation.status !== "pending") {
      return sendError(res, 400, "Can only expire pending invitations.");
    }

    invitation.status = "expired";
    invitation.expiresAt = new Date();
    await invitation.save();

    sendSuccess(res, { invitation }, "Invitation expired successfully.");
  } catch (error) {
    console.error("❌ Error expiring invitation:", error);
    sendError(res, 500, "Server error");
  }
};
