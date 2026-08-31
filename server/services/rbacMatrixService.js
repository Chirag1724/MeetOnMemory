import CustomRole from "../models/customRoleModel.js";
import ResourceAcl from "../models/resourceAclModel.js";

/**
 * Service evaluating workspace custom roles, permission inheritance,
 * and fine-grained resource-level ACLs.
 */
class RbacMatrixService {
  /**
   * Evaluate if a user or role has a specific global capability
   */
  async hasGlobalPermission(organizationId, roleId, domain, action) {
    const role = await CustomRole.findOne({
      _id: roleId,
      organizationId,
    }).lean();
    if (!role) return false;

    return Boolean(role.permissions?.[domain]?.[action]);
  }

  /**
   * Evaluate effective permission on a specific resource (Resource ACL + Global Role)
   */
  async evaluateResourceAccess({
    organizationId,
    userId,
    userRoleId,
    resourceType,
    resourceId,
    requiredPermission,
  }) {
    // Issue #2570 — Mongoose strips `undefined` from a filter, so an
    // unscoped query here silently matched an ACL row belonging to *any*
    // organization. Fail loudly instead of evaluating without a tenant.
    if (!organizationId) {
      throw new Error(
        "Organization context is required to evaluate resource access",
      );
    }

    // 1. Check direct user ACL
    const userAcl = await ResourceAcl.findOne({
      organizationId,
      resourceType,
      resourceId,
      granteeType: "USER",
      granteeId: userId,
    }).lean();

    if (userAcl) {
      if (
        userAcl.permissions.includes(requiredPermission) ||
        userAcl.permissions.includes("ADMIN")
      ) {
        return true;
      }
    }

    // 2. Check role ACL
    if (userRoleId) {
      const roleAcl = await ResourceAcl.findOne({
        organizationId,
        resourceType,
        resourceId,
        granteeType: "ROLE",
        granteeId: userRoleId,
      }).lean();

      if (roleAcl) {
        if (
          roleAcl.permissions.includes(requiredPermission) ||
          roleAcl.permissions.includes("ADMIN")
        ) {
          return true;
        }
      }
    }

    // 3. Fallback to global domain permission
    const domainMap = {
      MEETING: "meetings",
      FOLDER: "knowledge",
      POLICY: "policies",
      REPORT: "analytics",
    };
    const actionMap = {
      READ: "view",
      WRITE: "edit",
      ADMIN: "delete",
    };

    const domain = domainMap[resourceType] || "meetings";
    const action = actionMap[requiredPermission] || "view";

    return await this.hasGlobalPermission(
      organizationId,
      userRoleId,
      domain,
      action,
    );
  }

  /**
   * Set or update a resource-level ACL
   */
  async setResourceAcl({
    organizationId,
    resourceType,
    resourceId,
    granteeType,
    granteeId,
    permissions,
    grantedBy,
  }) {
    // Issue #2570 — an unscoped upsert would write an ACL row into no
    // organization at all.
    if (!organizationId) {
      throw new Error("Organization context is required to set a resource ACL");
    }

    // `granteeType` is part of the identity of a grant: without it a USER
    // grant and a ROLE grant sharing an id overwrite each other.
    return await ResourceAcl.findOneAndUpdate(
      {
        organizationId,
        resourceType,
        resourceId,
        granteeType,
        granteeId,
      },
      {
        organizationId,
        resourceType,
        resourceId,
        granteeType,
        granteeId,
        permissions,
        grantedBy,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
}

export default new RbacMatrixService();
