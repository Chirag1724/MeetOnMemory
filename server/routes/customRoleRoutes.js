import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requirePermission } from "../middleware/rbac.js";
import {
  createCustomRole,
  getCustomRoles,
  setResourceAclEntry,
  checkResourcePermission,
} from "../controllers/customRoleController.js";

const router = express.Router();

router.use(userAuth);

// Issue #2570 — reads are open to any authenticated member of the
// organization; writes (defining roles and granting resource ACLs) are an
// administrative action, not something a bare session may perform.
// The tenant itself is resolved server-side from req.user.organization in the
// controller — never from the x-organization-id request header.
router.post(
  "/roles",
  requirePermission("team_members", "change_role"),
  createCustomRole,
);
router.get("/roles", getCustomRoles);
router.post(
  "/acl",
  requirePermission("team_members", "change_role"),
  setResourceAclEntry,
);
router.get("/check-permission", checkResourcePermission);

export default router;
