import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  generateBriefing,
  regenerateBriefing,
  shareBriefingWithParticipants,
  getBriefing,
} from "../controllers/preMeetingBriefingController.js";

const router = express.Router({ mergeParams: true });

router.use(userAuth);

router.post(["/:meetingId/generate", "/generate"], generateBriefing);
router.post(["/:meetingId/regenerate", "/regenerate"], regenerateBriefing);
router.post(["/:meetingId/share", "/share"], shareBriefingWithParticipants);
router.get(["/:meetingId", "/"], getBriefing);

export default router;
