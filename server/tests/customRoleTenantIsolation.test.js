/**
 * Issue #2570 — Custom Roles / Resource-ACL.
 *
 * The router is mounted under /api/custom-roles in routes/index.js (asserted in
 * routeRegistration.test.js). These tests cover the tenant handling of the
 * handlers themselves: the organization must come from the authenticated
 * session, never from the `x-organization-id` request header, and a request
 * without a resolvable organization must never become an unscoped query.
 *
 * Real route → controller → service → model stack against an in-memory
 * MongoDB; only `userAuth` is stubbed.
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";

let currentUser = null;

jest.unstable_mockModule("../middleware/userAuth.js", () => ({
  default: (req, res, next) => {
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    req.user = currentUser;
    next();
  },
}));

const { default: customRoleRoutes } =
  await import("../routes/customRoleRoutes.js");
const CustomRole = (await import("../models/customRoleModel.js")).default;
const ResourceAcl = (await import("../models/resourceAclModel.js")).default;

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();
const RESOURCE_ID = new mongoose.Types.ObjectId();

const adminOfOrgA = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "admin",
};

const memberOfOrgA = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "member",
};

const userWithoutOrganization = {
  _id: new mongoose.Types.ObjectId(),
  organization: null,
  role: "admin",
};

let app;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(`${process.env.TEST_MONGODB_URI}/custom_roles_2570`);
  }

  app = express();
  app.use(express.json());
  app.use("/api/custom-roles", customRoleRoutes);
});

beforeEach(async () => {
  currentUser = adminOfOrgA;
  await CustomRole.deleteMany({});
  await ResourceAcl.deleteMany({});
});

describe("custom roles tenant resolution (#2570)", () => {
  it("returns only the caller's organization roles", async () => {
    await CustomRole.create({ organizationId: ORG_A, name: "Org A role" });
    await CustomRole.create({ organizationId: ORG_B, name: "Org B role" });

    const res = await request(app).get("/api/custom-roles/roles");

    expect(res.status).toBe(200);
    expect(res.body.roles).toHaveLength(1);
    expect(res.body.roles[0].name).toBe("Org A role");
  });

  it("ignores the x-organization-id header", async () => {
    await CustomRole.create({ organizationId: ORG_A, name: "Org A role" });
    await CustomRole.create({ organizationId: ORG_B, name: "Org B role" });

    const res = await request(app)
      .get("/api/custom-roles/roles")
      .set("x-organization-id", ORG_B.toString());

    expect(res.status).toBe(200);
    expect(res.body.roles).toHaveLength(1);
    expect(res.body.roles[0].name).toBe("Org A role");
    expect(JSON.stringify(res.body)).not.toContain("Org B role");
  });

  it("rejects a caller without an organization instead of querying unscoped", async () => {
    await CustomRole.create({ organizationId: ORG_A, name: "Org A role" });
    currentUser = userWithoutOrganization;

    const res = await request(app)
      .get("/api/custom-roles/roles")
      .set("x-organization-id", ORG_A.toString());

    expect(res.status).toBe(403);
    expect(res.body.roles).toBeUndefined();
  });

  it("requires an administrative permission to create a role", async () => {
    currentUser = memberOfOrgA;

    const res = await request(app)
      .post("/api/custom-roles/roles")
      .send({ name: "Member role" });

    expect(res.status).toBe(403);
    expect(await CustomRole.countDocuments({ name: "Member role" })).toBe(0);
  });

  it("stamps the caller's organization on the role, ignoring body and header", async () => {
    const res = await request(app)
      .post("/api/custom-roles/roles")
      .set("x-organization-id", ORG_B.toString())
      .send({ name: "Admin role", organizationId: ORG_B.toString() });

    expect(res.status).toBe(201);
    expect(String(res.body.role.organizationId)).toBe(ORG_A.toString());
  });
});

describe("resource ACL tenant resolution (#2570)", () => {
  it("requires an administrative permission to write an ACL", async () => {
    currentUser = memberOfOrgA;

    const res = await request(app)
      .post("/api/custom-roles/acl")
      .send({
        resourceType: "MEETING",
        resourceId: RESOURCE_ID.toString(),
        granteeType: "USER",
        granteeId: adminOfOrgA._id.toString(),
        permissions: ["READ"],
      });

    expect(res.status).toBe(403);
    expect(await ResourceAcl.countDocuments({})).toBe(0);
  });

  it("writes the ACL into the caller's organization", async () => {
    const res = await request(app)
      .post("/api/custom-roles/acl")
      .set("x-organization-id", ORG_B.toString())
      .send({
        resourceType: "MEETING",
        resourceId: RESOURCE_ID.toString(),
        granteeType: "USER",
        granteeId: adminOfOrgA._id.toString(),
        permissions: ["READ"],
        organizationId: ORG_B.toString(),
      });

    expect(res.status).toBe(200);
    expect(String(res.body.acl.organizationId)).toBe(ORG_A.toString());
  });

  it("keeps USER and ROLE grants for the same granteeId separate", async () => {
    await request(app)
      .post("/api/custom-roles/acl")
      .send({
        resourceType: "MEETING",
        resourceId: RESOURCE_ID.toString(),
        granteeType: "USER",
        granteeId: adminOfOrgA._id.toString(),
        permissions: ["READ"],
      });

    await request(app)
      .post("/api/custom-roles/acl")
      .send({
        resourceType: "MEETING",
        resourceId: RESOURCE_ID.toString(),
        granteeType: "ROLE",
        granteeId: adminOfOrgA._id.toString(),
        permissions: ["WRITE"],
      });

    const grants = await ResourceAcl.find({
      organizationId: ORG_A,
      resourceId: RESOURCE_ID,
    }).lean();

    expect(grants).toHaveLength(2);
    expect(grants.map((g) => g.granteeType).sort()).toEqual(["ROLE", "USER"]);
  });

  it("evaluates permissions against the caller's organization only", async () => {
    // A grant in org B for this same user must not grant access in org A.
    await ResourceAcl.create({
      organizationId: ORG_B,
      resourceType: "MEETING",
      resourceId: RESOURCE_ID,
      granteeType: "USER",
      granteeId: adminOfOrgA._id,
      permissions: ["READ"],
    });

    const res = await request(app)
      .get("/api/custom-roles/check-permission")
      .query({
        resourceType: "MEETING",
        resourceId: RESOURCE_ID.toString(),
        requiredPermission: "READ",
      });

    expect(res.status).toBe(200);
    expect(res.body.hasAccess).toBe(false);
  });

  it("honours a grant inside the caller's own organization", async () => {
    await ResourceAcl.create({
      organizationId: ORG_A,
      resourceType: "MEETING",
      resourceId: RESOURCE_ID,
      granteeType: "USER",
      granteeId: adminOfOrgA._id,
      permissions: ["READ"],
    });

    const res = await request(app)
      .get("/api/custom-roles/check-permission")
      .query({
        resourceType: "MEETING",
        resourceId: RESOURCE_ID.toString(),
        requiredPermission: "READ",
      });

    expect(res.status).toBe(200);
    expect(res.body.hasAccess).toBe(true);
  });

  it("rejects a permission check with no resolvable organization", async () => {
    currentUser = userWithoutOrganization;

    const res = await request(app)
      .get("/api/custom-roles/check-permission")
      .set("x-organization-id", ORG_A.toString())
      .query({
        resourceType: "MEETING",
        resourceId: RESOURCE_ID.toString(),
        requiredPermission: "READ",
      });

    expect(res.status).toBe(403);
    expect(res.body.hasAccess).toBeUndefined();
  });
});
