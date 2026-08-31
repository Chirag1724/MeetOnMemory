import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import DecisionTrackingDashboard from "../DecisionTrackingDashboard.jsx";
import * as decisionLogApi from "../../services/decisionLogApi.js";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar">Navbar</div>,
}));

vi.mock("../DecisionCharts.jsx", () => ({
  DecisionTrendChart: () => (
    <div data-testid="mock-trend-chart">Trend Chart</div>
  ),
  ApprovalFunnelChart: () => (
    <div data-testid="mock-funnel-chart">Funnel Chart</div>
  ),
  CategoryBreakdownChart: () => (
    <div data-testid="mock-category-chart">Category Chart</div>
  ),
  ImpactAnalysisChart: () => (
    <div data-testid="mock-impact-chart">Impact Chart</div>
  ),
  DecisionVelocityChart: () => (
    <div data-testid="mock-velocity-chart">Velocity Chart</div>
  ),
  ImplementationSpeedChart: () => (
    <div data-testid="mock-impl-speed-chart">Speed Chart</div>
  ),
}));

describe("DecisionTrackingDashboard Component Suite (#2440)", () => {
  const mockAnalyticsData = {
    stats: {
      totalDecisions: 12,
      implementedCount: 8,
      pendingCount: 3,
      reversedCount: 1,
      deferredCount: 0,
      supersededCount: 0,
      implementationRate: 66.7,
      avgDaysToDecide: 4.2,
      avgDaysToImplement: 6.8,
      avgConfidence: 0.88,
    },
    trend: [
      {
        month: "2026-06",
        proposed: 4,
        approved: 3,
        implemented: 3,
        total: 4,
      },
    ],
    categoryData: [
      { category: "Architecture", count: 6, percentage: 50 },
      { category: "Security", count: 4, percentage: 33.3 },
    ],
    impactData: [
      { impact: "high", count: 7 },
      { impact: "medium", count: 5 },
    ],
    recommendations: [
      {
        id: "rec-1",
        title: "Accelerate Action Item Follow-Through",
        impact: "High",
        description: "Link action items directly to decision owners.",
        action: "Link Action Items",
      },
    ],
  };

  const mockLogEntries = [
    {
      _id: "entry-1",
      decisionId: { text: "Migrate to Micro-frontends" },
      outcome: "implemented",
      impactAssessment: "High scaling impact",
      meetingId: { _id: "meet-101", title: "Architecture Review" },
      decidedBy: { name: "Sarah Connor" },
      reviewDate: "2026-10-01T00:00:00.000Z",
      tags: ["Architecture", "Frontend"],
    },
    {
      _id: "entry-2",
      decisionId: { text: "Enforce Multi-factor Auth" },
      outcome: "pending",
      impactAssessment: "Critical security improvement",
      meetingId: { _id: "meet-102", title: "Security Governance" },
      decidedBy: { name: "John Doe" },
      reviewDate: null,
      tags: ["Security"],
    },
  ];

  beforeEach(() => {
    vi.spyOn(decisionLogApi, "getDecisionAnalytics").mockResolvedValue(
      mockAnalyticsData,
    );
    vi.spyOn(decisionLogApi, "getDecisionLog").mockResolvedValue({
      entries: mockLogEntries,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders live metrics and overview charts from Decision Log API", async () => {
    render(
      <MemoryRouter initialEntries={["/decisions/dashboard"]}>
        <Routes>
          <Route
            path="/decisions/dashboard"
            element={<DecisionTrackingDashboard />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Decision Tracking Dashboard"),
      ).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument(); // total decisions
      expect(screen.getByText("67% rate")).toBeInTheDocument(); // 66.7% rounded
      expect(screen.getByTestId("mock-trend-chart")).toBeInTheDocument();
      expect(screen.getByTestId("mock-category-chart")).toBeInTheDocument();
    });
  });

  it("switches to All Decisions tab and renders decision cards with meeting links", async () => {
    render(
      <MemoryRouter initialEntries={["/decisions/dashboard"]}>
        <Routes>
          <Route
            path="/decisions/dashboard"
            element={<DecisionTrackingDashboard />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /all decisions/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /all decisions/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Migrate to Micro-frontends"),
      ).toBeInTheDocument();
      expect(screen.getByText("Enforce Multi-factor Auth")).toBeInTheDocument();
      expect(screen.getByText("Architecture Review")).toBeInTheDocument();
      expect(screen.getByText("Security Governance")).toBeInTheDocument();
    });
  });

  it("filters decisions by search query", async () => {
    render(
      <MemoryRouter initialEntries={["/decisions/dashboard"]}>
        <Routes>
          <Route
            path="/decisions/dashboard"
            element={<DecisionTrackingDashboard />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /all decisions/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /all decisions/i }));

    const searchInput = screen.getByPlaceholderText(/search decisions/i);
    fireEvent.change(searchInput, { target: { value: "Micro-frontends" } });

    await waitFor(() => {
      expect(
        screen.getByText("Migrate to Micro-frontends"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Enforce Multi-factor Auth"),
      ).not.toBeInTheDocument();
    });
  });

  it("switches to AI Recommendations tab", async () => {
    render(
      <MemoryRouter initialEntries={["/decisions/dashboard"]}>
        <Routes>
          <Route
            path="/decisions/dashboard"
            element={<DecisionTrackingDashboard />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /ai recommendations/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /ai recommendations/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Accelerate Action Item Follow-Through"),
      ).toBeInTheDocument();
    });
  });
});
