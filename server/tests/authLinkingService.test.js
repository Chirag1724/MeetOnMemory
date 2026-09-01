import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";
import {
  findUserByClerkId,
  linkUserToClerkId,
  findUserByEmail,
  provisionOrLinkClerkUser,
} from "../services/authLinkingService.js";
import userModel from "../models/userModel.js";
import * as userAccountMergeService from "../services/userAccountMergeService.js";

// Mock dependencies
vi.mock("../models/userModel.js", () => {
  return {
    default: {
      findOne: vi.fn(),
      findByIdAndUpdate: vi.fn(),
      findOneAndUpdate: vi.fn(),
      create: vi.fn(),
    },
  };
});

vi.mock("../services/userAccountMergeService.js", () => {
  return {
    isPlaceholderClerkEmail: vi.fn(
      (email) => email?.endsWith("@clerk.placeholder") || false,
    ),
    mergePlaceholderAccount: vi.fn(),
  };
});

describe("authLinkingService", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("findUserByClerkId", () => {
    it("should return null if no clerkUserId is provided", async () => {
      const result = await findUserByClerkId(null);
      expect(result).toBeNull();
      expect(userModel.findOne).not.toHaveBeenCalled();
    });

    it("should call userModel.findOne and exclude password", async () => {
      const mockSelect = vi.fn().mockResolvedValue({ id: "123" });
      userModel.findOne.mockReturnValue({ select: mockSelect });

      const result = await findUserByClerkId("clerk_123");

      expect(userModel.findOne).toHaveBeenCalledWith({
        clerkUserId: "clerk_123",
      });
      expect(mockSelect).toHaveBeenCalledWith("-password");
      expect(result).toEqual({ id: "123" });
    });
  });

  describe("linkUserToClerkId", () => {
    it("should throw an error if mongoUserId is missing", async () => {
      await expect(linkUserToClerkId(null, "clerk_123")).rejects.toThrow(
        "Missing required IDs for linking",
      );
    });

    it("should throw an error if clerkUserId is missing", async () => {
      await expect(linkUserToClerkId("mongo_123", null)).rejects.toThrow(
        "Missing required IDs for linking",
      );
    });

    it("should update the user via findByIdAndUpdate", async () => {
      const mockSelect = vi
        .fn()
        .mockResolvedValue({ id: "mongo_123", clerkUserId: "clerk_123" });
      userModel.findByIdAndUpdate.mockReturnValue({ select: mockSelect });

      const result = await linkUserToClerkId("mongo_123", "clerk_123");

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "mongo_123",
        { $set: { clerkUserId: "clerk_123" } },
        { new: true },
      );
      expect(mockSelect).toHaveBeenCalledWith("-password");
      expect(result).toHaveProperty("clerkUserId", "clerk_123");
    });
  });

  describe("findUserByEmail", () => {
    it("should return null if no email is provided", async () => {
      const result = await findUserByEmail(null);
      expect(result).toBeNull();
    });

    it("should query userModel.findOne by email", async () => {
      const mockSelect = vi
        .fn()
        .mockResolvedValue({ email: "test@example.com" });
      userModel.findOne.mockReturnValue({ select: mockSelect });

      const result = await findUserByEmail("test@example.com");

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: "test@example.com",
      });
      expect(mockSelect).toHaveBeenCalledWith("-password");
      expect(result).toEqual({ email: "test@example.com" });
    });
  });

  describe("provisionOrLinkClerkUser (Concurrency Fix)", () => {
    it("should throw an error if clerkUserId is missing", async () => {
      await expect(
        provisionOrLinkClerkUser({ email: "a@b.com" }),
      ).rejects.toThrow("clerkUserId is required for Clerk user provisioning");
    });

    it("should update existing user atomically via findOneAndUpdate without calling save() to avoid VersionError", async () => {
      const mockExistingUser = {
        _id: new mongoose.Types.ObjectId(),
        clerkUserId: "clerk_user_1",
        name: "User", // Requires update
        email: "placeholder@clerk.placeholder", // Requires update
        profilePic: "", // Requires update
      };

      const mockSelect = vi.fn().mockResolvedValue(mockExistingUser);
      userModel.findOne.mockReturnValue({ select: mockSelect });

      // Mock the secondary findOne for email occupancy check
      userModel.findOne.mockReturnValueOnce({ select: mockSelect });
      const leanMock = vi.fn().mockResolvedValue(null); // No one owns the email
      userModel.findOne.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({ lean: leanMock }),
      });

      const mockUpdatedUser = {
        ...mockExistingUser,
        name: "New Name",
        profilePic: "http://pic.com/1.png",
        email: "real@domain.com",
      };
      const updateSelectMock = vi.fn().mockResolvedValue(mockUpdatedUser);
      userModel.findOneAndUpdate.mockReturnValue({ select: updateSelectMock });

      const result = await provisionOrLinkClerkUser({
        clerkUserId: "clerk_user_1",
        email: "real@domain.com",
        name: "New Name",
        profilePic: "http://pic.com/1.png",
      });

      // Verify that findOneAndUpdate was called instead of save()
      expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: mockExistingUser._id },
        {
          $set: {
            profilePic: "http://pic.com/1.png",
            name: "New Name",
            email: "real@domain.com",
          },
        },
        { new: true },
      );
      expect(result).toEqual(mockUpdatedUser);
      // Ensure we didn't accidentally call .save()
      expect(mockExistingUser.save).toBeUndefined();
    });

    it("should successfully handle concurrent requests (simulated) without save collision", async () => {
      // Setup mock where the user exists, simulating two simultaneous webhook events
      const mockExistingUser = {
        _id: new mongoose.Types.ObjectId(),
        clerkUserId: "clerk_concurrent",
      };

      userModel.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockExistingUser),
      });

      const updateSelectMock = vi.fn().mockResolvedValue(mockExistingUser);
      userModel.findOneAndUpdate.mockReturnValue({ select: updateSelectMock });

      // Simulate concurrent requests
      const promises = [
        provisionOrLinkClerkUser({
          clerkUserId: "clerk_concurrent",
          name: "Req 1",
        }),
        provisionOrLinkClerkUser({
          clerkUserId: "clerk_concurrent",
          name: "Req 2",
        }),
      ];

      await Promise.all(promises);

      // Verify findOneAndUpdate was called twice, safely handling concurrency at DB level
      expect(userModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    });

    it("should perform legacy email link atomically using findOneAndUpdate", async () => {
      // Mock existing user found via email, but NOT clerkUserId
      userModel.findOne.mockReturnValueOnce({
        select: vi.fn().mockResolvedValue(null),
      }); // By clerkId

      const mockLegacyUser = {
        _id: new mongoose.Types.ObjectId(),
        email: "legacy@domain.com",
      };
      userModel.findOne.mockReturnValueOnce({
        select: vi.fn().mockResolvedValue(mockLegacyUser),
      }); // By email

      const mockUpdatedUser = { ...mockLegacyUser, clerkUserId: "clerk_new" };
      const updateSelectMock = vi.fn().mockResolvedValue(mockUpdatedUser);
      userModel.findOneAndUpdate.mockReturnValue({ select: updateSelectMock });

      const result = await provisionOrLinkClerkUser({
        clerkUserId: "clerk_new",
        email: "legacy@domain.com",
      });

      expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: mockLegacyUser._id },
        { $set: { clerkUserId: "clerk_new" } },
        { new: true },
      );
      expect(result).toEqual(mockUpdatedUser);
    });

    it("should create a new provisioned user if no existing user matches", async () => {
      userModel.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      const mockNewUser = {
        _id: new mongoose.Types.ObjectId(),
        clerkUserId: "clerk_create",
        email: "create@domain.com",
        toObject: vi.fn().mockReturnThis(),
      };
      userModel.create.mockResolvedValue(mockNewUser);

      const result = await provisionOrLinkClerkUser({
        clerkUserId: "clerk_create",
        email: "create@domain.com",
        name: "New Guy",
      });

      expect(userModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clerkUserId: "clerk_create",
          email: "create@domain.com",
          name: "New Guy",
          isAccountVerified: true,
        }),
      );
      expect(result).toEqual(mockNewUser);
    });

    it("should trigger placeholder account merge if email is already occupied by another account", async () => {
      const mockPlaceholderUser = {
        _id: new mongoose.Types.ObjectId(),
        clerkUserId: "clerk_placeholder",
        email: "clerk_placeholder@clerk.placeholder",
      };

      const mockRealOwner = {
        _id: new mongoose.Types.ObjectId(),
        email: "real@domain.com",
      };

      // 1. By clerkId returns placeholder
      userModel.findOne.mockReturnValueOnce({
        select: vi.fn().mockResolvedValue(mockPlaceholderUser),
      });

      // 2. Email occupancy check returns a different user
      userModel.findOne.mockReturnValueOnce({
        select: vi
          .fn()
          .mockReturnValue({ lean: vi.fn().mockResolvedValue(mockRealOwner) }),
      });

      const mockMergedUser = {
        ...mockRealOwner,
        clerkUserId: "clerk_placeholder",
      };
      userAccountMergeService.mergePlaceholderAccount.mockResolvedValue(
        mockMergedUser,
      );

      const result = await provisionOrLinkClerkUser({
        clerkUserId: "clerk_placeholder",
        email: "real@domain.com",
      });

      expect(
        userAccountMergeService.mergePlaceholderAccount,
      ).toHaveBeenCalledWith({
        placeholder: mockPlaceholderUser,
        verified: mockRealOwner,
        clerkUserId: "clerk_placeholder",
        email: "real@domain.com",
        name: undefined,
        profilePic: undefined,
      });
      expect(result).toEqual(mockMergedUser);
    });
  });
});
