/**
 * Subscription Routes
 * API endpoints for subscription management and billing
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import * as subscriptionService from '../services/subscriptionService';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const router = Router();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia',
});

// ============================================
// SUBSCRIPTION ROUTES
// ============================================

/**
 * GET /api/subscriptions
 * Get current user's subscription
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

    const subscription = await subscriptionService.getSubscription(client.id);
    res.json(subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * POST /api/subscriptions
 * Create a new subscription
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

    const { tier, paymentMethodId } = req.body;

    if (!tier) {
      return res.status(400).json({ error: 'Tier is required' });
    }

    const subscription = await subscriptionService.createSubscription({
      clientId: client.id,
      tier,
      paymentMethodId,
    });

    res.status(201).json(subscription);
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    res.status(400).json({ error: error.message || 'Failed to create subscription' });
  }
});

/**
 * PUT /api/subscriptions/tier
 * Update subscription tier (upgrade/downgrade)
 */
router.put('/tier', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Get client
    const client = await prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const { tier } = req.body;

    if (!tier) {
      return res.status(400).json({ error: 'Tier is required' });
    }

    const subscription = await subscriptionService.updateSubscriptionTier(
      client.id,
      tier
    );

    res.json(subscription);
  } catch (error: any) {
    console.error('Error updating subscription tier:', error);
    res.status(400).json({ error: error.message || 'Failed to update tier' });
  }
});

/**
 * POST /api/subscriptions/cancel
 * Cancel subscription
 */
router.post('/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Get client
    const client = await prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const { cancelImmediately } = req.body;

    const subscription = await subscriptionService.cancelSubscription(
      client.id,
      !cancelImmediately // cancelAtPeriodEnd is the inverse
    );

    res.json(subscription);
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    res.status(400).json({ error: error.message || 'Failed to cancel subscription' });
  }
});

/**
 * POST /api/subscriptions/resume
 * Resume a canceled subscription
 */
router.post('/resume', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Get client
    const client = await prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const subscription = await subscriptionService.resumeSubscription(client.id);
    res.json(subscription);
  } catch (error: any) {
    console.error('Error resuming subscription:', error);
    res.status(400).json({ error: error.message || 'Failed to resume subscription' });
  }
});

// ============================================
// BILLING PORTAL
// ============================================

/**
 * POST /api/subscriptions/billing-portal
 * Create a Stripe billing portal session
 */
router.post('/billing-portal', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Get client
    const client = await prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const { returnUrl } = req.body;

    if (!returnUrl) {
      return res.status(400).json({ error: 'Return URL is required' });
    }

    const url = await subscriptionService.createBillingPortalSession(
      client.id,
      returnUrl
    );

    res.json({ url });
  } catch (error: any) {
    console.error('Error creating billing portal:', error);
    res.status(400).json({ error: error.message || 'Failed to create billing portal' });
  }
});

/**
 * POST /api/subscriptions/checkout
 * Create a Stripe checkout session
 */
router.post('/checkout', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Get client
    const client = await prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const { tier, successUrl, cancelUrl } = req.body;

    if (!tier || !successUrl || !cancelUrl) {
      return res.status(400).json({
        error: 'Tier, successUrl, and cancelUrl are required',
      });
    }

    const url = await subscriptionService.createCheckoutSession(
      client.id,
      tier,
      successUrl,
      cancelUrl
    );

    res.json({ url });
  } catch (error: any) {
    console.error('Error creating checkout:', error);
    res.status(400).json({ error: error.message || 'Failed to create checkout session' });
  }
});

// ============================================
// PRICING
// ============================================

/**
 * GET /api/subscriptions/pricing
 * Get tier pricing information
 */
router.get('/pricing', async (req: Request, res: Response) => {
  try {
    const pricing = Object.entries(subscriptionService.TIER_PRICING).map(
      ([tier, config]) => ({
        tier: parseInt(tier, 10),
        name: config.name,
        monthlyPrice: config.monthlyPrice ? config.monthlyPrice / 100 : 0,
        yearlyPrice: config.yearlyPrice ? config.yearlyPrice / 100 : 0,
        isCustom: config.monthlyPrice === null,
      })
    );

    res.json(pricing);
  } catch (error) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

// ============================================
// PAYMENT METHODS
// ============================================

/**
 * GET /api/subscriptions/payment-methods
 * Get saved payment methods
 */
router.get('/payment-methods', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Get client subscription
    const client = await prisma.client.findUnique({
      where: { userId: user.id },
      include: { subscription: true },
    });

    if (!client?.subscription?.stripeCustomerId) {
      return res.json([]);
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: client.subscription.stripeCustomerId,
      type: 'card',
    });

    res.json(
      paymentMethods.data.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
      }))
    );
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

/**
 * POST /api/subscriptions/payment-methods
 * Add a payment method
 */
router.post('/payment-methods', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Get client
    const client = await prisma.client.findUnique({
      where: { userId: user.id },
      include: { subscription: true },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const { paymentMethodId } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID is required' });
    }

    const customerId = await subscriptionService.getOrCreateStripeCustomer(client.id);
    await subscriptionService.attachPaymentMethod(customerId, paymentMethodId);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error adding payment method:', error);
    res.status(400).json({ error: error.message || 'Failed to add payment method' });
  }
});

/**
 * DELETE /api/subscriptions/payment-methods/:id
 * Remove a payment method
 */
router.delete('/payment-methods/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await stripe.paymentMethods.detach(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing payment method:', error);
    res.status(400).json({ error: error.message || 'Failed to remove payment method' });
  }
});

// ============================================
// INVOICES
// ============================================

/**
 * GET /api/subscriptions/invoices
 * Get invoice history
 */
router.get('/invoices', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Get client subscription
    const client = await prisma.client.findUnique({
      where: { userId: user.id },
      include: { subscription: true },
    });

    if (!client?.subscription?.stripeCustomerId) {
      return res.json([]);
    }

    const invoices = await stripe.invoices.list({
      customer: client.subscription.stripeCustomerId,
      limit: 20,
    });

    res.json(
      invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number,
        amount: (inv.amount_paid || 0) / 100,
        status: inv.status,
        date: inv.created ? new Date(inv.created * 1000) : null,
        pdfUrl: inv.invoice_pdf,
      }))
    );
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// ============================================
// STRIPE WEBHOOK
// ============================================

/**
 * POST /api/subscriptions/webhook
 * Handle Stripe webhooks
 */
router.post(
  '/webhook',
  // Use raw body for webhook signature verification
  require('express').raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return res.status(400).json({ error: 'Missing signature or webhook secret' });
    }

    try {
      const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      await subscriptionService.handleStripeWebhook(event);
      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * GET /api/subscriptions/metrics
 * Get subscription metrics (admin only)
 */
router.get('/metrics', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const metrics = await subscriptionService.getSubscriptionMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

export default router;
