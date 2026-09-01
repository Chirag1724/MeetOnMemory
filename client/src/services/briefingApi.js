import api from "./apiClient.js";

export const generateBriefing = async (meetingId) => {
  const response = await api.post(`/api/briefings/${meetingId}/generate`);
  return response.data;
};

export const regenerateBriefing = async (meetingId) => {
  const response = await api.post(`/api/briefings/${meetingId}/regenerate`);
  return response.data;
};

export const shareBriefing = async (meetingId) => {
  const response = await api.post(`/api/briefings/${meetingId}/share`);
  return response.data;
};

export const getBriefing = async (meetingId) => {
  const response = await api.get(`/api/briefings/${meetingId}`);
  return response.data;
};
