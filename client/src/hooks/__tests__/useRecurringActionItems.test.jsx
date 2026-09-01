import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRecurringActionItems } from "../useRecurringActionItems.js";
import apiClient from "../../services/apiClient.js";

vi.mock("../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("useRecurringActionItems hook (#2443)", () => {
  let queryClient;

  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it("fetches recurring action items successfully", async () => {
    const mockItems = [
      {
        _id: "rec-1",
        text: "Weekly report",
        recurrencePattern: "weekly",
        isActive: true,
      },
    ];

    apiClient.get.mockResolvedValueOnce({ data: mockItems });

    const { result } = renderHook(() => useRecurringActionItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledWith("/api/recurring-action-items");
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].text).toBe("Weekly report");
  });

  it("creates a new recurring action item", async () => {
    apiClient.get.mockResolvedValueOnce({ data: [] });
    apiClient.post.mockResolvedValueOnce({
      data: {
        _id: "rec-new",
        text: "New task",
        recurrencePattern: "daily",
      },
    });

    const { result } = renderHook(() => useRecurringActionItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await act(async () => {
      await result.current.createItem({
        text: "New task",
        recurrencePattern: "daily",
      });
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/recurring-action-items",
      expect.objectContaining({
        text: "New task",
        recurrencePattern: "daily",
      }),
    );
  });

  it("pauses an active recurring action item", async () => {
    const mockItems = [
      {
        _id: "rec-1",
        text: "Weekly report",
        recurrencePattern: "weekly",
        isActive: true,
      },
    ];

    apiClient.get.mockResolvedValueOnce({ data: mockItems });
    apiClient.put.mockResolvedValueOnce({
      data: {
        _id: "rec-1",
        isActive: false,
      },
    });

    const { result } = renderHook(() => useRecurringActionItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await act(async () => {
      await result.current.pauseItem("rec-1");
    });

    expect(apiClient.put).toHaveBeenCalledWith(
      "/api/recurring-action-items/rec-1",
      expect.objectContaining({
        isActive: false,
        isPaused: true,
      }),
    );
  });

  it("deletes a recurring action item", async () => {
    const mockItems = [
      {
        _id: "rec-1",
        text: "Weekly report",
      },
    ];

    apiClient.get.mockResolvedValueOnce({ data: mockItems });
    apiClient.delete.mockResolvedValueOnce({
      data: { message: "Deleted successfully" },
    });

    const { result } = renderHook(() => useRecurringActionItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await act(async () => {
      await result.current.deleteItem("rec-1");
    });

    expect(apiClient.delete).toHaveBeenCalledWith(
      "/api/recurring-action-items/rec-1",
    );
  });
});
