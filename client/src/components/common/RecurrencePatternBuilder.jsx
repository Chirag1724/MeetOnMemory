import React, { useState } from "react";

const RecurrencePatternBuilder = ({ value = {}, onChange }) => {
  const [pattern, setPattern] = useState(value?.recurrencePattern || "weekly");

  const handlePatternChange = (e) => {
    const val = e.target.value;
    setPattern(val);
    triggerChange({ recurrencePattern: val });
  };

  const handleDayOfWeekChange = (e) => {
    const val = parseInt(e.target.value, 10);
    triggerChange({ dayOfWeek: isNaN(val) ? null : val });
  };

  const handleDayOfMonthChange = (e) => {
    const val = parseInt(e.target.value, 10);
    triggerChange({ dayOfMonth: isNaN(val) ? null : val });
  };

  const triggerChange = (changedValue) => {
    onChange?.({
      recurrencePattern: pattern,
      dayOfWeek: value?.dayOfWeek,
      dayOfMonth: value?.dayOfMonth,
      ...value,
      ...changedValue,
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50 p-4 space-y-4">
      <div className="text-sm font-medium text-slate-900 dark:text-gray-100">
        Recurrence Pattern
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">
            Frequency
          </label>
          <select
            value={pattern}
            onChange={handlePatternChange}
            className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {(pattern === "weekly" || pattern === "biweekly") && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">
              Day of Week
            </label>
            <select
              value={value?.dayOfWeek ?? 1}
              onChange={handleDayOfWeekChange}
              className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
              <option value={2}>Tuesday</option>
              <option value={3}>Wednesday</option>
              <option value={4}>Thursday</option>
              <option value={5}>Friday</option>
              <option value={6}>Saturday</option>
            </select>
          </div>
        )}

        {pattern === "monthly" && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">
              Day of Month
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={value?.dayOfMonth ?? 1}
              onChange={handleDayOfMonthChange}
              placeholder="e.g. 15"
              className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default RecurrencePatternBuilder;
