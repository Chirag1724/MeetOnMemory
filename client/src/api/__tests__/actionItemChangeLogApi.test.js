import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchChangeLogs,
  fetchChangeLogStats,
} from "../actionItemChangeLogApi";
import api from "../../services/apiClient";

vi.mock("../../services/apiClient", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("actionItemChangeLogApi (#2623) — /api prefix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchChangeLogs uses /api prefix", async () => {
    api.get.mockResolvedValue({ data: [] });
    await fetchChangeLogs("item1", { page: 1, limit: 10 });

    expect(api.get).toHaveBeenCalledWith("/api/action-items/item1/changelog", {
      params: { page: 1, limit: 10 },
    });
  });

  it("fetchChangeLogStats uses /api prefix", async () => {
    api.get.mockResolvedValue({ data: {} });
    await fetchChangeLogStats("item2");

    expect(api.get).toHaveBeenCalledWith(
      "/api/action-items/item2/changelog/stats",
    );
  });
});
