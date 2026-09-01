/**
 * Issue #2622 — Icebreaker route registration and API-prefix contract.
 *
 * Verifies that:
 *  1. icebreakerRoutes registers the three expected endpoints.
 *  2. The generate → retrieve (scheduling) and select → retrieve (meeting-room)
 *     flows work end-to-end through the controller.
 *  3. The controller returns a proper 404 when no icebreaker is set.
 *
 * Note: importing routes/index.js in isolation is blocked by transitive missing
 * packages (dompurify, middleware/auth.js) that are only present when the full
 * test:unit suite runs.  Route-index mounting is therefore verified by the
 * existing routeRegistration.test.js in the test:unit run.  This file focuses
 * on the icebreakerRoutes router and controller in isolation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock userAuth so we can import the routes file without Clerk initialisation.
vi.mock("../middleware/userAuth.js", () => ({
  default: (_req, _res, next) => next(),
}));

import icebreakerRoutes from "../routes/icebreakerRoutes.js";
import {
  generateIcebreaker,
  selectIcebreaker,
  getIcebreakerForMeeting,
  _store,
} from "../controllers/icebreakerController.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const getRouterStack = (router) => router?.stack || [];
const listRouteLayers = (router) =>
  getRouterStack(router).filter((layer) => layer.route);

// ── Route-registration assertions ─────────────────────────────────────────────

describe("Icebreaker route registration (#2622)", () => {
  it("is a valid Express router", () => {
    expect(icebreakerRoutes).toBeDefined();
    expect(typeof icebreakerRoutes).toBe("function");
    expect(Array.isArray(icebreakerRoutes.stack)).toBe(true);
  });

  it("registers POST /generate, POST /select, and GET /meeting/:meetingId", () => {
    const layers = listRouteLayers(icebreakerRoutes);

    const has = (path, method, handler) =>
      layers.some(
        (l) =>
          l.route?.path === path &&
          l.route.methods?.[method] &&
          l.route.stack.some((s) => s.handle === handler),
      );

    expect(has("/generate", "post", generateIcebreaker)).toBe(true);
    expect(has("/select", "post", selectIcebreaker)).toBe(true);
    expect(has("/meeting/:meetingId", "get", getIcebreakerForMeeting)).toBe(
      true,
    );
  });

  it("does not register any path without /generate, /select, or /meeting", () => {
    const layers = listRouteLayers(icebreakerRoutes);
    const paths = layers.map((l) => l.route?.path).filter(Boolean);
    // Only the three expected paths should be present.
    expect(paths).toEqual(
      expect.arrayContaining([
        "/generate",
        "/select",
        "/meeting/:meetingId",
      ]),
    );
    expect(paths).toHaveLength(3);
  });
});

// ── Controller unit tests ─────────────────────────────────────────────────────

describe("icebreakerController (#2622) — schedule flow", () => {
  // Build minimal req/res mocks for each test so assertions don't bleed.
  const makeRes = () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    return { status, json, _json: json };
  };

  beforeEach(() => {
    _store.clear();
  });

  // ── generateIcebreaker ──────────────────────────────────────────────────────

  it("generate: returns 400 when meetingId is missing", async () => {
    const res = makeRes();
    await generateIcebreaker({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("generate: stores and returns a non-empty question string", async () => {
    const res = makeRes();
    await generateIcebreaker({ body: { meetingId: "m1" } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const [payload] = res._json.mock.calls[0];
    expect(payload.success).toBe(true);
    expect(typeof payload.question).toBe("string");
    expect(payload.question.length).toBeGreaterThan(0);
    expect(_store.get("m1")).toBe(payload.question);
  });

  // ── selectIcebreaker ────────────────────────────────────────────────────────

  it("select: returns 400 when question is missing", async () => {
    const res = makeRes();
    await selectIcebreaker({ body: { meetingId: "m2" } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("select: persists the chosen question and returns 200", async () => {
    const res = makeRes();
    await selectIcebreaker(
      { body: { meetingId: "m3", question: "What is your hobby?" } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(_store.get("m3")).toBe("What is your hobby?");
  });

  // ── getIcebreakerForMeeting ─────────────────────────────────────────────────

  it("getForMeeting: returns 404 when no icebreaker is set — LiveIcebreakerBanner distinguishes this", async () => {
    const res = makeRes();
    await getIcebreakerForMeeting(
      { params: { meetingId: "no-such-meeting" } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
    const [payload] = res._json.mock.calls[0];
    expect(payload.success).toBe(false);
  });

  it("getForMeeting: returns 200 with the stored question", async () => {
    _store.set("m4", "Tell us something fun!");
    const res = makeRes();
    await getIcebreakerForMeeting({ params: { meetingId: "m4" } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const [payload] = res._json.mock.calls[0];
    expect(payload.success).toBe(true);
    expect(payload.question).toBe("Tell us something fun!");
  });

  // ── End-to-end: generate → retrieve (scheduling flow) ─────────────────────

  it("schedule flow: generate during scheduling, retrieve in meeting room", async () => {
    const meetingId = "flow-meeting";

    const genRes = makeRes();
    await generateIcebreaker({ body: { meetingId } }, genRes);
    expect(genRes.status).toHaveBeenCalledWith(200);
    const generatedQuestion = genRes._json.mock.calls[0][0].question;
    expect(typeof generatedQuestion).toBe("string");

    const getRes = makeRes();
    await getIcebreakerForMeeting({ params: { meetingId } }, getRes);
    expect(getRes.status).toHaveBeenCalledWith(200);
    expect(getRes._json.mock.calls[0][0].question).toBe(generatedQuestion);
  });

  // ── End-to-end: select → retrieve (meeting-room banner flow) ───────────────

  it("meeting-room flow: organiser selects, banner retrieves the same question", async () => {
    const meetingId = "room-meeting";
    const chosen = "What emoji describes your mood today?";

    const selRes = makeRes();
    await selectIcebreaker({ body: { meetingId, question: chosen } }, selRes);
    expect(selRes.status).toHaveBeenCalledWith(200);

    const getRes = makeRes();
    await getIcebreakerForMeeting({ params: { meetingId } }, getRes);
    expect(getRes.status).toHaveBeenCalledWith(200);
    expect(getRes._json.mock.calls[0][0].question).toBe(chosen);
// server/tests/icebreaker.test.js
import { selectIcebreaker } from "../controllers/icebreakerController";

describe("Icebreaker Logic Engine Suite", () => {
  let mockIo;
  const mockRoomId = "test-room-101";

  beforeEach(() => {
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
  });

  test("Should transition selected icebreakers to live banners and save state histories", () => {
    selectIcebreaker(mockIo, mockRoomId, "Pineapple on pizza?");
    expect(mockIo.to).toHaveBeenCalledWith(mockRoomId);
    expect(mockIo.emit).toHaveBeenCalledWith(
      "icebreaker:sync",
      expect.objectContaining({
        current: "Pineapple on pizza?",
      }),
    );
  });
});
