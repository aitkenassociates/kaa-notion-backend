/**
 * Referral Routes
 * API endpoints for client referral program
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import * as referralService from '../services/referralService';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// REFERRAL CODE ROUTES
// ============================================

/**
 * GET /api/referrals/code
 * Get or generate referral code for current user
 */
router.get('/code', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Get client
    const client = await prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const codeData = await referralService.createReferralCode(client.id);
    const code = codeData?.code;
    res.json({ code });
  } catch (error: any) {
    console.error('Error getting referral code:', error);
    res.status(400).json({ error: error.message || 'Failed to get referral code' });
  }
});

/**
 * GET /api/referrals/validate/:code
 * Validate a referral code (public route)
 */
router.get('/validate/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const isValid = await referralService.validateReferralCode(code);

    if (!isValid) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    res.json({
      valid: true,
      referrerName: 'A KAA client',
    });
  } catch (error) {
    console.error('Error validating referral code:', error);
    res.status(500).json({ error: 'Failed to validate referral code' });
  }
});

// ============================================
// REFERRAL MANAGEMENT
// ============================================

/**
 * POST /api/referrals
 * Create a new referral
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Get client
    const client = await prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const { email, name, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and referral code are required' });
    }

    const referral = await referralService.applyReferral({
      code,
      referredEmail: email,
      referredName: name,
    });

    res.status(201).json(referral);
  } catch (error: any) {
    console.error('Error creating referral:', error);
    res.status(400).json({ error: error.message || 'Failed to create referral' });
  }
});

/**
 * GET /api/referrals
 * Get all referrals for current user
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Get client
    const client = await prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const { status, limit, offset } = req.query;

    const referrals = await referralService.getReferralsByReferrer(client.id, {
      status: status as any,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json(referrals);
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

/**
 * GET /api/referrals/:id
 * Get a specific referral
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const referral = await referralService.getReferral(id);

    if (!referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    res.json(referral);
  } catch (error) {
    console.error('Error fetching referral:', error);
    res.status(500).json({ error: 'Failed to fetch referral' });
  }
});

// ============================================
// REFERRAL CREDITS
// ============================================

/**
 * GET /api/referrals/credits/balance
 * Get available credit balance
 */
router.get('/credits/balance', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Get client
    const client = await prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const stats = await referralService.getUserReferralStats(client.id);
    res.json({ balance: stats.pendingRewards });
  } catch (error) {
    console.error('Error fetching credit balance:', error);
    res.status(500).json({ error: 'Failed to fetch credit balance' });
  }
});

/**
 * GET /api/referrals/credits/history
 * Get credit history
 */
router.get('/credits/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Get client
    const client = await prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const { limit } = req.query;

    const history = await referralService.getRewardsByUser(client.id, {
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json(history);
  } catch (error) {
    console.error('Error fetching credit history:', error);
    res.status(500).json({ error: 'Failed to fetch credit history' });
  }
});

// ============================================
// REFERRAL STATISTICS
// ============================================

/**
 * GET /api/referrals/stats
 * Get referral statistics for current user
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Get client
    const client = await prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const stats = await referralService.getUserReferralStats(client.id);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    res.status(500).json({ error: 'Failed to fetch referral statistics' });
  }
});

/**
 * GET /api/referrals/leaderboard
 * Get referral leaderboard (public)
 */
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    // Leaderboard not implemented - return global stats
    const stats = referralService.getReferralStats();
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * POST /api/referrals/expire
 * Expire old pending referrals (admin only, can be called by cron)
 */
router.post('/expire', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Expiry not implemented in current service
    res.json({ expiredCount: 0, message: 'Expiry feature not yet implemented' });
  } catch (error) {
    console.error('Error expiring referrals:', error);
    res.status(500).json({ error: 'Failed to expire referrals' });
  }
});

/**
 * GET /api/referrals/config
 * Get referral program configuration
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    // Return default config values
    res.json({
      referrerReward: 50,
      referredReward: 25,
      minProjectValue: 299,
      expiryDays: 90,
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

export default router;
