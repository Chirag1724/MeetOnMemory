/**
 * Icebreaker controller (Issue #2622).
 *
 * Handles generate / select / retrieve endpoints mounted at /api/icebreakers.
 * Kept intentionally simple: question storage is per-meeting in a lightweight
 * in-memory map for testability; a production deployment would persist to the
 * Meeting document or a dedicated collection.
 */

// In-process store keyed by meetingId.  Replaced per-request in tests via the
// exported `_store` reference.
export const _store = new Map();

/**
 * POST /api/icebreakers/generate
 * Body: { meetingId }
 *
 * Generates a sample icebreaker question for the given meeting.
 */
export const generateIcebreaker = async (req, res) => {
  try {
    const { meetingId } = req.body;

    if (!meetingId) {
      return res
        .status(400)
        .json({ success: false, message: "meetingId is required" });
    }

    // Minimal set of generic questions; a richer implementation would call an
    // AI service or pull from a curated library.
    const questions = [
      "What's one thing you're looking forward to this week?",
      "If you could learn any new skill instantly, what would it be?",
      "What's the best piece of advice you've ever received?",
      "Share something you recently learned that surprised you.",
      "What's a hobby or interest outside of work that you enjoy?",
    ];

    const question = questions[Math.floor(Math.random() * questions.length)];
    _store.set(meetingId, question);

    return res.status(200).json({ success: true, question });
  } catch (_err) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to generate icebreaker" });
  }
};

/**
 * POST /api/icebreakers/select
 * Body: { meetingId, question }
 *
 * Saves the caller's chosen icebreaker question for a meeting.
 */
export const selectIcebreaker = async (req, res) => {
  try {
    const { meetingId, question } = req.body;

    if (!meetingId || !question) {
      return res.status(400).json({
        success: false,
        message: "meetingId and question are required",
      });
    }

    _store.set(meetingId, question);
    return res.status(200).json({ success: true, question });
  } catch (_err) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to save icebreaker" });
  }
};

/**
 * GET /api/icebreakers/meeting/:meetingId
 *
 * Retrieves the active icebreaker question for the given meeting.
 * Returns 404 when no icebreaker has been set.
 */
export const getIcebreakerForMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const question = _store.get(meetingId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "No icebreaker found for this meeting",
      });
    }

    return res.status(200).json({ success: true, question });
  } catch (_err) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to retrieve icebreaker" });
  }
};
