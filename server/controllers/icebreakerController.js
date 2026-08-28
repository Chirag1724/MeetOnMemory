// server/controllers/icebreakerController.js
import * as icebreakerService from "../services/icebreakerService.js";
import Icebreaker from "../models/icebreakerModel.js";

// Mock persistent storage for session-scoped icebreaker states
const icebreakerSessions = {};

export const generate = async (req, res) => {
  try {
    const { meetingId } = req.body;
    if (!meetingId) {
      return res.status(400).json({ message: "Meeting ID is required" });
    }
    const questions = await icebreakerService.generateIcebreakers(meetingId);
    return res.status(200).json({ success: true, icebreakers: questions });
  } catch (error) {
    console.error("Error in generate:", error);
    return res.status(500).json({ message: "Failed to generate icebreakers", error: error.message });
  }
};

export const select = async (req, res) => {
  try {
    const { meetingId, promptText, category } = req.body;
    if (!meetingId || !promptText || !category) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const result = await icebreakerService.selectIcebreaker(meetingId, promptText, category);
    return res.status(200).json({ success: true, icebreaker: result });
  } catch (error) {
    console.error("Error in select:", error);
    return res.status(500).json({ message: "Failed to select icebreaker", error: error.message });
  }
};

export const getActiveIcebreaker = async (req, res) => {
  try {
    const { meetingId } = req.params;
    // Find the latest icebreaker used in this meeting
    const icebreaker = await Icebreaker.findOne({
      usedInMeetings: meetingId
    }).sort({ updatedAt: -1 });

    return res.status(200).json(icebreaker);
  } catch (error) {
    console.error("Error in getActiveIcebreaker:", error);
    return res.status(500).json({ message: "Failed to get active icebreaker", error: error.message });
  }
};

const getSessionData = (roomId) => {
  if (!icebreakerSessions[roomId]) {
    icebreakerSessions[roomId] = { current: null, history: [], reactions: {} };
  }
  return icebreakerSessions[roomId];
};

export const selectIcebreaker = (io, roomId, icebreakerText) => {
  const session = getSessionData(roomId);

  // Push old one to history if it exists
  if (session.current) {
    session.history.unshift({
      text: session.current,
      timestamp: new Date(),
      reactions: { ...session.reactions },
    });
  }

  // Set new state
  session.current = icebreakerText;
  session.reactions = { "🔥": 0, "😂": 0, "❤️": 0, "🙌": 0 };

  // Broadcast updated live state to everyone in the room
  io.to(roomId).emit("icebreaker:sync", {
    current: session.current,
    history: session.history,
    reactions: session.reactions,
  });
};

export const handleIcebreakerReaction = (io, roomId, emoji) => {
  const session = getSessionData(roomId);
  if (session.reactions[emoji] !== undefined) {
    session.reactions[emoji] += 1;
  }

  // Broadcast dynamic live feedback delta
  io.to(roomId).emit("icebreaker:reaction_update", {
    reactions: session.reactions,
  });
};
