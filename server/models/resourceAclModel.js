import mongoose from "mongoose";

const ResourceAclSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      enum: ["MEETING", "FOLDER", "POLICY", "REPORT"],
      required: true,
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    granteeType: {
      type: String,
      enum: ["USER", "ROLE"],
      required: true,
    },
    granteeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    permissions: [
      {
        type: String,
        enum: ["READ", "WRITE", "ADMIN", "DELEGATE", "EXPORT"],
      },
    ],
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// Issue #2570 — granteeType is part of a grant's identity: a USER grant and a
// ROLE grant for the same granteeId must be able to coexist.
ResourceAclSchema.index(
  {
    organizationId: 1,
    resourceType: 1,
    resourceId: 1,
    granteeType: 1,
    granteeId: 1,
  },
  { unique: true },
);

const ResourceAcl = mongoose.model("ResourceAcl", ResourceAclSchema);

export default ResourceAcl;
