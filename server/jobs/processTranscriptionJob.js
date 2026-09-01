// server/jobs/processTranscriptionJob.js
import Transcript from "../models/transcriptModel.js";
import Meeting from "../models/meetingModel.js";
import fs from "fs";
import { transcribeFileWithSegments } from "../services/transcriptionService.js";
import { indexTranscript } from "../services/indexService.js";
import { sentimentAnalysisQueue } from "../services/queueService.js";

/**
 * Process transcription job for uploaded audio.
 * Transcribes audio, updates transcript status, indexes for search,
 * and enqueues sentiment analysis.
 */
export default async function processTranscriptionJob(job) {
  const { transcriptId } = job.data;
  console.log(`🎙️ Processing transcription for transcript ${transcriptId}`);

  try {
    const transcript = await Transcript.findById(transcriptId);
    if (!transcript) {
      throw new Error(`Transcript ${transcriptId} not found`);
    }

    if (!transcript.audioFilePath || !fs.existsSync(transcript.audioFilePath)) {
      throw new Error("Audio file not found");
    }

    // Transcribe audio with segments
    const transcriptionResult = await transcribeFileWithSegments(
      transcript.audioFilePath,
    );

    // Update transcript with results
    transcript.fullText = transcriptionResult.fullText;
    transcript.segments = transcriptionResult.segments;
    transcript.status = "completed";
    if (!transcript.recordingTimestamps) {
      transcript.recordingTimestamps = {};
    }
    transcript.recordingTimestamps.completedAt = new Date();
    await transcript.save();

    // Clean up audio file
    if (fs.existsSync(transcript.audioFilePath)) {
      fs.unlinkSync(transcript.audioFilePath);
    }

    console.log(`✅ Transcription completed for transcript ${transcriptId}`);

    // Index transcript in Pinecone for search
    await indexTranscript(transcript);

    // Update meeting with transcript reference
    const meetingRef = transcript.meeting?._id || transcript.meeting;
    await Meeting.findByIdAndUpdate(meetingRef, {
      transcript: transcriptionResult.fullText,
    });

    console.log(`✅ Transcript indexed and meeting updated`);

    // Queue sentiment analysis job
    if (sentimentAnalysisQueue.isActive) {
      await sentimentAnalysisQueue.add("analyze-sentiment", { transcriptId });
      console.log(
        `✅ Sentiment analysis queued for transcript ${transcriptId}`,
      );
    }

    return { success: true, transcriptId };
  } catch (error) {
    console.error(`❌ Transcription processing failed:`, error);

    // Update transcript status to failed
    const transcript = await Transcript.findById(transcriptId);
    if (transcript) {
      transcript.status = "failed";
      transcript.errorMessage = error.message;
      await transcript.save();
    }

    throw error;
  }
}