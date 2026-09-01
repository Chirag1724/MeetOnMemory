import express from "express";
import {
  getLatestInsight,
  getInsightHistory,
  triggerManualGeneration,
  shareWeeklyInsight,
  emailWeeklyInsight,
} from "../controllers/weeklyInsightController.js";
import userAuth from "../middleware/userAuth.js";
import {
  requireOrganizationParamMatch,
  requireRole,
} from "../middleware/rbac.js";

const router = express.Router();

router.use(userAuth);

// Issue #2571 — authorization chain for every `:orgId` route:
//   userAuth → role check → path org matches the caller's membership org.
// `requireRole` only asserts the caller *has* a role; it says nothing about
// which organization it belongs to. Without the second guard an authenticated
// member of org A could read (and, on /generate, write) org B by editing the
// id in the path. Controllers scope their queries with
// `req.authorizedOrganizationId`, never the raw param.
router.get(
  "/:orgId/latest",
  requireRole(["owner", "admin", "member"]),
  requireOrganizationParamMatch("orgId"),
  getLatestInsight,
);
router.get(
  "/:orgId",
  requireRole(["owner", "admin", "member"]),
  requireOrganizationParamMatch("orgId"),
  getInsightHistory,
);
router.post(
  "/:orgId/generate",
  requireRole(["owner", "admin"]),
  requireOrganizationParamMatch("orgId"),
  triggerManualGeneration,
);
router.post(
  "/:orgId/insights/:insightId/share",
  requireRole(["owner", "admin"]),
  requireOrganizationParamMatch("orgId"),
  shareWeeklyInsight,
);
router.post(
  "/:orgId/insights/:insightId/email",
  requireRole(["owner", "admin"]),
  requireOrganizationParamMatch("orgId"),
  emailWeeklyInsight,
);

export default router;
