/**
 * Endpoint pagination hardening (follow-up to #1071).
 *
 * These four list endpoints used to parse `?page=` / `?limit=` by hand, which
 * reintroduced the exact failures the shared `parsePagination` /
 * `buildPaginationMeta` helpers were written to prevent:
 *
 *   - no ceiling            -> `?limit=1000000` streams the whole collection
 *   - no floor              -> `?page=0` produces a negative skip -> 500
 *   - NaN skip              -> `?page=abc` -> 500
 *   - `?limit=0`            -> means "no limit" in Mongoose -> whole collection
 *   - missing `hasMore`     -> client cannot detect the last page
 *   - unvalidated `assignee` -> malformed value reaches the query -> 500 CastError
 *
 * These suites pin the new behaviour for each of the four controllers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../models/FollowUpTask.js", () => {
  const Mock = vi.fn();
  Mock.find = vi.fn();
  Mock.countDocuments = vi.fn();
  return { default: Mock };
});

vi.mock("../services/followUpWorkflowService.js", () => ({
  getCompletionAnalytics: vi.fn(),
  updateTaskStatus: vi.fn(),
}));

vi.mock("../models/actionItemChangeLogModel.js", () => {
  const Mock = vi.fn();
  Mock.find = vi.fn();
  Mock.countDocuments = vi.fn();
  return { default: Mock };
});

vi.mock("../models/aiMeetingNoteModel.js", () => {
  const Mock = vi.fn();
  Mock.find = vi.fn();
  Mock.countDocuments = vi.fn();
  return { default: Mock };
});

vi.mock("../models/meetingROIModel.js", () => {
  const Mock = vi.fn();
  Mock.find = vi.fn();
  Mock.countDocuments = vi.fn();
  return { default: Mock };
});

import FollowUpTask from "../models/FollowUpTask.js";
import ActionItemChangeLog from "../models/actionItemChangeLogModel.js";
import AiMeetingNote from "../models/aiMeetingNoteModel.js";
import MeetingROI from "../models/meetingROIModel.js";

import { getTasks } from "../controllers/followUpController.js";
import { getChangeLogs } from "../controllers/actionItemChangeLogController.js";
import { getNotes } from "../controllers/aiMeetingNoteController.js";
import { getROIRecords } from "../controllers/meetingROIController.js";

import { DEFAULT_MAX_LIMIT } from "../utils/pagination.js";

const makeChain = (docs) => ({
  sort: vi.fn().mockReturnThis(),
  populate: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(docs),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
});

const makeRes = () => {
  const res = {
    statusCode: null,
    body: null,
    status: vi.fn(function (code) {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn(function (body) {
      res.body = body;
      return res;
    }),
  };
  return res;
};

const VALID_OBJECT_ID = "507f1f77bcf86cd799439011";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("followUpController.getTasks (#1071 follow-up)", () => {
  it("clamps an unbounded limit and reports hasMore", async () => {
    FollowUpTask.find.mockReturnValue(makeChain([{ _id: "t1" }]));
    FollowUpTask.countDocuments.mockResolvedValue(150);

    const res = makeRes();
    await getTasks(
      {
        user: { _id: VALID_OBJECT_ID, organization: "org-1" },
        query: { limit: "1000000", page: "1" },
      },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.pagination.limit).toBe(DEFAULT_MAX_LIMIT);
    expect(res.body.pagination.total).toBe(150);
    expect(res.body.pagination.hasMore).toBe(true);
  });

  it("answers 200 (not 500) for a zero page", async () => {
    FollowUpTask.find.mockReturnValue(makeChain([]));
    FollowUpTask.countDocuments.mockResolvedValue(0);

    const res = makeRes();
    await getTasks(
      {
        user: { _id: VALID_OBJECT_ID, organization: "org-1" },
        query: { page: "0" },
      },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.skip).toBeUndefined();
  });

  it("answers 400 (not 500) for a malformed assignee", async () => {
    const res = makeRes();
    await getTasks(
      {
        user: { _id: VALID_OBJECT_ID, organization: "org-1" },
        query: { assignee: "not-an-objectid" },
      },
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(FollowUpTask.find).not.toHaveBeenCalled();
  });
});

describe("actionItemChangeLogController.getChangeLogs (#1071 follow-up)", () => {
  it("clamps an unbounded limit", async () => {
    ActionItemChangeLog.find.mockReturnValue(makeChain([]));
    ActionItemChangeLog.countDocuments.mockResolvedValue(5000);

    const res = makeRes();
    await getChangeLogs(
      { params: { id: VALID_OBJECT_ID }, query: { limit: "999999" } },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.pagination.limit).toBe(DEFAULT_MAX_LIMIT);
    expect(res.body.pagination.total).toBe(5000);
    expect(res.body.pagination.hasMore).toBe(true);
  });

  it("answers 200 (not 500) for a zero page and zero limit", async () => {
    ActionItemChangeLog.find.mockReturnValue(makeChain([]));
    ActionItemChangeLog.countDocuments.mockResolvedValue(0);

    const res = makeRes();
    await getChangeLogs(
      { params: { id: VALID_OBJECT_ID }, query: { page: "0", limit: "0" } },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.pagination.page).toBe(1);
  });
});

describe("aiMeetingNoteController.getNotes (#1071 follow-up)", () => {
  it("clamps an unbounded limit and includes hasMore", async () => {
    AiMeetingNote.find.mockReturnValue(makeChain([]));
    AiMeetingNote.countDocuments.mockResolvedValue(120);

    const res = makeRes();
    await getNotes(
      {
        user: { organization: "org-1" },
        query: { limit: "500000", page: "0" },
      },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.data.pagination.limit).toBe(DEFAULT_MAX_LIMIT);
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.total).toBe(120);
    expect(res.body.data.pagination.hasMore).toBe(true);

    // `?limit=0` must fall back to the endpoint default (20), never mean
    // "no limit" (which would return the entire collection).
    const resZero = makeRes();
    AiMeetingNote.find.mockReturnValue(makeChain([]));
    AiMeetingNote.countDocuments.mockResolvedValue(120);
    await getNotes(
      { user: { organization: "org-1" }, query: { limit: "0" } },
      resZero,
    );
    expect(resZero.statusCode).toBe(200);
    expect(resZero.body.data.pagination.limit).toBe(20);
  });
});

describe("meetingROIController.getROIRecords (#1071 follow-up)", () => {
  it("clamps an unbounded limit and includes hasMore", async () => {
    MeetingROI.find.mockReturnValue(makeChain([]));
    MeetingROI.countDocuments.mockResolvedValue(250);

    const res = makeRes();
    await getROIRecords(
      {
        user: { organization: "org-1" },
        query: { limit: "500000", page: "abc" },
      },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.data.pagination.limit).toBe(DEFAULT_MAX_LIMIT);
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.total).toBe(250);
    expect(res.body.data.pagination.hasMore).toBe(true);
  });
});
