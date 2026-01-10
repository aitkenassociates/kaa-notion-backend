/**
 * Stripe Helpers
 * Utilities for Stripe integration: webhook verification, event construction, idempotent processing.
 */

import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { sendPaymentConfirmation, sendWelcomeEmail } from '../services/emailService';
import { recordPayment } from '../config/metrics';
import { logger } from '../logger';

// ============================================================================
// TYPES
// ============================================================================

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  successUrl: string;
  cancelUrl: string;
}

export interface TierPricing {
  tier: 1 | 2 | 3 | 4;
  amount: number; // In cents
  currency: string;
  productId?: string;
  priceId?: string;
  name: string;
  description: string;
}

export interface CheckoutSessionOptions {
  leadId: string;
  tier: 1 | 2 | 3 | 4;
  email: string;
  projectId?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface WebhookEventResult {
  success: boolean;
  eventType: string;
  eventId: string;
  processed: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const TIER_PRICING: Record<1 | 2 | 3 | 4, TierPricing> = {
  1: {
    tier: 1,
    amount: 29900, // $299.00
    currency: 'usd',
    name: 'SAGE Tier 1 - The Concept',
    description: 'No-Touch, Fully Automated design package',
  },
  2: {
    tier: 2,
    amount: 149900, // $1,499.00
    currency: 'usd',
    name: 'SAGE Tier 2 - The Builder',
    description: 'Low-Touch, Systematized with Checkpoints',
  },
  3: {
    tier: 3,
    amount: 499900, // $4,999.00
    currency: 'usd',
    name: 'SAGE Tier 3 - The Concierge',
    description: 'Site Visits, Hybrid Tech + Boots on Ground',
  },
  4: {
    tier: 4,
    amount: 0, // Custom pricing
    currency: 'usd',
    name: 'KAA Tier 4 - White Glove',
    description: 'High-Touch, We Choose the Client - Custom Pricing',
  },
};

// ============================================================================
// STRIPE CLIENT INITIALIZATION
// ============================================================================

let stripeInstance: Stripe | null = null;
let stripeConfig: StripeConfig | null = null;

export function initStripe(config: StripeConfig): Stripe {
  stripeConfig = config;
  stripeInstance = new Stripe(config.secretKey, {
    apiVersion: '2025-02-24.acacia',
  });
  applyPriceIdsFromEnvironment();
  return stripeInstance;
}

export function getStripe(): Stripe {
  if (!stripeInstance) {
    throw new Error('Stripe not initialized. Call initStripe first.');
  }
  return stripeInstance;
}

export function getStripeConfig(): StripeConfig {
  if (!stripeConfig) {
    throw new Error('Stripe config not initialized. Call initStripe first.');
  }
  return stripeConfig;
}

function applyPriceIdsFromEnvironment(): void {
  const envPriceIds = {
    1: process.env.STRIPE_TIER1_PRICE_ID,
    2: process.env.STRIPE_TIER2_PRICE_ID,
    3: process.env.STRIPE_TIER3_PRICE_ID,
  };

  (Object.keys(envPriceIds) as Array<keyof typeof envPriceIds>).forEach((tierKey) => {
    const priceId = envPriceIds[tierKey];
    if (priceId) {
      TIER_PRICING[tierKey].priceId = priceId;
    }
  });
}

// ============================================================================
// CHECKOUT SESSION
// ============================================================================

/**
 * Creates a Stripe checkout session for a tier purchase.
 */
export async function createCheckoutSession(
  options: CheckoutSessionOptions
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const config = getStripeConfig();
  const pricing = TIER_PRICING[options.tier];
  const priceIdEnvVar = `STRIPE_TIER${options.tier}_PRICE_ID`;
  const priceId = process.env[priceIdEnvVar] || pricing.priceId;

  if (options.tier === 4) {
    throw new Error('Tier 4 requires custom pricing and cannot use standard checkout');
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: options.email,
    line_items: [
      {
        price_data: {
          currency: pricing.currency,
          product_data: {
            name: pricing.name,
            description: pricing.description,
          },
          unit_amount: pricing.amount,
        },
        quantity: 1,
      },
    ],
    success_url: options.successUrl || `${config.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: options.cancelUrl || config.cancelUrl,
    metadata: {
      leadId: options.leadId,
      tier: String(options.tier),
      projectId: options.projectId || '',
      ...options.metadata,
    },
  };

  // Use existing price ID if configured
  if (priceId) {
    sessionParams.line_items = [
      {
        price: priceId,
        quantity: 1,
      },
    ];
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session;
}

/**
 * Retrieves a checkout session by ID.
 */
export async function getCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent', 'customer'],
  });
}

// ============================================================================
// WEBHOOK HANDLING
// ============================================================================

/**
 * Verifies and constructs a Stripe webhook event from raw body.
 */
export function constructWebhookEvent(
  rawBody: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  const config = getStripeConfig();

  try {
    return stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${(err as Error).message}`);
  }
}

/**
 * Checks if a webhook event has already been processed (idempotency).
 */
export async function isEventProcessed(
  prisma: PrismaClient,
  eventId: string
): Promise<boolean> {
  // Check if we have a record of this event
  const existingEvent = await prisma.payment.findFirst({
    where: {
      stripePaymentIntentId: eventId,
    },
  });
  return !!existingEvent;
}

/**
 * Handles a checkout.session.completed event.
 */
export async function handleCheckoutCompleted(
  prisma: PrismaClient,
  session: Stripe.Checkout.Session
): Promise<WebhookEventResult> {
  const { leadId, tier, projectId } = session.metadata || {};

  if (!leadId || !tier) {
    return {
      success: false,
      eventType: 'checkout.session.completed',
      eventId: session.id,
      processed: false,
      message: 'Missing required metadata (leadId, tier)',
    };
  }

  const tierNum = parseInt(tier, 10) as 1 | 2 | 3 | 4;
  const pricing = TIER_PRICING[tierNum];

  try {
    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get the lead
      const lead = await tx.lead.findUnique({
        where: { id: leadId },
        include: { client: true },
      });

      if (!lead) {
        throw new Error(`Lead not found: ${leadId}`);
      }

      let client = lead.client;
      let user;

      // 2. Create user and client if not exists
      if (!client) {
        // Create user
        user = await tx.user.create({
          data: {
            email: lead.email,
            passwordHash: `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            userType: 'SAGE_CLIENT',
            tier: tierNum,
          },
        });

        // Create client
        client = await tx.client.create({
          data: {
            userId: user.id,
            tier: tierNum,
            status: 'ACTIVE',
            projectAddress: lead.projectAddress,
          },
        });

        // Update lead with client reference
        await tx.lead.update({
          where: { id: leadId },
          data: {
            clientId: client.id,
            status: 'CLOSED',
          },
        });
      }

      // 3. Get or create project
      let project;
      if (projectId) {
        project = await tx.project.findUnique({ where: { id: projectId } });
      }

      if (!project) {
        project = await tx.project.create({
          data: {
            clientId: client.id,
            leadId: leadId,
            tier: tierNum,
            name: `${lead.projectAddress} Project`,
            status: 'ONBOARDING',
            paymentStatus: 'paid',
          },
        });
      } else {
        // Update project payment status
        project = await tx.project.update({
          where: { id: project.id },
          data: { paymentStatus: 'paid', status: 'IN_PROGRESS' },
        });
      }

      // 4. Create payment record
      const payment = await tx.payment.create({
        data: {
          projectId: project.id,
          stripeCustomerId: session.customer as string || '',
          stripePaymentIntentId: session.payment_intent as string || session.id,
          amount: session.amount_total || pricing.amount,
          currency: session.currency || 'usd',
          status: 'SUCCEEDED',
          tier: tierNum,
        },
      });

      // Record payment metrics
      recordPayment(tierNum, 'success', session.amount_total || pricing.amount);

      return { client, project, payment };
    });

    // Send confirmation emails (async, don't block webhook response)
    const customerEmail = session.customer_email || session.customer_details?.email;
    if (customerEmail) {
      // Send welcome email for new clients
      sendWelcomeEmail({
        to: customerEmail,
        name: session.customer_details?.name || '',
        tier: tierNum,
      }).catch(err => {
        logger.error('Failed to send welcome email', { error: err.message, email: customerEmail });
      });

      // Send payment confirmation
      sendPaymentConfirmation({
        to: customerEmail,
        name: session.customer_details?.name || '',
        amount: session.amount_total || pricing.amount,
        currency: session.currency || 'usd',
        tier: tierNum,
        projectName: result.project.name || 'Landscape Design Project',
        projectId: result.project.id,
      }).catch(err => {
        logger.error('Failed to send payment confirmation', { error: err.message, email: customerEmail });
      });
    }

    return {
      success: true,
      eventType: 'checkout.session.completed',
      eventId: session.id,
      processed: true,
      message: 'Payment processed successfully',
      data: {
        clientId: result.client.id,
        projectId: result.project.id,
        paymentId: result.payment.id,
      },
    };
  } catch (error) {
    return {
      success: false,
      eventType: 'checkout.session.completed',
      eventId: session.id,
      processed: false,
      message: `Error processing payment: ${(error as Error).message}`,
    };
  }
}

/**
 * Handles a payment_intent.succeeded event.
 */
export async function handlePaymentSucceeded(
  prisma: PrismaClient,
  paymentIntent: Stripe.PaymentIntent
): Promise<WebhookEventResult> {
  try {
    // Update payment record if exists
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCEEDED' },
      });
    }

    return {
      success: true,
      eventType: 'payment_intent.succeeded',
      eventId: paymentIntent.id,
      processed: true,
      message: 'Payment intent marked as succeeded',
    };
  } catch (error) {
    return {
      success: false,
      eventType: 'payment_intent.succeeded',
      eventId: paymentIntent.id,
      processed: false,
      message: `Error: ${(error as Error).message}`,
    };
  }
}

/**
 * Handles a payment_intent.payment_failed event.
 */
export async function handlePaymentFailed(
  prisma: PrismaClient,
  paymentIntent: Stripe.PaymentIntent
): Promise<WebhookEventResult> {
  try {
    // Update payment record if exists
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });

      // Update project payment status
      await prisma.project.update({
        where: { id: payment.projectId },
        data: { paymentStatus: 'failed' },
      });
    }

    return {
      success: true,
      eventType: 'payment_intent.payment_failed',
      eventId: paymentIntent.id,
      processed: true,
      message: 'Payment failure recorded',
    };
  } catch (error) {
    return {
      success: false,
      eventType: 'payment_intent.payment_failed',
      eventId: paymentIntent.id,
      processed: false,
      message: `Error: ${(error as Error).message}`,
    };
  }
}

// ============================================================================
// REFUNDS
// ============================================================================

/**
 * Creates a refund for a payment.
 */
export async function createRefund(
  paymentIntentId: string,
  amount?: number,
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
): Promise<Stripe.Refund> {
  const stripe = getStripe();

  const refundParams: Stripe.RefundCreateParams = {
    payment_intent: paymentIntentId,
  };

  if (amount) {
    refundParams.amount = amount;
  }

  if (reason) {
    refundParams.reason = reason;
  }

  return stripe.refunds.create(refundParams);
}

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

/**
 * Creates or retrieves a Stripe customer.
 */
export async function getOrCreateCustomer(
  email: string,
  name?: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  const stripe = getStripe();

  // Search for existing customer
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  // Create new customer
  return stripe.customers.create({
    email,
    name,
    metadata,
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formats an amount in cents to a currency string.
 */
export function formatAmount(amountCents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

/**
 * Gets the tier pricing info.
 */
export function getTierPricing(tier: 1 | 2 | 3 | 4): TierPricing {
  return TIER_PRICING[tier];
}

/**
 * Validates a tier number.
 */
export function isValidTier(tier: number): tier is 1 | 2 | 3 | 4 {
  return [1, 2, 3, 4].includes(tier);
}

/**
 * Check if a tier is payable (not tier 4 which requires custom pricing)
 */
export function isPayableTier(tier: number): tier is 1 | 2 | 3 {
  return [1, 2, 3].includes(tier);
}

// ============================================================================
// LEGACY CHECKOUT SESSION SUPPORT
// ============================================================================

export interface CreateCheckoutSessionParams {
  leadId: string;
  tier: 1 | 2 | 3;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

/**
 * Create a Stripe Checkout session for a tier purchase (legacy interface)
 */
export async function createCheckoutSessionLegacy(
  params: CreateCheckoutSessionParams
): Promise<CheckoutSessionResult> {
  const session = await createCheckoutSession({
    leadId: params.leadId,
    tier: params.tier,
    email: params.customerEmail,
    successUrl: params.successUrl,
    cancelUrl: params.cancelUrl,
    metadata: params.metadata,
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session URL');
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}

// ============================================================================
// WEBHOOK SIGNATURE VERIFICATION (LEGACY)
// ============================================================================

/**
 * Verify Stripe webhook signature (legacy interface)
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

// ============================================================================
// DATA EXTRACTION HELPERS
// ============================================================================

export interface CheckoutCompletedData {
  sessionId: string;
  paymentIntentId: string;
  customerId: string | null;
  customerEmail: string | null;
  leadId: string;
  tier: 1 | 2 | 3;
  tierName: string;
  amountTotal: number;
  currency: string;
  paymentStatus: string;
}

/**
 * Extract relevant data from checkout.session.completed event
 */
export function extractCheckoutCompletedData(session: Stripe.Checkout.Session): CheckoutCompletedData {
  const metadata = session.metadata || {};
  const tier = parseInt(metadata.tier || metadata.leadId || '0', 10);

  if (!isPayableTier(tier)) {
    throw new Error(`Invalid tier in session metadata: ${metadata.tier}`);
  }

  return {
    sessionId: session.id,
    paymentIntentId: typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || '',
    customerId: typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id || null,
    customerEmail: session.customer_email || session.customer_details?.email || null,
    leadId: metadata.lead_id || metadata.leadId || '',
    tier: tier,
    tierName: metadata.tier_name || TIER_PRICING[tier]?.name || '',
    amountTotal: session.amount_total || 0,
    currency: session.currency || 'usd',
    paymentStatus: session.payment_status,
  };
}

export interface PaymentSucceededData {
  paymentIntentId: string;
  customerId: string | null;
  amount: number;
  currency: string;
  leadId: string;
  tier: 1 | 2 | 3;
  receiptEmail: string | null;
}

/**
 * Extract data from payment_intent.succeeded event
 */
export function extractPaymentSucceededData(paymentIntent: Stripe.PaymentIntent): PaymentSucceededData {
  const metadata = paymentIntent.metadata || {};
  const tier = parseInt(metadata.tier || '0', 10);

  if (!isPayableTier(tier)) {
    throw new Error(`Invalid tier in payment intent metadata: ${metadata.tier}`);
  }

  return {
    paymentIntentId: paymentIntent.id,
    customerId: typeof paymentIntent.customer === 'string'
      ? paymentIntent.customer
      : paymentIntent.customer?.id || null,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    leadId: metadata.lead_id || metadata.leadId || '',
    tier: tier,
    receiptEmail: paymentIntent.receipt_email,
  };
}

/**
 * Idempotency key generator for webhook processing
 */
export function generateIdempotencyKey(eventId: string, action: string): string {
  return `${eventId}_${action}`;
}

/**
 * Create a Stripe customer from lead data
 */
export async function createStripeCustomer(params: {
  email: string;
  name?: string;
  leadId: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer> {
  const stripe = getStripe();
  return stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      lead_id: params.leadId,
      ...params.metadata,
    },
  });
}
