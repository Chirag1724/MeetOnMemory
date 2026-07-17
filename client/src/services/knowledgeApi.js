import apiClient from "./apiClient";

export const knowledgeApi = {
  getActionItems: (status = "all") =>
    apiClient.get(`/api/knowledge/action-items?status=${status}`),
  getDecisionLineage: (decisionId) =>
    apiClient.get(`/api/knowledge/decisions/${decisionId}/lineage`),
  // Memory Consolidation Engine
  runConsolidation: ({ dryRun = true, models } = {}) =>
    apiClient.post(`/api/knowledge/consolidate`, {
      dryRun,
      ...(models ? { models } : {}),
    }),
  getConsolidationHistory: (model = "decision", limit = 50) =>
    apiClient.get(
      `/api/knowledge/consolidation/history?model=${model}&limit=${limit}`,
    ),
};
