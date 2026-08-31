import resourceBookingService from "../services/resourceBookingService.js";
import PhysicalResource from "../models/physicalResourceModel.js";
import ResourceBooking from "../models/resourceBookingModel.js";
import {
  isSameOrganization,
  resolveAuthorizedOrganizationId,
} from "../utils/organizationScope.js";

/**
 * Issue #2571 — the organization every handler works with is the one the
 * middleware proved belongs to the caller, never `req.params.organizationId`
 * (and never a client-supplied `req.body.organizationId`).
 *
 * `requireOrganizationParamMatch` sets `req.authorizedOrganizationId` on the
 * `/organization/:organizationId` routes; the id-only routes fall back to the
 * caller's membership organization and then verify the referenced document
 * belongs to it.
 */
const resolveOrganizationId = (req) => resolveAuthorizedOrganizationId(req);

/** 403 envelope used when the caller has no organization membership. */
const membershipRequired = (res) =>
  res.status(403).json({
    success: false,
    message: "Forbidden: Organization membership required",
  });

/** 403 envelope used when a referenced document lives in another tenant. */
const crossTenantForbidden = (res) =>
  res.status(403).json({
    success: false,
    message: "Forbidden: You don't have access to this resource",
  });

const isInvalidId = (id) => !id || !/^[0-9a-fA-F]{24}$/.test(String(id));

/**
 * Loads a tenant document by id and proves it belongs to the caller's org.
 *
 * @returns {Promise<{doc: object|null, response: object|null}>} `response` is
 *   already-sent error response when the id is unknown or cross-tenant.
 */
const loadTenantDocument = async (model, id, organizationId, res) => {
  // A malformed ObjectId would otherwise make Mongoose throw a CastError on
  // findById and surface as a 500 for what is a client input error.
  if (isInvalidId(id)) {
    return {
      doc: null,
      response: res.status(400).json({ success: false, message: "Invalid id" }),
    };
  }

  const doc = await model.findById(id);
  if (!doc) {
    return {
      doc: null,
      response: res.status(404).json({ message: "Resource not found" }),
    };
  }

  if (!isSameOrganization(doc.organization, organizationId)) {
    return { doc: null, response: crossTenantForbidden(res) };
  }

  return { doc, response: null };
};

// Fetch physical resources for an organization
export const getPhysicalResources = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);

    if (!organizationId) {
      return membershipRequired(res);
    }

    const resources =
      await resourceBookingService.getPhysicalResources(organizationId);
    return res.status(200).json(resources);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch physical resources",
      error: error.message,
    });
  }
};

// Create a physical resource
export const createPhysicalResource = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);

    if (!organizationId) {
      return membershipRequired(res);
    }

    // The organization comes from the caller's membership, never from the
    // body: a crafted `organization` field used to create resources inside
    // another tenant.
    const { organization: _ignoredOrganization, ...resourceData } =
      req.body || {};
    const resource = await resourceBookingService.createPhysicalResource({
      ...resourceData,
      organization: organizationId,
    });
    return res.status(201).json(resource);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create physical resource",
      error: error.message,
    });
  }
};

// Delete a physical resource
export const deletePhysicalResource = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return membershipRequired(res);
    }

    const resourceId = req.params.resourceId || req.params.id;
    if (!resourceId) {
      return res.status(400).json({ message: "Resource ID is required" });
    }

    const { response } = await loadTenantDocument(
      PhysicalResource,
      resourceId,
      organizationId,
      res,
    );
    if (response) return response;

    await resourceBookingService.deletePhysicalResource(resourceId);
    return res
      .status(200)
      .json({ message: "Physical resource deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to delete physical resource",
      error: error.message,
    });
  }
};

// Get available resources for a specific time window
export const getAvailableResources = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const { startTime, endTime, type } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        message: "startTime and endTime are required query parameters",
      });
    }

    if (!organizationId) {
      return membershipRequired(res);
    }

    const availableResources =
      await resourceBookingService.getAvailableResources(
        organizationId,
        new Date(startTime),
        new Date(endTime),
        type,
      );
    return res.status(200).json(availableResources);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch available resources",
      error: error.message,
    });
  }
};

// Create a resource booking with strict overlapping interval protection & conflict suggestions
export const createBooking = async (req, res) => {
  try {
    const { resourceId, meetingId, startTime, endTime, title } = req.body || {};
    // Issue #2571: ignore req.body.organizationId — the tenant is the caller's
    // own organization, resolved server-side.
    const organizationId = resolveOrganizationId(req);

    if (!resourceId || !startTime || !endTime) {
      return res.status(400).json({
        message: "resourceId, startTime, and endTime are required",
      });
    }

    if (!organizationId) {
      return membershipRequired(res);
    }

    // The resource being booked must live in the caller's organization,
    // otherwise a member of org A could reserve org B's rooms by id.
    const { response } = await loadTenantDocument(
      PhysicalResource,
      resourceId,
      organizationId,
      res,
    );
    if (response) return response;

    const userId = req.user?._id || req.user?.id;

    const booking = await resourceBookingService.createBooking(
      resourceId,
      meetingId,
      startTime,
      endTime,
      organizationId,
      {
        userId,
        title: title || "Facility Reservation Event",
      },
    );

    return res.status(201).json(booking);
  } catch (error) {
    if (
      error.isConflict ||
      error.message ===
        "Resource is not available during the requested time." ||
      error.message ===
        "The requested resource is already reserved during this specific interval."
    ) {
      return res.status(409).json({
        error: "CONFLICT",
        message:
          error.message ||
          "The requested resource is already reserved during this specific interval.",
        conflictingBooking: error.conflictingBooking || null,
        suggestions: error.suggestions || [],
      });
    }
    return res.status(500).json({
      error: "Internal scheduling pipeline exception.",
      message: error.message,
    });
  }
};

// Get bookings for a specific resource
export const getResourceBookings = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return membershipRequired(res);
    }

    const resourceId = req.params.resourceId || req.params.id;
    const { startTime, endTime } = req.query;

    if (!resourceId) {
      return res.status(400).json({ message: "Resource ID is required" });
    }

    const { response } = await loadTenantDocument(
      PhysicalResource,
      resourceId,
      organizationId,
      res,
    );
    if (response) return response;

    const bookings = await resourceBookingService.getBookingsForResource(
      resourceId,
      startTime,
      endTime,
    );
    return res.status(200).json(bookings);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch resource bookings",
      error: error.message,
    });
  }
};

// Get all bookings for an organization
export const getOrganizationBookings = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);

    if (!organizationId) {
      return membershipRequired(res);
    }

    const bookings =
      await resourceBookingService.getOrganizationBookings(organizationId);
    return res.status(200).json(bookings);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch organization bookings",
      error: error.message,
    });
  }
};

// Cancel a resource booking
export const cancelBooking = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return membershipRequired(res);
    }

    const bookingId = req.params.bookingId || req.params.id;
    if (!bookingId) {
      return res.status(400).json({ message: "Booking ID is required" });
    }

    // Issue #2571: a raw :bookingId with no tenant check let any authenticated
    // user cancel any booking in the system.
    const { response } = await loadTenantDocument(
      ResourceBooking,
      bookingId,
      organizationId,
      res,
    );
    if (response) return response;

    const cancelled = await resourceBookingService.cancelBooking(
      bookingId,
      organizationId,
    );
    if (!cancelled) {
      return res.status(404).json({ message: "Booking not found" });
    }

    return res.status(200).json({ message: "Booking cancelled successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to cancel booking", error: error.message });
  }
};

// Get bookings for a specific meeting
export const getMeetingBookings = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return membershipRequired(res);
    }

    const { meetingId } = req.params;
    if (!meetingId) {
      return res.status(400).json({ message: "Meeting ID is required" });
    }

    // Scoped to the caller's organization so a meeting id from another tenant
    // cannot be used to enumerate its bookings.
    const bookings = await resourceBookingService.getBookingsForMeeting(
      meetingId,
      organizationId,
    );
    return res.status(200).json(bookings);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch meeting bookings",
      error: error.message,
    });
  }
};
