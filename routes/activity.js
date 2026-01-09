/**
 * Activity Routes
 *
 * API endpoints for activity logging and audit trail:
 * - View activity logs
 * - Filter by user, action, resource
 * - Activity feed for dashboard
 */

const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

/**
 * GET /api/activity
 * List activity logs with filters
 */
router.get('/', async (req, res) => {
  try {
    const {
      userId,
      action,
      resourceType,
      resourceId,
      limit = 50,
      offset = 0,
      startDate,
      endDate
    } = req.query;

    const where = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;
    if (resourceId) where.resourceId = resourceId;

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const activities = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            address: true,
            userType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const total = await prisma.auditLog.count({ where });

    res.json({
      activities,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + activities.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

/**
 * GET /api/activity/user/:userId
 * Get activity for a specific user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const activities = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    res.json({ activities });
  } catch (error) {
    console.error('Error fetching user activities:', error);
    res.status(500).json({ error: 'Failed to fetch user activities' });
  }
});

/**
 * GET /api/activity/project/:projectId
 * Get activity for a specific project
 */
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 50 } = req.query;

    // Get all activity related to this project
    const activities = await prisma.auditLog.findMany({
      where: {
        OR: [
          { resourceType: 'project', resourceId: projectId },
          {
            resourceType: { in: ['milestone', 'deliverable', 'payment'] },
            details: {
              path: ['projectId'],
              equals: projectId
            }
          }
        ]
      },
      include: {
        user: {
          select: {
            email: true,
            userType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    res.json({ activities });
  } catch (error) {
    console.error('Error fetching project activities:', error);
    res.status(500).json({ error: 'Failed to fetch project activities' });
  }
});

/**
 * GET /api/activity/feed
 * Get activity feed for dashboard (recent activity across all resources)
 */
router.get('/feed', async (req, res) => {
  try {
    const { limit = 20, types } = req.query;

    const where = {};

    // Filter by activity types if specified
    if (types) {
      where.action = { in: types.split(',') };
    }

    const activities = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            address: true,
            userType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    // Format activities for feed display
    const feed = activities.map(activity => ({
      id: activity.id,
      type: activity.action,
      message: formatActivityMessage(activity),
      user: activity.user?.email || activity.user?.address || 'System',
      userType: activity.user?.userType || 'SYSTEM',
      timestamp: activity.createdAt,
      resourceType: activity.resourceType,
      resourceId: activity.resourceId,
      details: activity.details
    }));

    res.json({ feed });
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

/**
 * POST /api/activity
 * Log a new activity (for custom events)
 */
router.post('/', async (req, res) => {
  try {
    const { userId, action, resourceType, resourceId, details, ipAddress } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }

    const activity = await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        resourceType: resourceType || null,
        resourceId: resourceId || null,
        details: details || null,
        ipAddress: ipAddress || req.ip
      }
    });

    res.status(201).json({ activity });
  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

/**
 * GET /api/activity/stats
 * Get activity statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Total activity count
    const totalCount = await prisma.auditLog.count({
      where: { createdAt: { gte: startDate } }
    });

    // Activity by type
    const byAction = await prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: startDate } },
      _count: true,
      orderBy: { _count: { action: 'desc' } }
    });

    // Activity by resource type
    const byResourceType = await prisma.auditLog.groupBy({
      by: ['resourceType'],
      where: { createdAt: { gte: startDate } },
      _count: true
    });

    // Daily activity counts
    const dailyActivity = await prisma.$queryRaw`
      SELECT DATE(created_at) as date, COUNT(*)::int as count
      FROM audit_log
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT ${parseInt(days)}
    `;

    // Most active users
    const activeUsers = await prisma.auditLog.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: startDate },
        userId: { not: null }
      },
      _count: true,
      orderBy: { _count: { userId: 'desc' } },
      take: 10
    });

    res.json({
      period: `${days} days`,
      totalCount,
      byAction: byAction.map(item => ({
        action: item.action,
        count: item._count
      })),
      byResourceType: byResourceType
        .filter(item => item.resourceType)
        .map(item => ({
          resourceType: item.resourceType,
          count: item._count
        })),
      dailyActivity,
      activeUsers: activeUsers.map(item => ({
        userId: item.userId,
        count: item._count
      }))
    });
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    res.status(500).json({ error: 'Failed to fetch activity stats' });
  }
});

/**
 * DELETE /api/activity/cleanup
 * Clean up old activity logs (admin only)
 */
router.delete('/cleanup', async (req, res) => {
  try {
    const { olderThanDays = 90 } = req.body;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThanDays));

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate }
      }
    });

    res.json({
      success: true,
      deletedCount: result.count,
      message: `Deleted ${result.count} activity logs older than ${olderThanDays} days`
    });
  } catch (error) {
    console.error('Error cleaning up activities:', error);
    res.status(500).json({ error: 'Failed to clean up activities' });
  }
});

/**
 * Helper: Format activity message for display
 */
function formatActivityMessage(activity) {
  const { action, resourceType, details } = activity;

  const messages = {
    // Project actions
    'project_created': `Created new project: ${details?.name || 'Unknown'}`,
    'project_updated': `Updated project details`,
    'project_deleted': `Deleted project`,

    // Milestone actions
    'milestone_created': `Added milestone: ${details?.name || 'Unknown'}`,
    'milestone_updated': `Updated milestone`,
    'milestone_completed': `Completed milestone: ${details?.milestoneName || 'Unknown'}`,
    'milestone_started': `Started milestone: ${details?.milestoneName || 'Unknown'}`,
    'milestone_deleted': `Removed milestone: ${details?.name || 'Unknown'}`,
    'milestones_reordered': `Reordered project milestones`,

    // Deliverable/Image actions
    'image_uploaded': `Uploaded image: ${details?.fileName || 'Unknown'}`,
    'image_deleted': `Deleted image: ${details?.fileName || 'Unknown'}`,
    'deliverable_uploaded': `Uploaded deliverable: ${details?.fileName || 'Unknown'}`,
    'deliverable_deleted': `Removed deliverable`,

    // User actions
    'login': `Logged in`,
    'logout': `Logged out`,
    'password_changed': `Changed password`,
    'profile_updated': `Updated profile`,

    // Payment actions
    'payment_initiated': `Initiated payment of $${(details?.amount / 100).toFixed(2)}`,
    'payment_completed': `Completed payment of $${(details?.amount / 100).toFixed(2)}`,
    'payment_failed': `Payment failed`,

    // Notification actions
    'notification_sent': `Sent notification: ${details?.type || 'Unknown'}`,
    'notification_preferences_updated': `Updated notification preferences`
  };

  return messages[action] || `${action.replace(/_/g, ' ')} ${resourceType || ''}`.trim();
}

module.exports = router;
