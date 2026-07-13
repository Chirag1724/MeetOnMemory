/**
 * Policy Controller — HTTP layer only.
 *
 * Responsibilities:
 *  1. Parse and validate the incoming HTTP request (using Zod schemas).
 *  2. Delegate all business logic to PolicyService.
 *  3. Shape and send the HTTP response.
 *  4. Forward any error to the global error handler via next(err).
 *
 * This file intentionally contains NO database queries, NO AI calls, and
 * NO file-system operations beyond what Multer provides.  All of that lives
 * in server/services/PolicyService.js.
 */

import fs from "fs";
import { z } from "zod";
import * as PolicyService from "../services/PolicyService.js";
import { ValidationError, UnauthorizedError } from "../utils/errors.js";

// ═══════════════════════════════════════════════════════════════
// Zod validation schemas
// ═══════════════════════════════════════════════════════════════

const uploadPolicySchema = z.object({
  commitMsg: z.string().optional().default(""),
});

// ── Helper: extract userId from the request ───────────────────
const getUserId = (req) => {
  const id = req.user?.id || req.user?._id;
  if (!id) throw new UnauthorizedError();
  return id.toString();
};

// ═══════════════════════════════════════════════════════════════
// Controller handlers
// ═══════════════════════════════════════════════════════════════

/* ─────────────────────────────────────────────────────────────
   1. UPLOAD & PROCESS POLICY
   ───────────────────────────────────────────────────────────── */
export const uploadPolicy = async (req, res, next) => {
  // Track file path so we can clean up on failure
  const uploadedFilePath = req.file?.path || null;

  try {
    if (!req.file) {
      throw new ValidationError("No file uploaded.");
    }

    const uploaderId = getUserId(req);

    let validated;
    try {
      validated = uploadPolicySchema.parse(req.body);
    } catch (zodErr) {
      return next(zodErr);
    }

    const { policy, isUpdate } = await PolicyService.uploadAndProcessPolicy(
      uploaderId,
      req.user?.organization || null,
      req.file,
      validated.commitMsg,
    );

    return res.status(isUpdate ? 200 : 201).json({
      success: true,
      message: isUpdate
        ? "Policy updated and analyzed by AI."
        : "Policy uploaded and analyzed successfully.",
      policyId: policy._id,
      policy,
    });
  } catch (err) {
    // If the service threw before it could move/handle the file, clean it up
    if (uploadedFilePath) {
      try {
        if (fs.existsSync(uploadedFilePath)) {
          fs.unlinkSync(uploadedFilePath);
        }
      } catch {
        // ignore cleanup errors
      }
    }
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   2. RE-ANALYZE POLICY (on-demand AI retry)
   ───────────────────────────────────────────────────────────── */
export const analyzePolicy = async (req, res, next) => {
  try {
    const policy = await PolicyService.reanalyzePolicy(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Policy re-analyzed successfully.",
      summary: policy.summary,
      keywords: policy.keywords,
    });
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   3. GET ALL POLICIES
   ───────────────────────────────────────────────────────────── */
export const getPolicies = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    const policies = await PolicyService.getAllPolicies(
      userId,
      req.user?.organization || null,
    );

    return res.status(200).json({ success: true, policies });
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   4. DOWNLOAD POLICY FILE
   ───────────────────────────────────────────────────────────── */
export const downloadPolicy = async (req, res, next) => {
  try {
    const { safeFilePath, fileName } = await PolicyService.getPolicyDownloadPath(
      req.params.id,
    );

    return res.download(safeFilePath, fileName);
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   5. DELETE POLICY
   ───────────────────────────────────────────────────────────── */
export const deletePolicy = async (req, res, next) => {
  try {
    // req.doc is injected by requireOwnerOrAdmin middleware if configured
    let policy = req.doc;

    if (!policy) {
      // Fallback: fetch the policy here if middleware didn't pre-load it
      const { default: Policy } = await import("../models/policyModel.js");
      policy = await Policy.findById(req.params.id);
    }

    if (!policy) {
      const { NotFoundError } = await import("../utils/errors.js");
      throw new NotFoundError("Policy not found.");
    }

    await PolicyService.deletePolicy(policy);

    return res.status(200).json({
      success: true,
      message: "Policy deleted successfully.",
    });
  } catch (err) {
    next(err);
  }
};
