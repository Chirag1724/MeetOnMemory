import ActionItem from "../models/actionItemModel.js";
import ActionItemSlaConfig from "../models/actionItemSlaConfigModel.js";
import ActionItemSlaBreach from "../models/actionItemSlaBreachModel.js";
import mongoose from "mongoose";
import eventBus from "./eventBus.js";
import { createNotification } from "./notificationService.js";

class ActionItemSlaService {
  /**
   * Get SLA configuration for an organization
   */
  async getConfig(organizationId) {
    let config = await ActionItemSlaConfig.findOne({
      organization: organizationId,
    });
    if (!config) {
      config = await ActionItemSlaConfig.create({
        organization: organizationId,
      });
    }
    return config;
  }

  /**
   * Update SLA configuration for an organization
   */
  async updateConfig(organizationId, updates) {
    const config = await ActionItemSlaConfig.findOneAndUpdate(
      { organization: organizationId },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return config;
  }

  /**
   * Get all breaches with optional filtering
   */
  async getBreaches(organizationId, filters = {}) {
    const query = { organization: organizationId };
    if (filters.status) query.status = filters.status;
    if (filters.assignee) query.assignee = filters.assignee;

    return await ActionItemSlaBreach.find(query)
      .populate(
        "actionItem",
        "text status priority dueDate createdAt resolvedAt sourceMeetingId",
      )
      .populate("assignee", "name email")
      .populate("acknowledgedBy", "name email")
      .sort({ createdAt: -1 });
  }

  /**
   * Acknowledge a breach
   */
  async acknowledgeBreach(breachId, userId) {
    const breach = await ActionItemSlaBreach.findByIdAndUpdate(
      breachId,
      {
        status: "acknowledged",
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
      { new: true },
    );
    return breach;
  }

  async detectBreaches(organizationId) {
    const config = await this.getConfig(organizationId);
    if (!config.enabled) return { newBreaches: 0 };

    const cursor = ActionItem.find({
      organization: organizationId,
      status: { $nin: ["cancelled", "superseded"] },
    }).cursor();

    const now = new Date();
    let newBreachesCount = 0;

    let actionItemUpdates = [];
    let breachDocsToInsert = [];
    let notificationsToEmit = [];

    const flushBatch = async () => {
      const promises = [];

      if (actionItemUpdates.length > 0) {
        promises.push(ActionItem.bulkWrite(actionItemUpdates));
      }

      if (breachDocsToInsert.length > 0) {
        const inserts = breachDocsToInsert.map((b) => ({
          insertOne: { document: b },
        }));
        promises.push(
          ActionItemSlaBreach.bulkWrite(inserts, { ordered: false })
            .then((res) => {
              if (res.insertedIds) {
                Object.keys(res.insertedIds).forEach((index) => {
                  const docIndex = parseInt(index);
                  const doc = breachDocsToInsert[docIndex];
                  eventBus.emit("sla.breach.detected", {
                    organizationId: doc.organization,
                    breachId: res.insertedIds[index],
                    actionItemId: doc.actionItem,
                  });
                });
                newBreachesCount += Object.keys(res.insertedIds).length;
              }
            })
            .catch((err) => {
              if (err.result && err.result.insertedIds) {
                Object.keys(err.result.insertedIds).forEach((index) => {
                  const docIndex = parseInt(index);
                  const doc = breachDocsToInsert[docIndex];
                  eventBus.emit("sla.breach.detected", {
                    organizationId: doc.organization,
                    breachId: err.result.insertedIds[index],
                    actionItemId: doc.actionItem,
                  });
                });
                newBreachesCount += Object.keys(err.result.insertedIds).length;
              }
            }),
        );
      }

      if (notificationsToEmit.length > 0) {
        const notifPromises = notificationsToEmit.map((n) =>
          createNotification(...n),
        );
        promises.push(Promise.allSettled(notifPromises));
      }

      await Promise.allSettled(promises);

      actionItemUpdates = [];
      breachDocsToInsert = [];
      notificationsToEmit = [];
    };

    for await (const item of cursor) {
      const targets = config.targets[item.priority] || config.targets.medium;

      // Skip active alerting if snoozed
      if (item.snoozedUntil && now < item.snoozedUntil) {
        continue;
      }

      const isResolved = ["resolved", "completed"].includes(item.status);
      let needsUpdate = false;

      // Check custom warning offsets before breach
      if (item.customWarningOffsets && item.customWarningOffsets.length > 0) {
        const responseBreachTime = new Date(
          item.createdAt.getTime() +
            targets.targetResponseHours * 60 * 60 * 1000,
        );
        const resolutionBreachTime = new Date(
          item.createdAt.getTime() +
            targets.targetResolutionHours * 60 * 60 * 1000,
        );

        for (const offset of item.customWarningOffsets) {
          const warningTimeResponse = new Date(
            responseBreachTime.getTime() - offset * 60 * 1000,
          );
          const warningTimeResolution = new Date(
            resolutionBreachTime.getTime() - offset * 60 * 1000,
          );

          // Response Warning
          if (
            item.status === "open" &&
            now >= warningTimeResponse &&
            now < responseBreachTime &&
            !item.warningsSent.includes(offset)
          ) {
            if (item.assignee) {
              notificationsToEmit.push([
                item.assignee,
                "SLA Response Warning Alert",
                `The task "${item.text}" is approaching its Response SLA limit (${targets.targetResponseHours}h).`,
                "tasks",
                `/followup/tasks/${item._id}`,
                "View Task",
                { actionItemId: item._id },
              ]);
            }
            item.warningsSent.push(offset);
            needsUpdate = true;
          }

          // Resolution Warning
          if (
            !isResolved &&
            now >= warningTimeResolution &&
            now < resolutionBreachTime &&
            !item.warningsSent.includes(offset)
          ) {
            if (item.assignee) {
              notificationsToEmit.push([
                item.assignee,
                "SLA Resolution Warning Alert",
                `The task "${item.text}" is approaching its Resolution SLA limit (${targets.targetResolutionHours}h).`,
                "tasks",
                `/followup/tasks/${item._id}`,
                "View Task",
                { actionItemId: item._id },
              ]);
            }
            item.warningsSent.push(offset);
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        actionItemUpdates.push({
          updateOne: {
            filter: { _id: item._id },
            update: { $set: { warningsSent: item.warningsSent } },
          },
        });
      }

      // Calculate actual hours since creation
      const hoursSinceCreation = (now - item.createdAt) / (1000 * 60 * 60);

      // 1. Check Response SLA (Time to move out of 'open')
      if (
        item.status === "open" &&
        hoursSinceCreation > targets.targetResponseHours
      ) {
        breachDocsToInsert.push({
          actionItem: item._id,
          organization: organizationId,
          assignee: item.assignee,
          priority: item.priority,
          breachType: "response",
          targetHours: targets.targetResponseHours,
          actualHours: Math.round(hoursSinceCreation * 10) / 10,
        });
      }

      // 2. Check Resolution SLA (Time to move to 'resolved' or 'completed')
      let resolutionHours = hoursSinceCreation;
      if (isResolved && item.resolvedAt) {
        resolutionHours = (item.resolvedAt - item.createdAt) / (1000 * 60 * 60);
      } else if (isResolved && item.completedAt) {
        resolutionHours =
          (item.completedAt - item.createdAt) / (1000 * 60 * 60);
      }

      if (
        (!isResolved && hoursSinceCreation > targets.targetResolutionHours) ||
        (isResolved && resolutionHours > targets.targetResolutionHours)
      ) {
        breachDocsToInsert.push({
          actionItem: item._id,
          organization: organizationId,
          assignee: item.assignee,
          priority: item.priority,
          breachType: "resolution",
          targetHours: targets.targetResolutionHours,
          actualHours: Math.round(resolutionHours * 10) / 10,
        });
      }

      if (
        actionItemUpdates.length >= 100 ||
        breachDocsToInsert.length >= 100 ||
        notificationsToEmit.length >= 100
      ) {
        await flushBatch();
      }
    }

    await flushBatch();

    return { newBreaches: newBreachesCount };
  }

  /**
   * Detect SLA breaches across all organizations
   */
  async detectAllBreaches() {
    // Get all distinct organizations that have active action items
    const organizationIds = await ActionItem.distinct("organization", {
      status: { $nin: ["cancelled", "superseded"] },
      organization: { $ne: null },
    });

    let totalBreaches = 0;
    for (const orgId of organizationIds) {
      const result = await this.detectBreaches(orgId);
      totalBreaches += result.newBreaches;
    }

    return { totalBreaches };
  }

  /**
   * Get SLA compliance statistics
   */
  async getComplianceStats(organizationId) {
    const totalBreaches = await ActionItemSlaBreach.countDocuments({
      organization: organizationId,
    });
    const openBreaches = await ActionItemSlaBreach.countDocuments({
      organization: organizationId,
      status: "open",
    });

    const breachesByAssignee = await ActionItemSlaBreach.aggregate([
      { $match: { organization: new mongoose.Types.ObjectId(organizationId) } },
      { $group: { _id: "$assignee", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    // Populate user info for top assignees
    await ActionItemSlaBreach.populate(breachesByAssignee, {
      path: "_id",
      model: "User",
      select: "name email",
    });

    return {
      totalBreaches,
      openBreaches,
      breachesByAssignee: breachesByAssignee.map((b) => ({
        assignee: b._id,
        count: b.count,
      })),
    };
  }

  /**
   * Notify breach assignee
   */
  async notifyAssignee(breachId) {
    const breach = await ActionItemSlaBreach.findById(breachId)
      .populate("actionItem")
      .populate("assignee");

    if (!breach) {
      throw new Error("Breach not found");
    }

    if (!breach.assignee) {
      throw new Error("No assignee assigned to this task");
    }

    const title = "SLA Compliance Breach Alert";
    const description = `The task "${breach.actionItem.text}" has breached its SLA of ${breach.targetHours} hours (actual: ${Math.round(breach.actualHours)} hours).`;
    const category = "tasks";
    const actionUrl = `/followup/tasks/${breach.actionItem._id}`;
    const actionLabel = "View Task";

    await createNotification(
      breach.assignee._id || breach.assignee,
      title,
      description,
      category,
      actionUrl,
      actionLabel,
      { breachId: breach._id, actionItemId: breach.actionItem._id },
    );

    return breach;
  }
}

export default new ActionItemSlaService();
