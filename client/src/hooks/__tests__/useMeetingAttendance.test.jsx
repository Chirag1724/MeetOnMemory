import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useMeetingAttendance from "../useMeetingAttendance";
import api from "../../services/apiClient";

vi.mock("../../services/apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe("useMeetingAttendance (#2623) — /api prefix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchAttendance uses /api prefix", async () => {
    api.get.mockResolvedValue({ data: [] });
    renderHook(() => useMeetingAttendance("m1"));

    // useEffect calls fetchAttendance automatically on mount
    await act(async () => {
      await Promise.resolve(); // wait for fetchAttendance to complete
    });

    expect(api.get).toHaveBeenCalledWith("/api/meetings/m1/attendance");
  });

  it("checkIn uses /api prefix", async () => {
    api.get.mockResolvedValue({ data: [] });
    api.post.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useMeetingAttendance("m2"));

    await act(async () => {
      await result.current.checkIn("test@example.com", "2026-08-31");
    });

    expect(api.post).toHaveBeenCalledWith(
      "/api/meetings/m2/attendance/checkin",
      {
        email: "test@example.com",
        joinTime: "2026-08-31",
      },
    );
  });

  it("checkOut uses /api prefix", async () => {
    api.get.mockResolvedValue({ data: [] });
    api.post.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useMeetingAttendance("m3"));

    await act(async () => {
      await result.current.checkOut("test@example.com", "2026-08-31");
    });

    expect(api.post).toHaveBeenCalledWith(
      "/api/meetings/m3/attendance/checkout",
      {
        email: "test@example.com",
        leaveTime: "2026-08-31",
      },
    );
  });

  it("markExcused uses /api prefix", async () => {
    api.get.mockResolvedValue({ data: [] });
    api.put.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useMeetingAttendance("m4"));

    await act(async () => {
      await result.current.markExcused("test@example.com");
    });

    expect(api.put).toHaveBeenCalledWith("/api/meetings/m4/attendance/excuse", {
      email: "test@example.com",
    });
  });

  it("finalizeAttendance uses /api prefix", async () => {
    api.get.mockResolvedValue({ data: [] });
    api.post.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useMeetingAttendance("m5"));

    await act(async () => {
      await result.current.finalizeAttendance();
    });

    expect(api.post).toHaveBeenCalledWith(
      "/api/meetings/m5/attendance/finalize",
    );
  });
});
