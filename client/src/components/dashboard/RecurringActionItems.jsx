import React, { useState } from "react";
import {
  Repeat,
  Plus,
  Edit3,
  Trash2,
  Flame,
  Pause,
  Play,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";
import useRecurringActionItems from "../../hooks/useRecurringActionItems";
import RecurrencePatternBuilder from "../common/RecurrencePatternBuilder";

const RecurringActionItems = () => {
  const {
    items = [],
    loading,
    isLoading,
    createItem,
    updateItem,
    deleteItem,
    pauseItem,
    completeItem,
  } = useRecurringActionItems();

  const isDataLoading = loading || isLoading;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    text: "",
    description: "",
    meetingSeriesId: "",
    recurrencePattern: "weekly",
    dayOfWeek: 1,
    dayOfMonth: 1,
  });

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      text: "",
      description: "",
      meetingSeriesId: "",
      recurrencePattern: "weekly",
      dayOfWeek: 1,
      dayOfMonth: 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      text: item.text || item.title || "",
      description: item.description || "",
      meetingSeriesId: item.meetingSeriesId || "",
      recurrencePattern: item.recurrencePattern || item.interval || "weekly",
      dayOfWeek: item.dayOfWeek ?? 1,
      dayOfMonth: item.dayOfMonth ?? 1,
    });
    setIsModalOpen(true);
  };

  const handleTogglePause = async (item) => {
    const id = item._id || item.id;
    try {
      if (pauseItem) {
        await pauseItem(id);
      } else if (updateItem) {
        const currentlyActive = item.isActive ?? !item.isPaused;
        await updateItem(id, {
          isActive: !currentlyActive,
          isPaused: currentlyActive,
        });
      }
      toast.success(
        item.isActive || !item.isPaused
          ? "Recurring item paused"
          : "Recurring item resumed",
      );
    } catch (err) {
      console.error("Failed to toggle pause status:", err);
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    try {
      if (deleteItem) {
        await deleteItem(id);
      }
      toast.success("Recurring item deleted");
    } catch (err) {
      console.error("Failed to delete recurring item:", err);
      toast.error("Failed to delete recurring item");
    }
  };

  const handleComplete = async (item) => {
    const id = item._id || item.id;
    try {
      if (completeItem) {
        await completeItem(id);
      } else if (updateItem) {
        await updateItem(id, {
          totalCompleted: (item.totalCompleted || 0) + 1,
        });
      }
      toast.success("Marked occurrence as completed!");
    } catch (err) {
      console.error("Failed to complete occurrence:", err);
      toast.error("Failed to update occurrence");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.text.trim()) {
      toast.error("Please enter a task description");
      return;
    }

    setSubmitting(true);
    try {
      if (editingItem) {
        const id = editingItem._id || editingItem.id;
        await updateItem(id, formData);
        toast.success("Recurring item updated successfully");
      } else {
        await createItem(formData);
        toast.success("Recurring item created successfully");
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Failed to save recurring action item:", err);
      toast.error(err.message || "Failed to save recurring item");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-5 sm:p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Repeat className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100 tracking-tight">
              Recurring Action Items
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Automated repeating tasks & commitments
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Recurring Item</span>
        </button>
      </div>

      {/* Content */}
      {isDataLoading ? (
        <div className="flex flex-col items-center justify-center py-10">
          <Loader2 className="h-6 w-6 text-blue-500 animate-spin mb-2" />
          <p className="text-xs text-slate-500 dark:text-gray-400">
            Loading recurring items...
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-lg border border-dashed border-slate-200 dark:border-gray-600 bg-slate-50/80 dark:bg-gray-700/40 px-4 py-5 sm:px-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-slate-200/80 dark:ring-gray-600">
            <Repeat className="h-5 w-5 text-slate-400 dark:text-gray-500" />
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-200">
              No recurring items found
            </h3>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-gray-400">
              Set up repeating action items to automatically track recurring
              commitments across meeting cycles.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto max-h-[420px] pr-1">
          {items.map((item) => {
            const id = item._id || item.id;
            const title = item.text || item.title;
            const pattern = (
              item.recurrencePattern ||
              item.interval ||
              "weekly"
            ).toUpperCase();
            const streak = item.currentStreak || 0;
            const isPaused = item.isPaused ?? item.isActive === false;

            return (
              <div
                key={id}
                className="group rounded-xl border border-slate-200/80 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-750 p-4 transition-all hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-900 dark:text-gray-100">
                        {title}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                        {pattern}
                      </span>
                      {isPaused ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                          PAUSED
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    {item.description && (
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 mt-2.5 text-xs text-slate-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Flame
                          className={`h-3.5 w-3.5 ${
                            streak > 0
                              ? "text-orange-500 fill-orange-500"
                              : "text-slate-400"
                          }`}
                        />
                        <span className="font-medium">Streak: {streak}</span>
                      </div>
                      <div>Completed: {item.totalCompleted || 0}</div>
                      {item.totalMissed ? (
                        <div>Missed: {item.totalMissed}</div>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTogglePause(item)}
                      aria-label="pause"
                      title={
                        isPaused
                          ? "Resume recurring item"
                          : "Pause recurring item"
                      }
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-slate-200/60 dark:hover:bg-gray-700 transition-colors"
                    >
                      {isPaused ? (
                        <Play className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Pause className="h-4 w-4 text-amber-600" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleComplete(item)}
                      title="Mark current occurrence complete"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 hover:bg-slate-200/60 dark:hover:bg-gray-700 transition-colors"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      aria-label="edit"
                      title="Edit item"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-slate-200/60 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(id)}
                      aria-label="delete"
                      title="Delete item"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-slate-200/60 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl border border-slate-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-700 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-gray-100">
                {editingItem ? "Edit Recurring Item" : "Create Recurring Item"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                  Task Description *
                </label>
                <input
                  type="text"
                  required
                  value={formData.text}
                  onChange={(e) =>
                    setFormData({ ...formData, text: e.target.value })
                  }
                  placeholder="e.g. Submit weekly status update"
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                  Details / Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Additional context or expectations..."
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                  Meeting Series ID (optional)
                </label>
                <input
                  type="text"
                  value={formData.meetingSeriesId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      meetingSeriesId: e.target.value,
                    })
                  }
                  placeholder="Enter associated series ID"
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <RecurrencePatternBuilder
                value={formData}
                onChange={(patternValues) =>
                  setFormData((prev) => ({ ...prev, ...patternValues }))
                }
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Saving..." : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurringActionItems;
