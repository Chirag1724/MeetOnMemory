// server/routes/membershipRequestRoutes.js
import express from "express";
import {
  createMembershipRequest,
  getOrganizationMembershipRequests,
  getUserMembershipRequests,
  approveMembershipRequest,
  rejectMembershipRequest,
  cancelMembershipRequest,
  bulkApproveMembershipRequests,
  bulkRejectMembershipRequests,
} from "../controllers/membershipRequestController.js";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// All routes require authentication
router.use(userAuth);

// Create request
router.post("/", createMembershipRequest);

// Get requests
router.get("/organization/:organizationId", getOrganizationMembershipRequests);
router.get("/user", getUserMembershipRequests);

// Manage requests
router.patch("/:id/approve", approveMembershipRequest);
router.patch("/:id/reject", rejectMembershipRequest);
router.patch("/:id/cancel", cancelMembershipRequest);

// Bulk actions
router.post("/bulk-approve", bulkApproveMembershipRequests);
router.post("/bulk-reject", bulkRejectMembershipRequests);

export default router;
