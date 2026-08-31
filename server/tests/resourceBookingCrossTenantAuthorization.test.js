/**
 * Issue #2571 — Physical resource / booking routes must never trust
 * `:organizationId`, `:resourceId`, `:bookingId` or a body `organizationId`
 * supplied by the client.
 *
 * These tests exercise the real route → controller → service → model stack
 * against an in-memory MongoDB; only authentication is stubbed. Every case
 * below was exploitable before the fix:
 *
 *   - GET  /organization/<org B>                 → org B's rooms/equipment
 *   - POST /organization/<org B>                 → resource created in org B
 *   - POST /organization/<org B>/bookings        → booking inside org B
 *   - POST /bookings/create { organizationId }   → booking inside org B
 *   - DELETE /bookings/<any booking id>          → cancel any tenant's booking
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

const { default: resourceBookingRoutes } =
  await import("../routes/resourceBookingRoutes.js");
const PhysicalResource = (await import("../models/physicalResourceModel.js"))
  .default;
const ResourceBooking = (await import("../models/resourceBookingModel.js"))
  .default;
// getOrganizationBookings populates `userId`; the User schema has to be
// registered for that populate to resolve (MissingSchemaError → 500 otherwise).
await import("../models/userModel.js");

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();
const SHARED_MEETING_ID = new mongoose.Types.ObjectId();

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
let orgAResource;
let orgBResource;
let orgABooking;
let orgBBooking;

const slot = (hourOffset) => ({
  startTime: new Date(Date.now() + hourOffset * 60 * 60 * 1000),
  endTime: new Date(Date.now() + (hourOffset + 1) * 60 * 60 * 1000),
});

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(
      `${process.env.TEST_MONGODB_URI}/resource_booking_2571`,
    );
  }

  app = express();
  app.use(express.json());
  app.use("/api/physical-resources", resourceBookingRoutes);
});

beforeEach(async () => {
  currentUser = memberOfOrgA;

  await PhysicalResource.deleteMany({});
  await ResourceBooking.deleteMany({});

  orgAResource = await PhysicalResource.create({
    name: "Org A Room",
    type: "room",
    organization: ORG_A,
  });
  orgBResource = await PhysicalResource.create({
    name: "Org B Room",
    type: "room",
    organization: ORG_B,
  });

  orgABooking = await ResourceBooking.create({
    resourceId: orgAResource._id,
    organization: ORG_A,
    userId: memberOfOrgA._id,
    title: "Org A booking",
    meetingId: SHARED_MEETING_ID,
    ...slot(1),
  });
  orgBBooking = await ResourceBooking.create({
    resourceId: orgBResource._id,
    organization: ORG_B,
    userId: memberOfOrgA._id,
    title: "Org B booking",
    meetingId: SHARED_MEETING_ID,
    ...slot(1),
  });
});

describe("physical resources cross-tenant scoping (#2571)", () => {
  it("lists the caller's own organization resources", async () => {
    const res = await request(app).get(
      `/api/physical-resources/organization/${ORG_A.toString()}`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Org A Room");
  });

  it("rejects listing another organization's resources", async () => {
    const res = await request(app).get(
      `/api/physical-resources/organization/${ORG_B.toString()}`,
    );

    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain("Org B Room");
  });

  it("rejects a malformed organization id with 400", async () => {
    const res = await request(app).get(
      "/api/physical-resources/organization/not-an-id",
    );

    expect(res.status).toBe(400);
  });

  it("rejects creating a resource inside another organization", async () => {
    const res = await request(app)
      .post(`/api/physical-resources/organization/${ORG_B.toString()}`)
      .send({ name: "Injected Room", type: "room" });

    expect(res.status).toBe(403);
    expect(
      await PhysicalResource.countDocuments({
        organization: ORG_B,
        name: "Injected Room",
      }),
    ).toBe(0);
  });

  it("ignores a client-supplied organization in the body", async () => {
    const res = await request(app)
      .post(`/api/physical-resources/organization/${ORG_A.toString()}`)
      .send({
        name: "Honest Room",
        type: "room",
        organization: ORG_B.toString(),
      });

    expect(res.status).toBe(201);
    expect(String(res.body.organization)).toBe(ORG_A.toString());
  });

  it("rejects deleting another organization's resource", async () => {
    const res = await request(app).delete(
      `/api/physical-resources/${orgBResource._id.toString()}`,
    );

    expect(res.status).toBe(403);
    expect(await PhysicalResource.findById(orgBResource._id)).not.toBeNull();
  });

  it("deletes the caller's own resource", async () => {
    const res = await request(app).delete(
      `/api/physical-resources/${orgAResource._id.toString()}`,
    );

    expect(res.status).toBe(200);
    expect(await PhysicalResource.findById(orgAResource._id)).toBeNull();
  });

  it("rejects availability lookups for another organization", async () => {
    const { startTime, endTime } = slot(10);
    const res = await request(app).get(
      `/api/physical-resources/organization/${ORG_B.toString()}/available?startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`,
    );

    expect(res.status).toBe(403);
  });
});

describe("bookings cross-tenant scoping (#2571)", () => {
  it("lists only the caller's organization bookings", async () => {
    const res = await request(app).get(
      `/api/physical-resources/organization/${ORG_A.toString()}/bookings`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("Org A booking");
  });

  it("rejects listing another organization's bookings", async () => {
    const res = await request(app).get(
      `/api/physical-resources/organization/${ORG_B.toString()}/bookings`,
    );

    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain("Org B booking");
  });

  it("rejects booking another organization's resource through the path", async () => {
    const { startTime, endTime } = slot(20);
    const res = await request(app)
      .post(`/api/physical-resources/organization/${ORG_B.toString()}/bookings`)
      .send({
        resourceId: orgBResource._id.toString(),
        startTime,
        endTime,
      });

    expect(res.status).toBe(403);
  });

  it("rejects booking another organization's resource by id", async () => {
    const { startTime, endTime } = slot(22);
    const res = await request(app)
      .post("/api/physical-resources/bookings/create")
      .send({
        resourceId: orgBResource._id.toString(),
        startTime,
        endTime,
      });

    expect(res.status).toBe(403);
    expect(
      await ResourceBooking.countDocuments({
        organization: ORG_B,
        resourceId: orgBResource._id,
      }),
    ).toBe(1); // only the seeded booking
  });

  it("stamps the caller's organization on bookings, ignoring the body value", async () => {
    const { startTime, endTime } = slot(24);
    const res = await request(app)
      .post("/api/physical-resources/bookings/create")
      .send({
        resourceId: orgAResource._id.toString(),
        startTime,
        endTime,
        organizationId: ORG_B.toString(),
      });

    expect(res.status).toBe(201);
    expect(String(res.body.organization)).toBe(ORG_A.toString());
  });

  it("books a resource of the caller's own organization", async () => {
    const { startTime, endTime } = slot(26);
    const res = await request(app)
      .post(`/api/physical-resources/organization/${ORG_A.toString()}/bookings`)
      .send({
        resourceId: orgAResource._id.toString(),
        startTime,
        endTime,
        title: "Team sync",
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Team sync");
    expect(String(res.body.organization)).toBe(ORG_A.toString());
  });

  it("rejects cancelling another organization's booking", async () => {
    const res = await request(app).delete(
      `/api/physical-resources/bookings/${orgBBooking._id.toString()}`,
    );

    expect(res.status).toBe(403);
    expect(await ResourceBooking.findById(orgBBooking._id)).not.toBeNull();
  });

  it("cancels the caller's own booking", async () => {
    const res = await request(app).delete(
      `/api/physical-resources/bookings/${orgABooking._id.toString()}`,
    );

    expect(res.status).toBe(200);
    expect(await ResourceBooking.findById(orgABooking._id)).toBeNull();
  });

  it("rejects cancelling a booking with a malformed id", async () => {
    const res = await request(app).delete(
      "/api/physical-resources/bookings/not-an-id",
    );

    expect(res.status).toBe(400);
  });

  it("rejects reading bookings of another organization's resource", async () => {
    const res = await request(app).get(
      `/api/physical-resources/resource/${orgBResource._id.toString()}/bookings`,
    );

    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain("Org B booking");
  });

  it("scopes meeting bookings to the caller's organization", async () => {
    const res = await request(app).get(
      `/api/physical-resources/meetings/${SHARED_MEETING_ID.toString()}/bookings`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("Org A booking");
  });

  it("rejects a caller without an organization membership", async () => {
    currentUser = userWithoutOrganization;

    const res = await request(app).get(
      `/api/physical-resources/organization/${ORG_A.toString()}`,
    );

    expect(res.status).toBe(403);
  });
});
