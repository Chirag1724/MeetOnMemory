import express from "express";
import {
  getPhysicalResources,
  createPhysicalResource,
  deletePhysicalResource,
  getAvailableResources,
  createBooking,
  cancelBooking,
  getResourceBookings,
  getOrganizationBookings,
  getMeetingBookings,
} from "../controllers/resourceBookingController.js";
import protect from "../middleware/userAuth.js";
import { requireOrganizationParamMatch } from "../middleware/rbac.js";

const router = express.Router();

router.use(protect);

// Issue #2571 — every route carrying `:organizationId` must prove the path
// value is the caller's own membership organization before the handler runs.
// `protect` (userAuth) only proves the caller is *somebody*; handlers used to
// read the path param straight into their queries, so any authenticated user
// could list another tenant's rooms, create resources inside it, and book
// them. Controllers now query with `req.authorizedOrganizationId`; the
// id-only routes (resource/booking/meeting) verify document ownership
// server-side and return 403 on a cross-tenant id.
router.get(
  "/organization/:organizationId",
  requireOrganizationParamMatch("organizationId"),
  getPhysicalResources,
);
router.get(
  "/organization/:organizationId/resources",
  requireOrganizationParamMatch("organizationId"),
  getPhysicalResources,
);
router.post(
  "/organization/:organizationId",
  requireOrganizationParamMatch("organizationId"),
  createPhysicalResource,
);
router.post(
  "/organization/:organizationId/resources",
  requireOrganizationParamMatch("organizationId"),
  createPhysicalResource,
);
router.delete(
  "/organization/:organizationId/resource/:resourceId",
  requireOrganizationParamMatch("organizationId"),
  deletePhysicalResource,
);
router.delete("/:resourceId", deletePhysicalResource);

// Resource availability & calendar timeline
router.get(
  "/organization/:organizationId/available",
  requireOrganizationParamMatch("organizationId"),
  getAvailableResources,
);
router.get(
  "/organization/:organizationId/bookings",
  requireOrganizationParamMatch("organizationId"),
  getOrganizationBookings,
);
router.get("/resource/:resourceId/bookings", getResourceBookings);
router.get("/:resourceId/bookings", getResourceBookings);

// Bookings creation and cancellation
router.post(
  "/organization/:organizationId/bookings",
  requireOrganizationParamMatch("organizationId"),
  createBooking,
);
router.post("/bookings/create", createBooking);
router.post("/bookings", createBooking);
router.delete("/bookings/:bookingId", cancelBooking);
router.post("/bookings/:bookingId/cancel", cancelBooking);
router.delete("/:bookingId/cancel", cancelBooking);

// Meeting specific bookings
router.get("/meetings/:meetingId/bookings", getMeetingBookings);

export default router;
