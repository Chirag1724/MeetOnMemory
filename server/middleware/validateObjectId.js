import mongoose from "mongoose";
import { sendError } from "../utils/responseHelper.js";

/**
 * Middleware to validate MongoDB ObjectIds in request parameters.
 * If the id is missing or invalid, it returns a 400 Bad Request.
 */
export const validateObjectId = (req, res, next) => {
  const { id } = req.params;

  if (id && !mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 400, "Invalid or malformed ID parameter.");
  }

  next();
};
