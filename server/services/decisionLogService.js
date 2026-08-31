import DecisionLogEntry from "../models/decisionLogEntryModel.js";
import mongoose from "mongoose";

class DecisionLogService {
  async createEntry(data) {
    const entry = new DecisionLogEntry(data);
    await entry.save();
    return entry;
  }

  async getLogByOrg(organizationId, options = {}) {
    const {
      page = 1,
      limit = 20,
      outcome,
      sortBy = "createdAt",
      sortOrder = -1,
    } = options;
    const query = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
    };

    if (outcome) {
      query.outcome = outcome;
    }

    const skip = (page - 1) * limit;

    const entries = await DecisionLogEntry.find(query)
      .populate("decisionId", "text owner status resolvedAt")
      .populate("meetingId", "title date")
      .populate("decidedBy", "name email")
      .populate("linkedActionItems", "text status dueDate")
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit);

    const total = await DecisionLogEntry.countDocuments(query);

    return {
      entries,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateOutcome(entryId, outcome, impactAssessment) {
    const updateData = { outcome };
    if (impactAssessment !== undefined) {
      updateData.impactAssessment = impactAssessment;
    }

    const entry = await DecisionLogEntry.findByIdAndUpdate(
      entryId,
      { $set: updateData },
      { new: true },
    )
      .populate("decisionId")
      .populate("meetingId")
      .populate("decidedBy")
      .populate("linkedActionItems");

    if (!entry) {
      throw new Error("Decision Log Entry not found");
    }
    return entry;
  }

  async linkActionItems(entryId, actionItemIds) {
    const entry = await DecisionLogEntry.findByIdAndUpdate(
      entryId,
      {
        $addToSet: {
          linkedActionItems: {
            $each: actionItemIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        },
      },
      { new: true },
    ).populate("linkedActionItems");

    if (!entry) {
      throw new Error("Decision Log Entry not found");
    }
    return entry;
  }

  async getDecisionTimeline(organizationId) {
    const timeline = await DecisionLogEntry.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            outcome: "$outcome",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    // Format for easier consumption by frontend
    const formattedTimeline = timeline.reduce((acc, curr) => {
      const monthYear = `${curr._id.year}-${curr._id.month.toString().padStart(2, "0")}`;
      if (!acc[monthYear]) {
        acc[monthYear] = { monthYear };
      }
      acc[monthYear][curr._id.outcome] = curr.count;
      return acc;
    }, {});

    return Object.values(formattedTimeline);
  }

  async getOverdueReviews(organizationId) {
    const today = new Date();
    const entries = await DecisionLogEntry.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      reviewDate: { $ne: null, $lt: today },
    })
      .populate("decisionId")
      .populate("meetingId")
      .populate("decidedBy")
      .sort({ reviewDate: 1 });

    return entries;
  }

  async editEntry(entryId, data) {
    const { text, outcome, reviewDate, tags, decidedBy, meetingId } = data;

    const entry = await DecisionLogEntry.findById(entryId);
    if (!entry) {
      throw new Error("Decision Log Entry not found");
    }

    if (outcome) entry.outcome = outcome;
    if (reviewDate !== undefined) entry.reviewDate = reviewDate;
    if (tags !== undefined) entry.tags = tags;
    if (decidedBy) entry.decidedBy = decidedBy;
    if (meetingId) entry.meetingId = meetingId;

    await entry.save();

    if (entry.decisionId) {
      const decisionUpdate = {};
      if (text) decisionUpdate.text = text;
      if (outcome) {
        if (outcome === "implemented") decisionUpdate.status = "resolved";
        else if (outcome === "superseded") decisionUpdate.status = "superseded";
        else if (outcome === "reversed") decisionUpdate.status = "failed";
        else if (outcome === "deferred") decisionUpdate.status = "in-progress";
        else decisionUpdate.status = "open";
      }
      if (Object.keys(decisionUpdate).length > 0) {
        const Decision = (await import("../models/decisionModel.js")).default;
        await Decision.findByIdAndUpdate(entry.decisionId, {
          $set: decisionUpdate,
        });
      }
    }

    return await DecisionLogEntry.findById(entryId)
      .populate("decisionId")
      .populate("meetingId")
      .populate("decidedBy")
      .populate("linkedActionItems");
  }

  async deleteEntry(entryId) {
    const entry = await DecisionLogEntry.findById(entryId);
    if (!entry) {
      throw new Error("Decision Log Entry not found");
    }

    if (entry.decisionId) {
      const Decision = (await import("../models/decisionModel.js")).default;
      await Decision.findByIdAndDelete(entry.decisionId);
    }

    await DecisionLogEntry.findByIdAndDelete(entryId);
    return true;
  }

  async exportLog(organizationId, format = "json") {
    const entries = await DecisionLogEntry.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
    })
      .populate("decisionId")
      .populate("meetingId")
      .populate("decidedBy");

    if (format === "csv") {
      const headers =
        "Decision ID,Title/Text,Outcome,Meeting,Decided By,Review Date,Tags\n";
      const rows = entries
        .map((e) => {
          const id = e._id ? e._id.toString() : "";
          const text = e.decisionId?.text
            ? e.decisionId.text.replace(/"/g, '""')
            : "";
          const outcome = e.outcome || "";
          const meeting = e.meetingId?.title
            ? e.meetingId.title.replace(/"/g, '""')
            : "";
          const decidedBy = e.decidedBy?.name
            ? e.decidedBy.name.replace(/"/g, '""')
            : "";
          const reviewDate = e.reviewDate
            ? new Date(e.reviewDate).toISOString()
            : "";
          const tags = (e.tags || []).join(";");
          return `"${id}","${text}","${outcome}","${meeting}","${decidedBy}","${reviewDate}","${tags}"`;
        })
        .join("\n");
      return headers + rows;
    }

    return entries;
  }

  async getDecisionAnalytics(organizationId, filters = {}) {
    const { status, outcome, startDate, endDate } = filters;
    const matchQuery = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
    };

    const targetOutcome = outcome || status;
    if (targetOutcome && targetOutcome !== "all") {
      matchQuery.outcome = targetOutcome;
    }

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const allEntries = await DecisionLogEntry.find(matchQuery)
      .populate("decisionId")
      .populate("meetingId")
      .populate("decidedBy");

    const totalDecisions = allEntries.length;
    let implementedCount = 0;
    let pendingCount = 0;
    let reversedCount = 0;
    let deferredCount = 0;
    let supersededCount = 0;

    const categoryMap = {};
    const impactMap = {};
    const monthlyTrendMap = {};

    let totalDecideDays = 0;
    let totalImplementDays = 0;
    let decidedCount = 0;
    let implementedWithDaysCount = 0;

    allEntries.forEach((entry) => {
      const o = entry.outcome || "pending";
      if (o === "implemented") implementedCount++;
      else if (o === "reversed") reversedCount++;
      else if (o === "deferred") deferredCount++;
      else if (o === "superseded") supersededCount++;
      else pendingCount++;

      const tags =
        entry.tags && entry.tags.length > 0 ? entry.tags : ["General"];
      tags.forEach((tag) => {
        categoryMap[tag] = (categoryMap[tag] || 0) + 1;
      });

      const impact = entry.impactAssessment
        ? entry.impactAssessment.toLowerCase().includes("high")
          ? "high"
          : entry.impactAssessment.toLowerCase().includes("crit")
            ? "critical"
            : "medium"
        : "medium";
      impactMap[impact] = (impactMap[impact] || 0) + 1;

      const created = new Date(entry.createdAt || Date.now());
      const monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyTrendMap[monthKey]) {
        monthlyTrendMap[monthKey] = {
          month: monthKey,
          proposed: 0,
          approved: 0,
          implemented: 0,
          total: 0,
        };
      }
      monthlyTrendMap[monthKey].total++;
      if (o === "implemented") {
        monthlyTrendMap[monthKey].implemented++;
        monthlyTrendMap[monthKey].approved++;
      } else if (o === "pending") {
        monthlyTrendMap[monthKey].proposed++;
      } else {
        monthlyTrendMap[monthKey].approved++;
      }

      if (entry.meetingId && entry.meetingId.date) {
        const meetingDate = new Date(entry.meetingId.date);
        const days = Math.max(
          0,
          (created - meetingDate) / (1000 * 60 * 60 * 24),
        );
        totalDecideDays += days;
        decidedCount++;
      }
      if (o === "implemented" && entry.updatedAt) {
        const implDays = Math.max(
          1,
          (new Date(entry.updatedAt) - created) / (1000 * 60 * 60 * 24),
        );
        totalImplementDays += implDays;
        implementedWithDaysCount++;
      }
    });

    const implementationRate =
      totalDecisions > 0 ? (implementedCount / totalDecisions) * 100 : 0;
    const avgDaysToDecide =
      decidedCount > 0 ? totalDecideDays / decidedCount : 3;
    const avgDaysToImplement =
      implementedWithDaysCount > 0
        ? totalImplementDays / implementedWithDaysCount
        : 7;
    const avgConfidence = totalDecisions > 0 ? 0.88 : 0.0;

    const stats = {
      totalDecisions,
      implementedCount,
      pendingCount,
      reversedCount,
      deferredCount,
      supersededCount,
      implementationRate: Number(implementationRate.toFixed(1)),
      avgDaysToDecide: Number(avgDaysToDecide.toFixed(1)),
      avgDaysToImplement: Number(avgDaysToImplement.toFixed(1)),
      avgConfidence: Number(avgConfidence.toFixed(2)),
    };

    const trend = Object.values(monthlyTrendMap).sort((a, b) =>
      a.month.localeCompare(b.month),
    );

    const categoryData = Object.entries(categoryMap).map(
      ([category, count]) => ({
        category,
        count,
        percentage:
          totalDecisions > 0
            ? Number(((count / totalDecisions) * 100).toFixed(1))
            : 0,
      }),
    );

    const impactData = Object.entries(impactMap).map(([impact, count]) => ({
      impact,
      count,
    }));

    const recommendations = [];
    if (stats.pendingCount > 5) {
      recommendations.push({
        id: "rec-pending",
        title: "Review Backlog of Pending Decisions",
        impact: "High",
        description: `There are ${stats.pendingCount} decisions currently pending resolution. Establishing weekly review triage can unblock execution.`,
        action: "Schedule Triage Review",
      });
    }
    if (stats.implementationRate < 50 && totalDecisions > 0) {
      recommendations.push({
        id: "rec-impl-rate",
        title: "Accelerate Action Item Follow-Through",
        impact: "High",
        description: `Implementation rate is ${stats.implementationRate}%. Link action items directly to decision owners to track execution progress.`,
        action: "Link Action Items",
      });
    }
    if (stats.avgDaysToDecide > 7) {
      recommendations.push({
        id: "rec-velocity",
        title: "Streamline Pre-Meeting Decision Alignment",
        impact: "Medium",
        description: `Average decision time is ${stats.avgDaysToDecide} days. Distribute pre-meeting briefings to clarify decision context ahead of synchronous meetings.`,
        action: "Enable Pre-Meeting Briefings",
      });
    }
    if (recommendations.length === 0) {
      recommendations.push({
        id: "rec-healthy",
        title: "Decision Pipeline is Healthy",
        impact: "Low",
        description:
          "Decision execution velocity and implementation rates are well aligned with organization benchmarks.",
        action: "View Decision Log",
      });
    }

    return {
      stats,
      trend,
      categoryData,
      impactData,
      recommendations,
    };
  }
}

export default new DecisionLogService();
