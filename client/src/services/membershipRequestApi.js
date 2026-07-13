import apiClient from "./apiClient";

export const membershipRequestApi = {
  // Get organization membership requests with search, filter, pagination, and sorting
  getOrganizationRequests: (organizationId, params = {}) =>
    apiClient.get(`/api/membership-requests/organization/${organizationId}`, {
      params,
    }),

  // Get user's membership requests
  getUserRequests: () => apiClient.get("/api/membership-requests/user"),

  // Create membership request
  createRequest: (data) => apiClient.post("/api/membership-requests", data),

  // Approve membership request
  approveRequest: (requestId, reviewNotes) =>
    apiClient.patch(`/api/membership-requests/${requestId}/approve`, {
      reviewNotes,
    }),

  // Reject membership request
  rejectRequest: (requestId, reviewNotes) =>
    apiClient.patch(`/api/membership-requests/${requestId}/reject`, {
      reviewNotes,
    }),

  // Cancel membership request
  cancelRequest: (requestId) =>
    apiClient.patch(`/api/membership-requests/${requestId}/cancel`),

  // Bulk approve membership requests
  bulkApproveRequests: (requestIds, reviewNotes) =>
    apiClient.post("/api/membership-requests/bulk-approve", {
      requestIds,
      reviewNotes,
    }),

  // Bulk reject membership requests
  bulkRejectRequests: (requestIds, reviewNotes) =>
    apiClient.post("/api/membership-requests/bulk-reject", {
      requestIds,
      reviewNotes,
    }),
};
/**
 * Membership Request API Service
 * Handles all membership request operations
 */

export const membershipRequestApi = {
  /**
   * Create a membership request
   * @param {Object} data - { organizationId, message? }
   * @returns {Promise} API response
   */
  createRequest: async (data) => {
    const response = await apiClient.post("/api/membership-request", data);
    return response.data;
  },

  /**
   * Get membership requests for an organization (admin/owner only)
   * @param {string} organizationId - Organization ID
   * @param {string} status - Optional status filter (pending, approved, rejected, cancelled)
   * @returns {Promise} API response
   */
  getOrganizationRequests: async (organizationId, status) => {
    const params = status ? { status } : {};
    const response = await apiClient.get(
      `/api/membership-request/organization/${organizationId}`,
      { params }
    );
    return response.data;
  },

  /**
   * Get current user's membership requests
   * @returns {Promise} API response
   */
  getUserRequests: async () => {
    const response = await apiClient.get("/api/membership-request/user");
    return response.data;
  },

  /**
   * Approve a membership request (admin/owner only)
   * @param {string} requestId - Membership request ID
   * @param {Object} data - { reviewNotes? }
   * @returns {Promise} API response
   */
  approveRequest: async (requestId, data = {}) => {
    const response = await apiClient.patch(
      `/api/membership-request/${requestId}/approve`,
      data
    );
    return response.data;
  },

  /**
   * Reject a membership request (admin/owner only)
   * @param {string} requestId - Membership request ID
   * @param {Object} data - { reviewNotes? }
   * @returns {Promise} API response
   */
  rejectRequest: async (requestId, data = {}) => {
    const response = await apiClient.patch(
      `/api/membership-request/${requestId}/reject`,
      data
    );
    return response.data;
  },

  /**
   * Cancel a membership request (requester only)
   * @param {string} requestId - Membership request ID
   * @returns {Promise} API response
   */
  cancelRequest: async (requestId) => {
    const response = await apiClient.patch(
      `/api/membership-request/${requestId}/cancel`
    );
    return response.data;
  },
};

export default membershipRequestApi;
