import api from "./apiClient.js";

const ICEBREAKER_URL = "/api/icebreakers";

/**
 * Icebreaker API client (Issue #2622).
 *
 * All paths are prefixed with /api so they reach the Express router which
 * mounts icebreakerRoutes under /api/icebreakers.  Earlier callers used
 * /icebreakers/* (no /api prefix) which 404'd on every request.
 */
const icebreakerApi = {
  /**
   * Generate an icebreaker question for a meeting during scheduling.
   * @param {string} meetingId - The meeting ID
   * @returns {Promise<Object>} Response data containing the generated question
   */
  generate: (meetingId) =>
    api.post(`${ICEBREAKER_URL}/generate`, { meetingId }),

  /**
   * Select / confirm a specific icebreaker question for a meeting.
   * @param {string} meetingId - The meeting ID
   * @param {string} question  - The selected icebreaker question text
   * @returns {Promise<Object>} Response data
   */
  select: (meetingId, question) =>
    api.post(`${ICEBREAKER_URL}/select`, { meetingId, question }),

  /**
   * Fetch the active icebreaker for a live meeting room.
   * @param {string} meetingId - The meeting ID
   * @returns {Promise<Object>} Response data containing the icebreaker question
   */
  getForMeeting: (meetingId) =>
    api.get(`${ICEBREAKER_URL}/meeting/${meetingId}`),
};

export default icebreakerApi;

export const generateIcebreakers = async (meetingId, participantIds = []) => {
  const response = await api.post("/api/icebreakers/generate", {
    meetingId,
    participantIds,
  });
  return response.data; // { icebreakers: [...] }
};

export const selectIcebreaker = async (meetingId, category, promptText) => {
  const response = await api.post("/api/icebreakers/select", {
    meetingId,
    category,
    promptText,
  });
  return response.data;
};
