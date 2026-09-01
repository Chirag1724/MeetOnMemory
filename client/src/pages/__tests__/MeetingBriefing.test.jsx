import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import MeetingBriefing from "../MeetingBriefing.jsx";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar">Navbar</div>,
}));

describe("MeetingBriefing Distribution Flow Component Suite (#2468)", () => {
  const dummyBriefing = {
    title: "Strategic Quarterly Sync",
    content: "Review fiscal velocity targets and cross-functional alignment.",
    suggestedQuestions: ["What are our top blockers for Q4 deliverables?"],
    openActionItems: [
      { text: "Prepare revenue forecast model", owner: "Alex" },
    ],
    relatedPastMeetings: [
      { title: "Q3 Business Review", summary: "Reviewed Q3 growth metrics" },
    ],
  };

  beforeEach(() => {
    globalThis.fetch = vi.fn();
    window.confirm = vi.fn();
    window.print = vi.fn();
    window.alert = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Should cancel briefing regeneration if user declines confirmation popup", () => {
    window.confirm.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={["/meeting/meet_999/briefing"]}>
        <Routes>
          <Route
            path="/meeting/:id/briefing"
            element={<MeetingBriefing initialBriefing={dummyBriefing} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    const regenerateBtn = screen.getByRole("button", { name: /regenerate/i });
    fireEvent.click(regenerateBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("Should execute share routing dispatch endpoint successfully on click", async () => {
    globalThis.fetch.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        message: "Briefing successfully emailed to all meeting participants!",
      }),
    });

    render(
      <MemoryRouter initialEntries={["/meeting/meet_999/briefing"]}>
        <Routes>
          <Route
            path="/meeting/:id/briefing"
            element={<MeetingBriefing initialBriefing={dummyBriefing} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    const shareBtn = screen.getByRole("button", {
      name: /share with attendees/i,
    });
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/meeting/meet_999/briefing/share",
        expect.any(Object),
      );
      expect(window.alert).toHaveBeenCalledWith(
        "Briefing successfully emailed to all meeting participants!",
      );
    });
  });

  it("Should regenerate briefing when user confirms popup", async () => {
    window.confirm.mockReturnValue(true);
    globalThis.fetch.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        briefing: {
          title: "Strategic Quarterly Sync - Refreshed",
          content: "Updated fiscal analysis context.",
        },
      }),
    });

    render(
      <MemoryRouter initialEntries={["/meeting/meet_999/briefing"]}>
        <Routes>
          <Route
            path="/meeting/:id/briefing"
            element={<MeetingBriefing initialBriefing={dummyBriefing} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    const regenerateBtn = screen.getByRole("button", { name: /regenerate/i });
    fireEvent.click(regenerateBtn);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/meeting/meet_999/briefing/regenerate",
        expect.any(Object),
      );
      expect(
        screen.getByText("Strategic Quarterly Sync - Refreshed"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Updated fiscal analysis context."),
      ).toBeInTheDocument();
    });
  });

  it("Should trigger window.print when Export PDF is clicked", () => {
    render(
      <MemoryRouter initialEntries={["/meeting/meet_999/briefing"]}>
        <Routes>
          <Route
            path="/meeting/:id/briefing"
            element={<MeetingBriefing initialBriefing={dummyBriefing} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    const exportBtn = screen.getByRole("button", { name: /export pdf/i });
    fireEvent.click(exportBtn);

    expect(window.print).toHaveBeenCalledTimes(1);
  });
});
