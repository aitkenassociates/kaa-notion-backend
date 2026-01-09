/**
 * Subscriptions Routes
 *
 * API endpoints for Stripe subscription management:
 * - Tier subscriptions
 * - Payment processing
 * - Trial periods
 * - Subscription lifecycle
 */

const express = require('express');
const Stripe = require('stripe');
const prisma = require('../lib/prisma');
require('dotenv').config();

const router = express.Router();

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Tier pricing configuration
const TIER_PRICING = {
  1: {
    name: 'The Concept',
    price: 29900, // $299 in cents
    description: 'AI-powered concept designs with DIY guidance',
    features: [
      'AI-generated concept designs',
      'Plant recommendations',
      'DIY implementation guide',
      '1 revision included',
      'Digital delivery'
    ],
    trialDays: 0
  },
  2: {
    name: 'The Builder',
    price: 149900, // $1,499 in cents
    description: 'Custom design plans with designer checkpoints',
    features: [
      'Custom design plans',
      'Designer review checkpoints',
      'Detailed plant list',
      'Material specifications',
      '2 revisions included',
      'Digital + print delivery'
    ],
    trialDays: 0
  },
  3: {
    name: 'The Concierge',
    price: 499900, // $4,999 in cents (base)
    description: 'Full design service with site visits',
    features: [
      'On-site consultation',
      'Complete design package',
      'Construction documents',
      'Contractor coordination',
      'Unlimited revisions',
      'Project management support'
    ],
    trialDays: 0
  },
  4: {
    name: 'KAA White Glove',
    price: null, // Custom pricing
    description: 'Premium full-service landscape architecture',
    features: [
      'Dedicated project team',
      'Full design-build coordination',
      'Premium material selections',
      'Construction oversight',
      'Ongoing maintenance planning',
      'Lifetime design relationship'
    ],
    trialDays: 0,
    byInvitation: true
  }
};

/**
 * GET /api/subscriptions/tiers
 * Get available subscription tiers
 */
router.get('/tiers', async (req, res) => {
  try {
    // Merge database tiers with pricing config
    const dbTiers = await prisma.tier.findMany({
      orderBy: { id: 'asc' }
    });

    const tiers = Object.entries(TIER_PRICING).map(([id, config]) => {
      const dbTier = dbTiers.find(t => t.id === parseInt(id));
      return {
        id: parseInt(id),
        ...config,
        stripeProductId: dbTier?.stripeProductId,
        stripePriceId: dbTier?.stripePriceId
      };
    });

    res.json({ tiers });
  } catch (error) {
    console.error('Error fetching tiers:', error);
    res.status(500).json({ error: 'Failed to fetch tiers' });
  }
});

/**
 * POST /api/subscriptions/create-checkout
 * Create Stripe checkout session for tier purchase
 */
router.post('/create-checkout', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const { tier, clientId, projectId, email, successUrl, cancelUrl } = req.body;

    if (!tier || !email) {
      return res.status(400).json({
        error: 'tier and email are required'
      });
    }

    const tierConfig = TIER_PRICING[tier];
    if (!tierConfig) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    if (tierConfig.byInvitation) {
      return res.status(400).json({
        error: 'This tier is by invitation only. Please contact us directly.'
      });
    }

    // Get or create Stripe customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email,
        metadata: {
          clientId: clientId || '',
          tier: tier.toString()
        }
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `SAGE ${tierConfig.name}`,
            description: tierConfig.description,
            metadata: { tier: tier.toString() }
          },
          unit_amount: tierConfig.price
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: successUrl || `${process.env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/checkout/cancel`,
      metadata: {
        clientId: clientId || '',
        projectId: projectId || '',
        tier: tier.toString()
      },
      allow_promotion_codes: true
    });

    // Log activity
    await prisma.auditLog.create({
      data: {
        action: 'checkout_created',
        resourceType: 'payment',
        details: {
          sessionId: session.id,
          tier,
          amount: tierConfig.price,
          email
        }
      }
    });

    res.json({
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Error creating checkout:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * POST /api/subscriptions/create-payment-intent
 * Create payment intent for custom amounts or tier 4
 */
router.post('/create-payment-intent', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const { amount, email, clientId, projectId, tier, description } = req.body;

    if (!amount || !email) {
      return res.status(400).json({
        error: 'amount and email are required'
      });
    }

    // Get or create customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({ email });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      customer: customer.id,
      description: description || `SAGE Tier ${tier} Payment`,
      metadata: {
        clientId: clientId || '',
        projectId: projectId || '',
        tier: tier?.toString() || ''
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

/**
 * POST /api/subscriptions/webhook
 * Handle Stripe webhooks
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * GET /api/subscriptions/payments/:projectId
 * Get payment history for a project
 */
router.get('/payments/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const payments = await prisma.payment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ payments });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

/**
 * POST /api/subscriptions/trial/start
 * Start trial period for a tier
 */
router.post('/trial/start', async (req, res) => {
  try {
    const { clientId, tier, durationDays = 14 } = req.body;

    if (!clientId || !tier) {
      return res.status(400).json({
        error: 'clientId and tier are required'
      });
    }

    // Check if client already has an active trial
    const existingTrial = await prisma.project.findFirst({
      where: {
        clientId,
        paymentStatus: 'trial'
      }
    });

    if (existingTrial) {
      return res.status(400).json({
        error: 'Client already has an active trial'
      });
    }

    // Calculate trial end date
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + durationDays);

    // Create trial project
    const project = await prisma.project.create({
      data: {
        clientId,
        name: `Trial - ${TIER_PRICING[tier]?.name || 'SAGE'}`,
        tier,
        status: 'ONBOARDING',
        paymentStatus: 'trial'
      }
    });

    // Log activity
    await prisma.auditLog.create({
      data: {
        action: 'trial_started',
        resourceType: 'project',
        resourceId: project.id,
        details: {
          clientId,
          tier,
          durationDays,
          trialEndDate
        }
      }
    });

    res.json({
      success: true,
      project,
      trialEndDate
    });
  } catch (error) {
    console.error('Error starting trial:', error);
    res.status(500).json({ error: 'Failed to start trial' });
  }
});

/**
 * POST /api/subscriptions/trial/convert
 * Convert trial to paid subscription
 */
router.post('/trial/convert', async (req, res) => {
  try {
    const { projectId, paymentIntentId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.paymentStatus !== 'trial') {
      return res.status(400).json({ error: 'Project is not in trial' });
    }

    // Update project payment status
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { paymentStatus: 'paid' }
    });

    // Create payment record if paymentIntentId provided
    if (paymentIntentId) {
      const tierConfig = TIER_PRICING[project.tier];
      await prisma.payment.create({
        data: {
          projectId,
          stripePaymentIntentId: paymentIntentId,
          stripeCustomerId: '', // Would get from Stripe
          amount: tierConfig?.price || 0,
          tier: project.tier,
          status: 'SUCCEEDED'
        }
      });
    }

    // Log activity
    await prisma.auditLog.create({
      data: {
        action: 'trial_converted',
        resourceType: 'project',
        resourceId: projectId,
        details: { paymentIntentId }
      }
    });

    res.json({
      success: true,
      project: updatedProject
    });
  } catch (error) {
    console.error('Error converting trial:', error);
    res.status(500).json({ error: 'Failed to convert trial' });
  }
});

/**
 * GET /api/subscriptions/trial/status/:projectId
 * Get trial status for a project
 */
router.get('/trial/status/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        tier: true,
        paymentStatus: true,
        createdAt: true
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.paymentStatus !== 'trial') {
      return res.json({
        isTrial: false,
        paymentStatus: project.paymentStatus
      });
    }

    // Calculate days remaining (assuming 14-day trial)
    const trialDays = 14;
    const trialEndDate = new Date(project.createdAt);
    trialEndDate.setDate(trialEndDate.getDate() + trialDays);

    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24)));

    res.json({
      isTrial: true,
      daysRemaining,
      trialEndDate,
      expired: daysRemaining === 0,
      tier: project.tier,
      tierName: TIER_PRICING[project.tier]?.name
    });
  } catch (error) {
    console.error('Error getting trial status:', error);
    res.status(500).json({ error: 'Failed to get trial status' });
  }
});

/**
 * POST /api/subscriptions/refund
 * Process refund for a payment
 */
router.post('/refund', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const { paymentId, amount, reason } = req.body;

    if (!paymentId) {
      return res.status(400).json({ error: 'paymentId is required' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Create Stripe refund
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined, // Partial or full refund
      reason: reason || 'requested_by_customer'
    });

    // Update payment status
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED' }
    });

    // Log activity
    await prisma.auditLog.create({
      data: {
        action: 'payment_refunded',
        resourceType: 'payment',
        resourceId: paymentId,
        details: {
          refundId: refund.id,
          amount: amount || payment.amount,
          reason
        }
      }
    });

    res.json({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount,
        status: refund.status
      }
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

// ============================================
// WEBHOOK HANDLERS
// ============================================

async function handleCheckoutCompleted(session) {
  const { clientId, projectId, tier } = session.metadata || {};

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      projectId: projectId || '',
      stripePaymentIntentId: session.payment_intent,
      stripeCustomerId: session.customer,
      amount: session.amount_total,
      tier: parseInt(tier) || 1,
      status: 'SUCCEEDED'
    }
  });

  // Update project if exists
  if (projectId) {
    await prisma.project.update({
      where: { id: projectId },
      data: { paymentStatus: 'paid' }
    });
  }

  // Log activity
  await prisma.auditLog.create({
    data: {
      action: 'payment_completed',
      resourceType: 'payment',
      resourceId: payment.id,
      details: {
        sessionId: session.id,
        amount: session.amount_total,
        tier
      }
    }
  });
}

async function handlePaymentSucceeded(paymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id);

  // Update any existing payment record
  await prisma.payment.updateMany({
    where: { stripePaymentIntentId: paymentIntent.id },
    data: { status: 'SUCCEEDED' }
  });
}

async function handlePaymentFailed(paymentIntent) {
  console.log('Payment failed:', paymentIntent.id);

  // Update payment record
  await prisma.payment.updateMany({
    where: { stripePaymentIntentId: paymentIntent.id },
    data: { status: 'FAILED' }
  });

  // Log activity
  await prisma.auditLog.create({
    data: {
      action: 'payment_failed',
      resourceType: 'payment',
      details: {
        paymentIntentId: paymentIntent.id,
        error: paymentIntent.last_payment_error?.message
      }
    }
  });
}

async function handleSubscriptionCreated(subscription) {
  console.log('Subscription created:', subscription.id);
}

async function handleSubscriptionUpdated(subscription) {
  console.log('Subscription updated:', subscription.id);
}

async function handleSubscriptionDeleted(subscription) {
  console.log('Subscription deleted:', subscription.id);
}

module.exports = router;
