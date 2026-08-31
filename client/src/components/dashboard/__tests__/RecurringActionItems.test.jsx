import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RecurringActionItems from "../RecurringActionItems.jsx";
import useRecurringActionItems from "../../../hooks/useRecurringActionItems.js";

vi.mock("../../../hooks/useRecurringActionItems.js");
vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("RecurringActionItems Widget Mounting & Mutation Test Suite (#2443)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an empty state message when zero recurring action items exist", () => {
    vi.mocked(useRecurringActionItems).mockReturnValue({
      items: [],
      data: [],
      loading: false,
      isLoading: false,
      createItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      pauseItem: vi.fn(),
      completeItem: vi.fn(),
    });

    render(<RecurringActionItems />);

    expect(screen.getByText(/No recurring items found/i)).toBeInTheDocument();
  });

  it("mounts active action items and triggers the pause mutation on click", async () => {
    const mockPauseItem = vi.fn().mockResolvedValue({ success: true });
    const mockItems = [
      {
        id: "rec_1",
        _id: "rec_1",
        text: "Submit Weekly Progress Report",
        interval: "weekly",
        recurrencePattern: "weekly",
        isActive: true,
        isPaused: false,
        currentStreak: 3,
        totalCompleted: 5,
      },
    ];

    vi.mocked(useRecurringActionItems).mockReturnValue({
      items: mockItems,
      data: mockItems,
      loading: false,
      isLoading: false,
      createItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      pauseItem: mockPauseItem,
      completeItem: vi.fn(),
    });

    render(<RecurringActionItems />);

    // Assert the action item title text and streak are visible
    expect(
      screen.getByText("Submit Weekly Progress Report"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Streak: 3/i)).toBeInTheDocument();
    expect(screen.getByText("WEEKLY")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();

    // Select and trigger the specific pause mutation actuator button
    const pauseButton = screen.getByRole("button", { name: /pause/i });
    fireEvent.click(pauseButton);

    await waitFor(() => {
      expect(mockPauseItem).toHaveBeenCalledWith("rec_1");
    });
  });

  it("triggers create mutation when adding a new recurring action item", async () => {
    const mockCreateItem = vi.fn().mockResolvedValue({ success: true });

    vi.mocked(useRecurringActionItems).mockReturnValue({
      items: [],
      data: [],
      loading: false,
      isLoading: false,
      createItem: mockCreateItem,
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      pauseItem: vi.fn(),
      completeItem: vi.fn(),
    });

    render(<RecurringActionItems />);

    const addButton = screen.getByRole("button", {
      name: /Add Recurring Item/i,
    });
    fireEvent.click(addButton);

    // Modal opens
    expect(screen.getByText("Create Recurring Item")).toBeInTheDocument();

    const input = screen.getByPlaceholderText(
      /e\.g\. Submit weekly status update/i,
    );
    fireEvent.change(input, {
      target: { value: "Review sprint deliverables" },
    });

    const saveButton = screen.getByRole("button", { name: /Save Item/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockCreateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Review sprint deliverables",
          recurrencePattern: "weekly",
        }),
      );
    });
  });

  it("triggers delete mutation when deleting a recurring action item", async () => {
    const mockDeleteItem = vi.fn().mockResolvedValue({ success: true });
    const mockItems = [
      {
        id: "rec_delete_1",
        _id: "rec_delete_1",
        text: "Clean up project backlog",
        recurrencePattern: "monthly",
        isActive: true,
        currentStreak: 1,
      },
    ];

    vi.mocked(useRecurringActionItems).mockReturnValue({
      items: mockItems,
      data: mockItems,
      loading: false,
      isLoading: false,
      createItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: mockDeleteItem,
      pauseItem: vi.fn(),
      completeItem: vi.fn(),
    });

    render(<RecurringActionItems />);

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockDeleteItem).toHaveBeenCalledWith("rec_delete_1");
    });
  });
});
