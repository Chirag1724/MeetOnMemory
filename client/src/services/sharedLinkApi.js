import apiClient from "./apiClient";

export const sharedLinkApi = {
  createLink: (data) => apiClient.post("/api/shared-links", data),
  getActiveLinks: (resourceType, resourceId) =>
    apiClient.get(`/api/shared-links/${resourceType}/${resourceId}`),
  revokeLink: (id) => apiClient.delete(`/api/shared-links/${id}`),
};

export const publicSharedApi = {
  verifyPasscode: (hash, data, config) =>
    apiClient.post(`/api/public/shared/${hash}/verify`, data, config),
  getPublicResource: (hash, config) =>
    apiClient.get(`/api/public/shared/${hash}`, config),
};
