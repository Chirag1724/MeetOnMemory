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
import React, { useState, useEffect } from "react";
import api from "../../services/apiClient";

const LiveIcebreakerBanner = ({ meetingId, peers, localUserInfo }) => {
  const [icebreaker, setIcebreaker] = useState(null);
  const [turnIndex, setTurnIndex] = useState(0);

  useEffect(() => {
    // Fetch the active icebreaker for this meeting
    const fetchIcebreaker = async () => {
      try {
        const response = await api.get(`/icebreakers/meeting/${meetingId}`);
        if (response.data && response.data.icebreaker) {
          setIcebreaker(response.data.icebreaker);
        }
      } catch {
        // Ignore 404 or missing
      }
    };
    fetchIcebreaker();
  }, [meetingId]);

  if (!icebreaker) return null;

  // Compile list of all participants currently in the room
  const participants = [localUserInfo, ...peers.map((p) => p.userInfo)].filter(
    Boolean,
  );

  const currentPerson = participants[turnIndex % participants.length];

  const handleNextTurn = () => {
    setTurnIndex((prev) => prev + 1);
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md p-3 px-6 flex flex-col md:flex-row items-center justify-between mx-4 mt-2 rounded-xl border border-white/20 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>

      <div className="flex items-center gap-4 z-10 w-full md:w-auto">
        <div className="bg-white/20 p-2 rounded-lg text-2xl hidden sm:block">
          🧊
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider font-bold text-blue-200 mb-1 block">
            Team Icebreaker • {icebreaker.category}
          </span>
          <p className="font-medium text-lg leading-snug max-w-2xl">
            {icebreaker.promptText}
          </p>
        </div>
      </div>

      {participants.length > 0 && (
        <div className="flex items-center gap-4 mt-3 md:mt-0 z-10 w-full md:w-auto justify-between md:justify-end bg-black/20 p-2 px-4 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white/80">Turn:</span>
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full">
              {currentPerson?.profilePic ? (
                <img
                  src={currentPerson.profilePic}
                  className="w-5 h-5 rounded-full object-cover"
                  alt=""
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-indigo-400 flex items-center justify-center text-[10px] font-bold">
                  {(currentPerson?.name || "P")[0].toUpperCase()}
                </div>
              )}
              <span className="font-bold text-sm truncate max-w-[100px]">
                {currentPerson?.name || "Waiting..."}
              </span>
            </div>
          </div>
          <button
            onClick={handleNextTurn}
            className="bg-white text-indigo-700 hover:bg-blue-50 px-3 py-1 rounded shadow-sm text-xs font-bold uppercase transition-colors"
          >
            Next Person
          </button>
        </div>
      )}
    </div>
  );
};

export default LiveIcebreakerBanner;
