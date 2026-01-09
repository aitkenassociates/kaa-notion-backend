/**
 * Notifications Routes
 *
 * API endpoints for notification preferences and delivery:
 * - User notification preferences
 * - Send notifications (email, in-app)
 * - Notification history
 */

const express = require('express');
const nodemailer = require('nodemailer');
const prisma = require('../lib/prisma');
require('dotenv').config();

const router = express.Router();

// In-memory storage for notification preferences (in production, add to Prisma schema)
const notificationPreferences = new Map();

// In-memory notification queue
const notificationQueue = [];

// Email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Default notification preferences
 */
const DEFAULT_PREFERENCES = {
  email: {
    projectUpdates: true,
    milestoneCompleted: true,
    newDeliverables: true,
    paymentReceipts: true,
    weeklyDigest: true,
    marketingEmails: false
  },
  inApp: {
    projectUpdates: true,
    milestoneCompleted: true,
    newDeliverables: true,
    paymentReceipts: true,
    teamMessages: true
  },
  frequency: 'immediate' // 'immediate', 'daily', 'weekly'
};

/**
 * GET /api/notifications/preferences/:userId
 * Get notification preferences for a user
 */
router.get('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const preferences = notificationPreferences.get(userId) || DEFAULT_PREFERENCES;

    res.json({ preferences });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

/**
 * PUT /api/notifications/preferences/:userId
 * Update notification preferences for a user
 */
router.put('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, inApp, frequency } = req.body;

    const currentPrefs = notificationPreferences.get(userId) || DEFAULT_PREFERENCES;

    const updatedPrefs = {
      email: { ...currentPrefs.email, ...email },
      inApp: { ...currentPrefs.inApp, ...inApp },
      frequency: frequency || currentPrefs.frequency
    };

    notificationPreferences.set(userId, updatedPrefs);

    // Log activity
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'notification_preferences_updated',
        resourceType: 'user',
        resourceId: userId,
        details: updatedPrefs
      }
    });

    res.json({
      success: true,
      preferences: updatedPrefs
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * POST /api/notifications/send
 * Send a notification to a user
 */
router.post('/send', async (req, res) => {
  try {
    const { userId, type, title, message, email, data } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({
        error: 'type, title, and message are required'
      });
    }

    // Get user
    let user = null;
    let userEmail = email;

    if (userId) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, address: true }
      });
      userEmail = user?.email || email;
    }

    // Get user preferences
    const preferences = notificationPreferences.get(userId) || DEFAULT_PREFERENCES;

    // Check if user has enabled this notification type
    const notificationType = mapTypeToPreference(type);
    const emailEnabled = preferences.email[notificationType] !== false;
    const inAppEnabled = preferences.inApp[notificationType] !== false;

    const results = {
      email: null,
      inApp: null
    };

    // Send email notification if enabled
    if (emailEnabled && userEmail) {
      try {
        await sendEmailNotification(userEmail, title, message, data);
        results.email = { sent: true, to: userEmail };
      } catch (emailError) {
        console.error('Email send error:', emailError);
        results.email = { sent: false, error: emailError.message };
      }
    }

    // Queue in-app notification
    if (inAppEnabled && userId) {
      const notification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        type,
        title,
        message,
        data,
        read: false,
        createdAt: new Date().toISOString()
      };
      notificationQueue.push(notification);
      results.inApp = { queued: true, id: notification.id };
    }

    // Log activity
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action: 'notification_sent',
        resourceType: 'notification',
        details: { type, title, results }
      }
    });

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/**
 * POST /api/notifications/send-bulk
 * Send notification to multiple users
 */
router.post('/send-bulk', async (req, res) => {
  try {
    const { userIds, type, title, message, data } = req.body;

    if (!userIds || !Array.isArray(userIds) || !type || !title || !message) {
      return res.status(400).json({
        error: 'userIds array, type, title, and message are required'
      });
    }

    const results = [];

    for (const userId of userIds) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true }
        });

        if (user) {
          const preferences = notificationPreferences.get(userId) || DEFAULT_PREFERENCES;
          const notificationType = mapTypeToPreference(type);

          if (preferences.email[notificationType] !== false && user.email) {
            await sendEmailNotification(user.email, title, message, data);
          }

          if (preferences.inApp[notificationType] !== false) {
            notificationQueue.push({
              id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              userId,
              type,
              title,
              message,
              data,
              read: false,
              createdAt: new Date().toISOString()
            });
          }

          results.push({ userId, success: true });
        } else {
          results.push({ userId, success: false, error: 'User not found' });
        }
      } catch (err) {
        results.push({ userId, success: false, error: err.message });
      }
    }

    res.json({
      success: true,
      total: userIds.length,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    });
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
    res.status(500).json({ error: 'Failed to send bulk notifications' });
  }
});

/**
 * GET /api/notifications/:userId
 * Get notifications for a user
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { unreadOnly = false, limit = 50 } = req.query;

    let notifications = notificationQueue.filter(n => n.userId === userId);

    if (unreadOnly === 'true') {
      notifications = notifications.filter(n => !n.read);
    }

    // Sort by date (newest first) and limit
    notifications = notifications
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, parseInt(limit));

    const unreadCount = notificationQueue.filter(
      n => n.userId === userId && !n.read
    ).length;

    res.json({
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * POST /api/notifications/:notificationId/read
 * Mark notification as read
 */
router.post('/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = notificationQueue.find(n => n.id === notificationId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    notification.read = true;
    notification.readAt = new Date().toISOString();

    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

/**
 * POST /api/notifications/:userId/read-all
 * Mark all notifications as read for a user
 */
router.post('/:userId/read-all', async (req, res) => {
  try {
    const { userId } = req.params;

    const now = new Date().toISOString();
    let count = 0;

    notificationQueue.forEach(n => {
      if (n.userId === userId && !n.read) {
        n.read = true;
        n.readAt = now;
        count++;
      }
    });

    res.json({
      success: true,
      markedCount: count
    });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

/**
 * DELETE /api/notifications/:notificationId
 * Delete a notification
 */
router.delete('/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;

    const index = notificationQueue.findIndex(n => n.id === notificationId);

    if (index === -1) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    notificationQueue.splice(index, 1);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * Helper: Send email notification
 */
async function sendEmailNotification(to, subject, message, data = {}) {
  if (!process.env.EMAIL_USER) {
    console.log(`📧 Email not configured - would send to ${to}: ${subject}`);
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
        .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .button:hover { background: #15803d; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">KAA Landscape Architecture</h1>
        </div>
        <div class="content">
          <h2>${subject}</h2>
          <p>${message}</p>
          ${data.actionUrl ? `<a href="${data.actionUrl}" class="button">${data.actionText || 'View Details'}</a>` : ''}
        </div>
        <div class="footer">
          <p>KAA Landscape Architecture | San Diego, CA</p>
          <p><a href="${process.env.FRONTEND_URL || 'https://kaa-app.vercel.app'}">Client Portal</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: `KAA: ${subject}`,
    html
  });
}

/**
 * Helper: Map notification type to preference key
 */
function mapTypeToPreference(type) {
  const mapping = {
    'project_update': 'projectUpdates',
    'milestone_completed': 'milestoneCompleted',
    'new_deliverable': 'newDeliverables',
    'payment_receipt': 'paymentReceipts',
    'weekly_digest': 'weeklyDigest',
    'marketing': 'marketingEmails',
    'team_message': 'teamMessages'
  };

  return mapping[type] || 'projectUpdates';
}

/**
 * Notification templates
 */
const NOTIFICATION_TEMPLATES = {
  milestone_completed: (data) => ({
    title: 'Milestone Completed',
    message: `The milestone "${data.milestoneName}" has been completed for your project "${data.projectName}".`,
    actionText: 'View Project',
    actionUrl: `${process.env.FRONTEND_URL}/projects/${data.projectId}`
  }),

  new_deliverable: (data) => ({
    title: 'New Deliverable Available',
    message: `A new ${data.category} has been uploaded to your project: ${data.fileName}`,
    actionText: 'View Deliverable',
    actionUrl: `${process.env.FRONTEND_URL}/projects/${data.projectId}/deliverables`
  }),

  payment_received: (data) => ({
    title: 'Payment Received',
    message: `We've received your payment of $${(data.amount / 100).toFixed(2)}. Thank you!`,
    actionText: 'View Receipt',
    actionUrl: `${process.env.FRONTEND_URL}/payments/${data.paymentId}`
  }),

  project_status_changed: (data) => ({
    title: 'Project Status Updated',
    message: `Your project "${data.projectName}" status has been updated to "${data.newStatus}".`,
    actionText: 'View Project',
    actionUrl: `${process.env.FRONTEND_URL}/projects/${data.projectId}`
  })
};

/**
 * POST /api/notifications/template
 * Send notification using a template
 */
router.post('/template', async (req, res) => {
  try {
    const { userId, template, data } = req.body;

    if (!template || !NOTIFICATION_TEMPLATES[template]) {
      return res.status(400).json({
        error: 'Invalid or missing template',
        availableTemplates: Object.keys(NOTIFICATION_TEMPLATES)
      });
    }

    const { title, message, actionText, actionUrl } = NOTIFICATION_TEMPLATES[template](data);

    // Use the send endpoint logic
    req.body = {
      userId,
      type: template,
      title,
      message,
      data: { ...data, actionText, actionUrl }
    };

    // Forward to send endpoint
    const user = userId ? await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    }) : null;

    const preferences = notificationPreferences.get(userId) || DEFAULT_PREFERENCES;
    const notificationType = mapTypeToPreference(template);

    const results = { email: null, inApp: null };

    if (preferences.email[notificationType] !== false && user?.email) {
      try {
        await sendEmailNotification(user.email, title, message, { actionText, actionUrl });
        results.email = { sent: true };
      } catch (err) {
        results.email = { sent: false, error: err.message };
      }
    }

    if (preferences.inApp[notificationType] !== false && userId) {
      notificationQueue.push({
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        type: template,
        title,
        message,
        data: { actionText, actionUrl, ...data },
        read: false,
        createdAt: new Date().toISOString()
      });
      results.inApp = { queued: true };
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('Error sending template notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

module.exports = router;
