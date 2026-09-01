// client/src/components/meeting-room/LiveIcebreakerBanner.jsx
import React, { useState, useEffect } from "react";
import { Sparkles, AlertCircle } from "lucide-react";
import icebreakerApi from "../../services/icebreakerApi.js";

/**
 * LiveIcebreakerBanner — displays the scheduled icebreaker question inside the
 * live meeting room.
 *
 * Issue #2622 fix:
 *  - Uses icebreakerApi (paths prefixed with /api) instead of bare fetch calls.
 *  - Distinguishes a 404 / not-found response (no icebreaker set for this
 *    meeting) from other network/server errors, so the banner stays silent when
 *    the meeting simply has no icebreaker rather than surfacing a red error state
 *    for a normal condition.
 *
 * @param {string} meetingId - The ID of the active meeting.
 */
const LiveIcebreakerBanner = ({ meetingId }) => {
  const [question, setQuestion] = useState(null);
  // null  → still loading
  // false → no icebreaker set for this meeting (404 / not-found)
  // Error → unexpected fetch failure
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meetingId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchIcebreaker = async () => {
      try {
        const res = await icebreakerApi.getForMeeting(meetingId);
        if (!cancelled) {
          setQuestion(res.data?.question ?? null);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;

        const status = err?.response?.status;

        if (status === 404) {
          // No icebreaker configured for this meeting — not an error, just
          // render nothing rather than surfacing a confusing error state.
          setQuestion(null);
          setError(false);
        } else {
          // Unexpected error (network issue, 500, etc.) — store it so we can
          // show a non-intrusive notice without exposing raw technical details.
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchIcebreaker();

    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  // Still loading — render nothing to avoid layout shift.
  if (loading) return null;

  // 404 / no icebreaker set — stay silent; this is the expected state for
  // meetings that were scheduled without an icebreaker.
  if (error === false || question === null) return null;

  // Unexpected error — show a minimal, non-alarming notice.
  if (error) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300"
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Icebreaker unavailable right now.</span>
      </div>
    );
  }

  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-950/40"
    >
      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500 dark:text-indigo-400" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          Icebreaker
        </p>
        <p className="mt-0.5 text-sm text-indigo-900 dark:text-indigo-100">
          {question}
        </p>
      </div>
    </div>
  );
};

export default LiveIcebreakerBanner;
