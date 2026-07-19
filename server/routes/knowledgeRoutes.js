import express from "express";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import { requirePermission, requireOrgMembership } from "../middleware/rbac.js";
import {
  getDecisionLineageController,
  getOpenActionItems,
  getDecisions,
  submitMemoryFeedback,
  recalculateImportance,
  updateActionItemStatus,
} from "../controllers/knowledgeController.js";
import {
  runConsolidation,
  getConsolidationHistory,
} from "../controllers/consolidationController.js";
import {
  getSnapshots,
  getSnapshot,
  exportSnapshot,
  getSnapshotDiff,
  createManualSnapshot,
} from "../controllers/graphSnapshotController.js";

const router = express.Router();
router.use(apiLimiter);
router.use(userAuth);

router.get(
  "/decisions",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getDecisions,
);
router.get(
  "/decisions/:id/lineage",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getDecisionLineageController,
);
router.get(
  "/action-items",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getOpenActionItems,
);
router.patch(
  "/action-items/:id",
  writeLimiter,
  requireOrgMembership,
  requirePermission("tasks", "edit"),
  updateActionItemStatus,
);
router.patch(
  "/:type/:id/feedback",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "edit"),
  submitMemoryFeedback,
);

router.post(
  "/importance/recalculate",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "edit"),
  recalculateImportance,
);

// --- Memory Graph Snapshot & Time-Travel (issue #374) ---
// NOTE: "/diff" must be registered before the "/:id" route below, since
// otherwise Express would match "diff" as an :id parameter.
router.get(
  "/graph/snapshots/diff",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getSnapshotDiff,
);
router.get(
  "/graph/snapshots",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getSnapshots,
);
router.post(
  "/graph/snapshots",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "snapshot"),
  createManualSnapshot,
);
router.get(
  "/graph/snapshots/:id/export",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  exportSnapshot,
);
router.get(
  "/graph/snapshots/:id",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getSnapshot,
);

// --- Memory Consolidation Engine ---
router.post(
  "/consolidate",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "consolidate"),
  runConsolidation,
);
router.get(
  "/consolidation/history",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getConsolidationHistory,
);

export default router;
