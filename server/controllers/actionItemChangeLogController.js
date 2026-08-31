import ActionItemChangeLog from "../models/actionItemChangeLogModel.js";
import { buildPaginationMeta, parsePagination } from "../utils/pagination.js";

/**
 * @desc Get changelogs for a specific action item
 * @route GET /api/action-items/:id/changelog
 * @access Private
 */
export const getChangeLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, userId } = req.query;

    const query = { actionItemId: id };
    if (type) query.changeType = type;
    if (userId) query.changedBy = userId;

    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 50,
    });

    const logs = await ActionItemChangeLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("changedBy", "name avatar email");

    const total = await ActionItemChangeLog.countDocuments(query);

    const pagination = buildPaginationMeta({ total, page, limit });

    res.status(200).json({
      success: true,
      data: logs,
      pagination,
    });
  } catch (error) {
    console.error("Error fetching changelogs:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

/**
 * @desc Get changelog statistics for an action item
 * @route GET /api/action-items/:id/changelog/stats
 * @access Private
 */
export const getChangeLogStats = async (req, res) => {
  try {
    const { id } = req.params;

    const stats = await ActionItemChangeLog.aggregate([
      { $match: { actionItemId: id } },
      {
        $group: {
          _id: null,
          totalChanges: { $sum: 1 },
          uniqueEditors: { $addToSet: "$changedBy" },
          statusChanges: {
            $sum: { $cond: [{ $eq: ["$changeType", "status"] }, 1, 0] },
          },
          reassignments: {
            $sum: { $cond: [{ $eq: ["$changeType", "assignee"] }, 1, 0] },
          },
          dueDateChanges: {
            $sum: { $cond: [{ $eq: ["$changeType", "dueDate"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalChanges: 1,
          uniqueEditorsCount: { $size: "$uniqueEditors" },
          statusChanges: 1,
          reassignments: 1,
          dueDateChanges: 1,
        },
      },
    ]);

    const result =
      stats.length > 0
        ? stats[0]
        : {
            totalChanges: 0,
            uniqueEditorsCount: 0,
            statusChanges: 0,
            reassignments: 0,
            dueDateChanges: 0,
          };

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching changelog stats:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};
