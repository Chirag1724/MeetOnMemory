import React from "react";

const SharedTranscript = ({ segments }) => {
  return (
    <div className="mt-4 space-y-3" data-testid="shared-transcript-section">
      {segments.map((segment, idx) => (
        <div
          key={idx}
          className="border border-gray-100 dark:border-gray-700 rounded-lg p-3"
        >
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
            {segment.speaker}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {segment.text}
          </p>
        </div>
      ))}
    </div>
  );
};

export default SharedTranscript;
