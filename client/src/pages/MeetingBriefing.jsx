import React, { useEffect, useState, useTransition } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  HelpCircle,
  Calendar,
  CheckCircle2,
  Share2,
  FileDown,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  getBriefing,
  regenerateBriefing,
  shareBriefing,
} from "../services/briefingApi.js";
import Navbar from "../components/Navbar.jsx";

export default function MeetingBriefing({ initialBriefing = null }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [briefing, setBriefing] = useState(initialBriefing);
  const [loading, setLoading] = useState(!initialBriefing && !!id);
  const [processing, setProcessing] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (initialBriefing) {
      setBriefing(initialBriefing);
      setLoading(false);
      return;
    }

    if (!id) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchBriefing = async () => {
      try {
        setLoading(true);
        // Try fetch briefing via API or fallback fetch
        const res = await getBriefing(id);
        const data = res?.briefing || res?.data || res;
        if (isMounted && data) {
          setBriefing(data);
        }
      } catch (error) {
        console.error("Failed to load briefing:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchBriefing();
    return () => {
      isMounted = false;
    };
  }, [id, initialBriefing]);

  const handleRegenerate = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to regenerate this briefing? This will overwrite current insights with the latest data tracks.",
    );
    if (!confirmed) return;

    setProcessing(true);
    try {
      let data;
      try {
        const response = await fetch(`/api/meeting/${id}/briefing/regenerate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        data = await response.json();
      } catch {
        data = await regenerateBriefing(id);
      }

      if (data?.success && data?.briefing) {
        startTransition(() => {
          setBriefing(data.briefing);
        });
        toast.success("Pre-meeting briefing refreshed with latest context!");
      } else if (data?.briefing) {
        startTransition(() => {
          setBriefing(data.briefing);
        });
      }
    } catch (err) {
      console.error("Regeneration failed", err);
      toast.error("Failed to regenerate briefing.");
    } finally {
      setProcessing(false);
    }
  };

  const handleShare = async () => {
    setProcessing(true);
    try {
      let data;
      try {
        const response = await fetch(`/api/meeting/${id}/briefing/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        data = await response.json();
      } catch {
        data = await shareBriefing(id);
      }

      if (data?.success) {
        const message =
          data.message ||
          "Briefing successfully emailed to all meeting participants!";
        if (
          typeof window !== "undefined" &&
          typeof window.alert === "function"
        ) {
          window.alert(message);
        }
        toast.success(message);
      } else {
        toast.error(data?.message || "Failed to share briefing.");
      }
    } catch (err) {
      console.error("Sharing failed", err);
      toast.error("Failed to share briefing with attendees.");
    } finally {
      setProcessing(false);
    }
  };

  const handleExportPDF = () => {
    // Triggers print service styling optimized for PDF generation via CSS @media print
    if (typeof window !== "undefined" && typeof window.print === "function") {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 transition-colors">
        <Navbar />
        <div className="flex flex-col justify-center items-center h-64 mt-10">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
          <p className="text-sm text-slate-500 dark:text-gray-400">
            Loading Pre-Meeting Briefing Canvas...
          </p>
        </div>
      </div>
    );
  }

  if (!briefing || briefing.status === "failed") {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 transition-colors">
        <Navbar />
        <div className="max-w-4xl px-4 py-8 mx-auto mt-4">
          <button
            onClick={() => navigate(id ? `/meeting/${id}` : "/dashboard")}
            className="flex items-center gap-2 mb-4 text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-100 print:hidden"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Meeting
          </button>
          <div className="p-8 text-center bg-white border border-gray-200 rounded-xl shadow-sm dark:bg-gray-800 dark:border-gray-700">
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
              Briefing Unavailable
            </h2>
            <p className="mb-6 text-gray-600 dark:text-gray-400 text-sm">
              The AI briefing for this meeting has not been generated or failed
              to compile latest context.
            </p>
            <button
              onClick={handleRegenerate}
              disabled={processing}
              className="inline-flex items-center gap-2 px-4 py-2 font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors text-sm"
            >
              <Sparkles className="w-4 h-4" />
              {processing ? "Generating..." : "Generate Briefing"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const title =
    briefing.title || briefing.meetingTitle || "Strategic Pre-Meeting Briefing";
  const summaryContent =
    briefing.content ||
    briefing.executiveSummary ||
    "No structural breakdown compiled yet. Use the action items deck to trigger intelligence sync inputs.";

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 space-y-6 print:bg-white print:text-black print:p-0">
      <div className="print:hidden">
        <Navbar />
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation & Controls Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden pt-4">
          <div>
            <div className="flex items-center gap-3">
              {id && (
                <button
                  type="button"
                  onClick={() => navigate(`/meeting/${id}`)}
                  className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  title="Back to meeting"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h1 className="text-xl font-bold tracking-tight text-white">
                Pre-Meeting Briefing Canvas
              </h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Review, regenerate, and distribute strategic summaries to your
              attendees.
            </p>
          </div>

          {/* Action Controls Deck */}
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={processing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors text-zinc-200"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${processing ? "animate-spin" : ""}`}
              />
              <span>🔄 Regenerate</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              disabled={processing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-xs font-semibold rounded-lg synchronized-share-trigger disabled:opacity-50 transition-colors text-white shadow-sm shadow-purple-900/30"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>📥 Share with Attendees</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-xs font-semibold rounded-lg transition-colors shadow-sm"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>📄 Export PDF</span>
            </button>
          </div>
        </div>

        {/* Briefing Canvas Content Area */}
        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl space-y-6 print:border-0 print:p-0 print:bg-transparent print:shadow-none">
          {/* Canvas Header */}
          <div className="border-b border-zinc-800 pb-4 print:border-black">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center p-2.5 rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 text-white print:hidden">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-100 print:text-black">
                  {title}
                </h2>
                <p className="text-xs text-zinc-400 print:text-gray-600">
                  Automated Pre-Meeting Intelligence Package
                </p>
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-400 print:text-black">
              Executive Summary
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line print:text-black">
              {summaryContent}
            </p>
          </div>

          {/* Suggested Strategic Questions */}
          {briefing.suggestedQuestions &&
            briefing.suggestedQuestions.length > 0 && (
              <div className="border-t border-zinc-800/80 pt-5 space-y-3 print:border-gray-300">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 print:text-black">
                  Suggested Strategic Questions
                </h3>
                <ul className="space-y-2.5">
                  {briefing.suggestedQuestions.map((question, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-sm text-zinc-300 print:text-black"
                    >
                      <HelpCircle className="w-4 h-4 mt-0.5 text-indigo-400 shrink-0 print:hidden" />
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* Open Action Items & Related Past Meetings Grid */}
          {(briefing.openActionItems?.length > 0 ||
            briefing.relatedPastMeetings?.length > 0) && (
            <div className="border-t border-zinc-800/80 pt-5 grid grid-cols-1 md:grid-cols-2 gap-6 print:border-gray-300">
              {/* Open Action Items */}
              {briefing.openActionItems &&
                briefing.openActionItems.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400 print:text-black">
                      Pending Action Items
                    </h3>
                    <ul className="space-y-3">
                      {briefing.openActionItems.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 print:bg-transparent print:border print:border-gray-300"
                        >
                          <CheckCircle2 className="w-4 h-4 mt-0.5 text-amber-400 shrink-0 print:hidden" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-zinc-200 print:text-black">
                              {item.text || item.title}
                            </p>
                            <p className="text-[11px] text-zinc-400 print:text-gray-600 mt-0.5">
                              Owner: {item.owner || "Unassigned"}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Related Past Context */}
              {briefing.relatedPastMeetings &&
                briefing.relatedPastMeetings.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 print:text-black">
                      Related Past Context
                    </h3>
                    <ul className="space-y-3">
                      {briefing.relatedPastMeetings.map((m, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 print:bg-transparent print:border print:border-gray-300"
                        >
                          <Calendar className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0 print:hidden" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-zinc-200 print:text-black">
                              {m.title || "Previous Meeting"}
                            </p>
                            {m.summary && (
                              <p className="text-[11px] text-zinc-400 print:text-gray-600 mt-0.5 line-clamp-2">
                                {m.summary}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
