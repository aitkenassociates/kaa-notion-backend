/**
 * Push Notification Routes
 * Handles Web Push subscription management
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import pushService from '../services/pushService';

// Type for authenticated request (use type assertion in handlers)
interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; userType: string };
}

const router = Router();

/**
 * GET /api/push/vapid-key
 * Get the VAPID public key for push subscription
 */
router.get('/vapid-key', (_req: Request, res: Response) => {
  try {
    const publicKey = pushService.getVapidPublicKey();
    res.json({
      success: true,
      data: { publicKey },
    });
  } catch (error) {
    console.error('Failed to get VAPID key:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Push notifications not configured' },
    });
  }
});

/**
 * POST /api/push/subscribe
 * Subscribe to push notifications
 */
router.post('/subscribe', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { endpoint, keys } = req.body;
    const userId = req.user!.id;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid subscription data' },
      });
    }

    await pushService.saveSubscription(userId, {
      endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    res.json({
      success: true,
      data: { message: 'Subscribed successfully' },
    });
  } catch (error) {
    console.error('Failed to subscribe:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to subscribe to push notifications' },
    });
  }
});

/**
 * DELETE /api/push/unsubscribe
 * Unsubscribe from push notifications
 */
router.delete('/unsubscribe', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { endpoint } = req.body;
    const userId = req.user!.id;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: { message: 'Endpoint is required' },
      });
    }

    await pushService.removeSubscription(endpoint);

    res.json({
      success: true,
      data: { message: 'Unsubscribed successfully' },
    });
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to unsubscribe from push notifications' },
    });
  }
});

/**
 * GET /api/push/status
 * Check if user has active push subscriptions
 */
router.get('/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const subscriptions = await pushService.getUserSubscriptions(userId);

    res.json({
      success: true,
      data: {
        subscribed: subscriptions.length > 0,
        subscriptionCount: subscriptions.length,
      },
    });
  } catch (error) {
    console.error('Failed to get push status:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get push status' },
    });
  }
});

/**
 * POST /api/push/test
 * Send a test push notification (for debugging)
 */
router.post('/test', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await pushService.sendToUser(userId, {
      title: 'Test Notification',
      body: 'Push notifications are working correctly!',
      icon: '/icons/icon-192x192.png',
      tag: 'test',
    });

    res.json({
      success: true,
      data: {
        sent: result.sent,
        failed: result.failed,
      },
    });
  } catch (error) {
    console.error('Failed to send test notification:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to send test notification' },
    });
  }
});

export default router;
