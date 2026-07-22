import express from "express";
import mongoose from "mongoose";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import CalendarConnection from "../models/calendarConnectionModel.js";
import {
  getGoogleTokens,
  getMicrosoftTokens,
  encryptToken,
} from "../services/calendarService.js";
import {
  getConnectionStatus,
  getGoogleOAuthUrl,
  handleGoogleCallback,
  getMicrosoftOAuthUrl,
  handleMicrosoftCallback,
  disconnectCalendar,
  resyncCalendar,
  getFreeBusyAvailability,
  getExternalEvents,
} from "../controllers/calendarController.js";

const router = express.Router();

// Apply apiLimiter rate limiting
router.use(apiLimiter);

// GET connection status (requires authentication)
router.get("/status", userAuth, getConnectionStatus);

// Google OAuth Authorization URL
router.get("/google/auth-url", userAuth, getGoogleOAuthUrl);

// Microsoft OAuth Authorization URL
router.get("/microsoft/auth-url", userAuth, getMicrosoftOAuthUrl);

// Disconnect calendar provider (requires auth and write limit)
router.delete("/:provider/disconnect", userAuth, writeLimiter, disconnectCalendar);

// Manual resync (requires auth and write limit)
router.post("/:provider/resync", userAuth, writeLimiter, resyncCalendar);

// Free/busy availability (requires auth)
router.post("/freebusy", userAuth, getFreeBusyAvailability);

// Synced external events (requires auth)
router.get("/external-events", userAuth, getExternalEvents);
router.get("/events", userAuth, getExternalEvents); // alias for backwards compatibility

// --- GET OAuth Callbacks (No auth header expected, tracks owner via state query param) ---

// Google Callback
router.get("/google/callback", async (req, res) => {
  try {
    let { code, state: userId } = req.query;
    if (!code || !userId) throw new Error("Missing authorization code or state parameter.");

    userId = String(userId);
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid state/userId identifier.");
    }

    const tokens = await getGoogleTokens(code);
    const tokenExpiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000); // default 1h

    // Create or update connection
    await CalendarConnection.findOneAndUpdate(
      { user: userId, provider: "google" },
      {
        accessToken: encryptToken(tokens.access_token),
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined,
        tokenExpiresAt,
        syncStatus: "connected",
        syncError: null,
        lastSyncAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Return HTML to close the popup automatically
    res.send("<html><body><script>window.close();</script><p>Connection successful! You can close this window.</p></body></html>");
  } catch (error) {
    console.error("Google OAuth callback error:", error.message);
    res.send(`<html><body><script>alert("Failed to connect Google Calendar: ${error.message}"); window.close();</script></body></html>`);
  }
});

// Microsoft Callback
const handleMicrosoftCallbackGet = async (req, res) => {
  try {
    let { code, state: userId } = req.query;
    if (!code || !userId) throw new Error("Missing authorization code or state parameter.");

    userId = String(userId);
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid state/userId identifier.");
    }

    const tokenResponse = await getMicrosoftTokens(code);
    // Microsoft tokens typically expire in 1 hour (expiresOn is seconds)
    const tokenExpiresAt = new Date(
      Date.now() + (tokenResponse.expiresOn || 3600) * 1000
    );

    // Create or update connection
    await CalendarConnection.findOneAndUpdate(
      { user: userId, provider: "microsoft" },
      {
        accessToken: encryptToken(tokenResponse.accessToken),
        refreshToken: tokenResponse.refreshToken ? encryptToken(tokenResponse.refreshToken) : undefined,
        tokenExpiresAt,
        syncStatus: "connected",
        syncError: null,
        lastSyncAt: new Date(),
        providerData: {
          email: tokenResponse.account?.username || null,
        },
      },
      { upsert: true, new: true }
    );

    // Return HTML to close the popup automatically
    res.send("<html><body><script>window.close();</script><p>Connection successful! You can close this window.</p></body></html>");
  } catch (error) {
    console.error("Microsoft OAuth callback error:", error.message);
    res.send(`<html><body><script>alert("Failed to connect Microsoft Calendar: ${error.message}"); window.close();</script></body></html>`);
  }
};

router.get("/microsoft/callback", handleMicrosoftCallbackGet);
router.get("/outlook/callback", handleMicrosoftCallbackGet);

export default router;
