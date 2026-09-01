import CustomRole from "../models/customRoleModel.js";
import rbacMatrixService from "../services/rbacMatrixService.js";
import { toOrganizationId } from "../utils/organizationScope.js";

/**
 * Server-side tenant resolution (Issue #2570).
 * Prefers the id a middleware verified, otherwise the caller's membership
 * organization.
 */
const resolveAuthorizedOrganizationId = (req) =>
  req.authorizedOrganizationId
    ? String(req.authorizedOrganizationId)
    : toOrganizationId(req.user?.organization);

/**
 * Controller handling Custom Roles and Resource-Level ACL configurations
 *
 * Issue #2570 — the tenant is the authenticated user's membership
 * organization, resolved server-side. `req.user.organizationId` does not exist
 * (userAuth sets `req.user = user`, and the User field is `organization`), so
 * the old `req.user?.organizationId || req.headers["x-organization-id"]` always
 * fell through to the header: any authenticated user could send
 * `x-organization-id: <someone else's org>` and act as that tenant.
 */
const organizationContextRequired = (res) =>
  res.status(403).json({
    success: false,
    error: "Organization context is required",
  });

export const createCustomRole = async (req, res) => {
  try {
    const organizationId = resolveAuthorizedOrganizationId(req);
    const { name, description, permissions, priority } = req.body || {};

    if (!organizationId) {
      return organizationContextRequired(res);
    }
    if (!name) {
      return res.status(400).json({ error: "Role name is required" });
    }

    const role = await CustomRole.create({
      organizationId,
      name,
      description,
      permissions,
      priority: priority || 10,
    });

    return res.status(201).json({
      message: "Custom role created successfully",
      role,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ error: "Role name already exists in organization" });
    }
    return res.status(500).json({ error: error.message });
  }
};

export const getCustomRoles = async (req, res) => {
  try {
    const organizationId = resolveAuthorizedOrganizationId(req);

    if (!organizationId) {
      return organizationContextRequired(res);
    }

    const roles = await CustomRole.find({ organizationId })
      .sort({ priority: 1 })
      .lean();
    return res.status(200).json({ roles });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const setResourceAclEntry = async (req, res) => {
  try {
    const organizationId = resolveAuthorizedOrganizationId(req);
    const userId = req.user?._id || req.user?.id;
    const { resourceType, resourceId, granteeType, granteeId, permissions } =
      req.body || {};

    if (!organizationId) {
      return organizationContextRequired(res);
    }

    if (
      !resourceType ||
      !resourceId ||
      !granteeType ||
      !granteeId ||
      !permissions
    ) {
      return res.status(400).json({
        error:
          "resourceType, resourceId, granteeType, granteeId, and permissions are required",
      });
    }

    const acl = await rbacMatrixService.setResourceAcl({
      organizationId,
      resourceType,
      resourceId,
      granteeType,
      granteeId,
      permissions,
      grantedBy: userId,
    });

    return res.status(200).json({
      message: "Resource ACL updated successfully",
      acl,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const checkResourcePermission = async (req, res) => {
  try {
    const organizationId = resolveAuthorizedOrganizationId(req);

    if (!organizationId) {
      return organizationContextRequired(res);
    }

    const userId = req.user?._id || req.user?.id;
    const userRoleId = req.user?.customRoleId || req.user?.roleId;
    const { resourceType, resourceId, requiredPermission } = req.query;

    if (!resourceType || !resourceId) {
      return res
        .status(400)
        .json({ error: "resourceType and resourceId are required" });
    }

    const hasAccess = await rbacMatrixService.evaluateResourceAccess({
      organizationId,
      userId,
      userRoleId,
      resourceType,
      resourceId,
      requiredPermission: requiredPermission || "READ",
    });

    return res.status(200).json({ hasAccess });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
