// server/jobs/__tests__/processTranscriptionJob.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import processTranscriptionJob from "../processTranscriptionJob.js";
import Transcript from "../../models/transcriptModel.js";
import Meeting from "../../models/meetingModel.js";
import fs from "fs";
import { transcribeFileWithSegments } from "../../services/transcriptionService.js";
import { indexTranscript } from "../../services/indexService.js";
import { sentimentAnalysisQueue } from "../../services/queueService.js";

vi.mock("../../models/transcriptModel.js");
vi.mock("../../models/meetingModel.js");
vi.mock("fs");
vi.mock("../../services/transcriptionService.js");
vi.mock("../../services/indexService.js");
vi.mock("../../services/queueService.js");

describe("processTranscriptionJob (#2650)", () => {
  const transcriptId = "transcript_123";
  const meetingId = "meeting_456";

  const transcriptFixture = {
    _id: transcriptId,
    meeting: meetingId,
    audioFilePath: "/tmp/audio.wav",
    status: "processing",
    recordingTimestamps: {},
    save: vi.fn().mockResolvedValue(true),
  };

  const jobFixture = {
    data: { transcriptId },
    id: "job_789",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    Transcript.findById.mockResolvedValue(transcriptFixture);
    Meeting.findByIdAndUpdate.mockResolvedValue(true);

    fs.existsSync.mockReturnValue(true);
    fs.unlinkSync.mockReturnValue(true);

    transcribeFileWithSegments.mockResolvedValue({
      fullText: "Transcribed audio content",
      segments: [{ text: "Hello", speaker: "user1" }],
    });

    indexTranscript.mockResolvedValue(true);
    sentimentAnalysisQueue.isActive = true;
    sentimentAnalysisQueue.add.mockResolvedValue(true);
  });

  it("transcribes audio and updates transcript with completed status", async () => {
    await processTranscriptionJob(jobFixture);

    expect(transcribeFileWithSegments).toHaveBeenCalledWith(
      "/tmp/audio.wav",
    );
    expect(transcriptFixture.fullText).toBe("Transcribed audio content");
    expect(transcriptFixture.segments).toEqual([
      { text: "Hello", speaker: "user1" },
    ]);
    expect(transcriptFixture.status).toBe("completed");
    expect(transcriptFixture.save).toHaveBeenCalled();
  });

  it("cleans up audio file after successful transcription", async () => {
    await processTranscriptionJob(jobFixture);

    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/audio.wav");
  });

  it("indexes transcript and updates meeting", async () => {
    await processTranscriptionJob(jobFixture);

    expect(indexTranscript).toHaveBeenCalledWith(transcriptFixture);
    expect(Meeting.findByIdAndUpdate).toHaveBeenCalledWith(meetingId, {
      transcript: "Transcribed audio content",
    });
  });

  it("enqueues sentiment analysis job on success", async () => {
    await processTranscriptionJob(jobFixture);

    expect(sentimentAnalysisQueue.add).toHaveBeenCalledWith("analyze-sentiment", {
      transcriptId,
    });
  });

  it("marks transcript as failed and preserves error message on failure", async () => {
    const error = new Error("Audio processing failed");
    transcribeFileWithSegments.mockRejectedValue(error);

    try {
      await processTranscriptionJob(jobFixture);
    } catch (err) {
      // Expected to throw
    }

    expect(transcriptFixture.status).toBe("failed");
    expect(transcriptFixture.errorMessage).toBe("Audio processing failed");
    expect(transcriptFixture.save).toHaveBeenCalled();
  });

  it("throws error when transcript not found", async () => {
    Transcript.findById.mockResolvedValue(null);

    await expect(processTranscriptionJob(jobFixture)).rejects.toThrow(
      `Transcript ${transcriptId} not found`,
    );
  });
});