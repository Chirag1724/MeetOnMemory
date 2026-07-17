import mongoose from "mongoose";

const relationshipSchema = new mongoose.Schema(
  {
    target: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Decision",
      required: true,
    },
    confidence: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    computedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

// Snapshot of a memory that was folded into a canonical record during
// consolidation. Preserves the exact wording/metadata that existed at
// merge time so history is never silently lost.
const mergeHistorySchema = new mongoose.Schema(
  {
    originalId: { type: mongoose.Schema.Types.ObjectId, required: true },
    text: { type: String, required: true },
    owner: { type: String, default: "" },
    status: { type: String, default: "open" },
    sourceMeetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
    },
    mergedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// Records a field-level disagreement discovered between merged duplicates,
// and how the consolidation engine resolved it, for auditability.
const mergeConflictSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    values: { type: [mongoose.Schema.Types.Mixed], default: [] },
    resolution: { type: String, default: "" },
    resolvedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const decisionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    owner: { type: String, default: "" },
    status: {
      type: String,
      enum: ["open", "in-progress", "resolved", "superseded"],
      default: "open",
    },
    sourceMeetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    embedding: { type: [Number], default: [] }, // cached vector for similarity checks
    relatesTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "Decision" }], // links to prior related decisions
    resolvedAt: { type: Date, default: null },
  
    supersededByMemory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Decision",
      default: null,
    },
    lastConsolidatedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const Decision =
  mongoose.models.Decision || mongoose.model("Decision", decisionSchema);
export default Decision;
