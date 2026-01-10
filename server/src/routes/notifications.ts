/**
 * Notification Routes
 *
 * GET /api/notifications - Get user notifications
 * GET /api/notifications/count - Get unread count
 * PATCH /api/notifications/:id/read - Mark as read
 * POST /api/notifications/read-all - Mark all as read
 * DELETE /api/notifications/:id - Delete notification
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import notificationService from '../services/notificationService';
import { logger } from '../config/logger';

const router = Router();

// ========================================
// Validation Schemas
// ========================================

const getNotificationsSchema = z.object({
  read: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  type: z.enum([
    'PROJECT_UPDATE',
    'MILESTONE_COMPLETED',
    'DELIVERABLE_READY',
    'MESSAGE_RECEIVED',
    'PAYMENT_RECEIVED',
    'REVISION_REQUESTED',
    'SYSTEM',
  ]).optional(),
  limit: z.string().optional().transform((v) => v ? parseInt(v, 10) : 50),
  offset: z.string().optional().transform((v) => v ? parseInt(v, 10) : 0),
});

// ========================================
// Routes
// ========================================

/**
 * GET /api/notifications
 *
 * Get notifications for the authenticated user.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const validation = getNotificationsSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error.issues[0].message,
        },
      });
    }

    const result = await notificationService.getUserNotifications(
      user.id,
      validation.data
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to get notifications', {}, error as Error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch notifications' },
    });
  }
});

/**
 * GET /api/notifications/count
 *
 * Get unread notification count.
 */
router.get('/count', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const count = await notificationService.getUnreadCount(user.id);

    return res.json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (error) {
    logger.error('Failed to get notification count', {}, error as Error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch count' },
    });
  }
});

/**
 * PATCH /api/notifications/:id/read
 *
 * Mark a notification as read.
 */
router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id } = req.params;
    await notificationService.markAsRead(id, user.id);

    return res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    logger.error('Failed to mark notification as read', {}, error as Error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update notification' },
    });
  }
});

/**
 * POST /api/notifications/read-all
 *
 * Mark all notifications as read.
 */
router.post('/read-all', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const result = await notificationService.markAllAsRead(user.id);

    return res.json({
      success: true,
      message: 'All notifications marked as read',
      data: { updated: result.count },
    });
  } catch (error) {
    logger.error('Failed to mark all notifications as read', {}, error as Error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update notifications' },
    });
  }
});

/**
 * DELETE /api/notifications/:id
 *
 * Delete a notification.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id } = req.params;
    await notificationService.delete(id, user.id);

    return res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    logger.error('Failed to delete notification', {}, error as Error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to delete notification' },
    });
  }
});

export default router;
