import Stripe from 'stripe';

// Initialize Stripe with API key from environment
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('Warning: STRIPE_SECRET_KEY not set. Stripe functionality will not work.');
}

export const stripe = new Stripe(stripeSecretKey || '', {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
});

// Tier pricing configuration
// These should match your Stripe product/price IDs
export interface TierPricing {
  tier: 1 | 2 | 3;
  name: string;
  priceId: string; // Stripe Price ID
  amount: number; // Amount in cents
  currency: string;
  description: string;
}

export const TIER_PRICING: Record<1 | 2 | 3, TierPricing> = {
  1: {
    tier: 1,
    name: 'Seedling',
    priceId: process.env.STRIPE_PRICE_TIER_1 || 'price_tier1_placeholder',
    amount: 50000, // $500.00
    currency: 'usd',
    description: 'Quick concept for simple projects - AI-assisted design with 48hr turnaround',
  },
  2: {
    tier: 2,
    name: 'Sprout',
    priceId: process.env.STRIPE_PRICE_TIER_2 || 'price_tier2_placeholder',
    amount: 150000, // $1,500.00
    currency: 'usd',
    description: 'Full landscape design package with 3D visualization and planting plan',
  },
  3: {
    tier: 3,
    name: 'Canopy',
    priceId: process.env.STRIPE_PRICE_TIER_3 || 'price_tier3_placeholder',
    amount: 350000, // $3,500.00
    currency: 'usd',
    description: 'Comprehensive design with construction documents and project management',
  },
};

// Get tier pricing info
export function getTierPricing(tier: 1 | 2 | 3): TierPricing {
  return TIER_PRICING[tier];
}

// Validate tier is payable (1-3, not 4)
export function isPayableTier(tier: number): tier is 1 | 2 | 3 {
  return tier >= 1 && tier <= 3;
}

export default stripe;
