import { describe, it, expect, vi, beforeEach } from "vitest";
import { debriefQAApi } from "../debriefQAApi";
import apiClient from "../../services/apiClient";

vi.mock("../../services/apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("debriefQAApi (#2623) — /api prefix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("askQuestion uses /api prefix", async () => {
    apiClient.post.mockResolvedValue({ data: { success: true } });
    await debriefQAApi.askQuestion("m1", "What went well?");

    expect(apiClient.post).toHaveBeenCalledWith("/api/debrief/session", {
      meetingId: "m1",
      question: "What went well?",
    });
  });

  it("getSession uses /api prefix", async () => {
    apiClient.get.mockResolvedValue({ data: { id: "s1" } });
    await debriefQAApi.getSession("m2");

    expect(apiClient.get).toHaveBeenCalledWith("/api/debrief/session/m2");
  });
});
