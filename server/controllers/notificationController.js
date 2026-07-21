// server/controllers/notificationController.js
import notificationModel from "../models/notificationModel.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

// Helper to format notification response
const formatNotificationResponse = (notification) => {
  return {
    id: notification._id,
    title: notification.title,
    description: notification.description,
    category: notification.category,
    isRead: notification.isRead,
    actionUrl: notification.actionUrl,
    actionLabel: notification.actionLabel,
    metadata: notification.metadata,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
};

// @desc    Get all notifications for a user
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const { category, status } = req.query;

    let query = notificationModel.find({ user: req.user.id });

    if (category === "meetings") {
      query = query.where("category").equals("meetings");
    } else if (category === "ai_processing") {
      query = query.where("category").equals("ai_processing");
    } else if (category === "organizations") {
      query = query.where("category").equals("organizations");
    } else if (category === "policies") {
      query = query.where("category").equals("policies");
    } else if (category === "reports") {
      query = query.where("category").equals("reports");
    } else if (category === "system") {
      query = query.where("category").equals("system");
    }

    if (status === "unread") {
      query = query.where("isRead").equals(false);
    } else if (status === "read") {
      query = query.where("isRead").equals(true);
    }

    const notifications = await query.sort({ createdAt: -1 }).limit(100);

    const unreadCount = await notificationModel.countDocuments({
      user: req.user.id,
      isRead: false,
    });

    sendSuccess(res, {
      notifications: notifications.map(formatNotificationResponse),
      unreadCount,
    });
  } catch (error) {
    console.error("Error in getNotifications:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const notification = await notificationModel.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true },
      { new: true },
    );

    if (!notification) {
      return sendError(res, 404, "Notification not found");
    }

    sendSuccess(
      res,
      { notification: formatNotificationResponse(notification) },
      "Notification marked as read",
    );
  } catch (error) {
    console.error("Error in markAsRead:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/mark-all-read
// @access  Private
export const markAllAsRead = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const result = await notificationModel.updateMany(
      { user: req.user.id, isRead: false },
      { isRead: true },
    );

    sendSuccess(
      res,
      { modifiedCount: result.modifiedCount },
      "All notifications marked as read",
    );
  } catch (error) {
    console.error("Error in markAllAsRead:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const notification = await notificationModel.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!notification) {
      return sendError(res, 404, "Notification not found");
    }

    sendSuccess(res, null, "Notification deleted");
  } catch (error) {
    console.error("Error in deleteNotification:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Get unread count
// @route   GET /api/notifications/unread-count
// @access  Private
export const getUnreadCount = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const unreadCount = await notificationModel.countDocuments({
      user: req.user.id,
      isRead: false,
    });

    sendSuccess(res, { unreadCount });
  } catch (error) {
    console.error("Error in getUnreadCount:", error);
    sendError(res, 500, "Server error");
  }
};
