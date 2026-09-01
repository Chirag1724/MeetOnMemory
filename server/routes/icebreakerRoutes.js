/**
 * Icebreaker routes (Issue #2622).
 *
 * Mounted at /api/icebreakers in server/routes/index.js.
 * All three endpoints are auth-guarded via userAuth middleware.
 */
import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  generateIcebreaker,
  selectIcebreaker,
  getIcebreakerForMeeting,
} from "../controllers/icebreakerController.js";

const router = express.Router();

router.use(userAuth);

/** POST /api/icebreakers/generate — generate a question for a meeting */
router.post("/generate", generateIcebreaker);

/** POST /api/icebreakers/select — save a chosen question for a meeting */
router.post("/select", selectIcebreaker);

/** GET /api/icebreakers/meeting/:meetingId — retrieve the active question */
router.get("/meeting/:meetingId", getIcebreakerForMeeting);

export default router;
