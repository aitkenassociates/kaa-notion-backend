/**
 * Tier Router - Determines which service tier a lead should be assigned to
 * based on their intake form responses.
 *
 * Tiers:
 * - Tier 1: Garden Guide ($299) - DIY guidance package, no-touch automated
 * - Tier 2: Design Package ($1,499) - Custom design plans, low-touch
 * - Tier 3: Full Service ($4,999+) - Complete design-build, site visits
 * - Tier 4: KAA Premium (custom) - White-glove luxury, invitation-only
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export type BudgetRange =
  | 'under-500'
  | '500-2500'
  | '2500-5000'
  | '5000-10000'
  | '10000-25000'
  | 'over-25000'
  | 'custom';

export type Timeline =
  | 'asap'
  | '2-4-weeks'
  | '4-8-weeks'
  | '8-12-weeks'
  | '3-6-months'
  | '6-plus-months'
  | 'flexible';

export type ProjectType =
  | 'simple-renovation'
  | 'garden-refresh'
  | 'standard-addition'
  | 'full-renovation'
  | 'new-build'
  | 'multiple-properties'
  | 'complex';

export interface IntakeFormData {
  budgetRange: BudgetRange;
  timeline: Timeline;
  projectType: ProjectType;
  hasSurvey: boolean;
  hasDrawings: boolean;
  projectAddress: string;
}

export type TierNumber = 1 | 2 | 3 | 4;
export type Confidence = 'high' | 'medium' | 'low';

export interface TierRecommendation {
  tier: TierNumber;
  reason: string;
  confidence: Confidence;
  needsManualReview: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

const TIER_CONFIG = {
  1: {
    name: 'Garden Guide',
    price: 299,
    maxBudget: 500,
  },
  2: {
    name: 'Design Package',
    price: 1499,
    maxBudget: 5000,
  },
  3: {
    name: 'Full Service',
    price: 4999,
    maxBudget: 25000,
  },
  4: {
    name: 'KAA Premium',
    price: null, // Custom pricing
    maxBudget: Infinity,
  },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Maps budget range string to a tier number based on budget thresholds
 */
function getTierFromBudget(budgetRange: BudgetRange): TierNumber {
  switch (budgetRange) {
    case 'under-500':
      return 1;
    case '500-2500':
      return 2;
    case '2500-5000':
      return 2;
    case '5000-10000':
      return 3;
    case '10000-25000':
      return 3;
    case 'over-25000':
      return 4;
    case 'custom':
      return 4;
    default:
      return 2; // Default to mid-tier
  }
}

/**
 * Maps timeline to tier adjustment factor
 * Returns: negative = can go lower tier, positive = needs higher tier
 */
function getTimelineAdjustment(timeline: Timeline): number {
  switch (timeline) {
    case 'asap':
      return -1; // Fast track - lower tiers preferred
    case '2-4-weeks':
      return 0; // Standard - no adjustment
    case '4-8-weeks':
      return 0; // Standard - no adjustment
    case '8-12-weeks':
      return 1; // Extended - may need higher tier
    case '3-6-months':
      return 1; // Complex timeline
    case '6-plus-months':
      return 2; // Very complex - likely Tier 3/4
    case 'flexible':
      return 0; // No adjustment
    default:
      return 0;
  }
}

/**
 * Maps project type to minimum required tier
 */
function getMinTierForProjectType(projectType: ProjectType): TierNumber {
  switch (projectType) {
    case 'simple-renovation':
      return 1;
    case 'garden-refresh':
      return 1;
    case 'standard-addition':
      return 2;
    case 'full-renovation':
      return 2;
    case 'new-build':
      return 3;
    case 'multiple-properties':
      return 4;
    case 'complex':
      return 4;
    default:
      return 2;
  }
}

/**
 * Determines if existing assets allow for tier reduction
 */
function getAssetAdjustment(hasSurvey: boolean, hasDrawings: boolean): number {
  if (hasSurvey && hasDrawings) {
    return -1; // Has everything - can potentially lower tier
  } else if (hasSurvey || hasDrawings) {
    return 0; // Has some - no adjustment
  } else {
    return 1; // Has nothing - may need site visit (higher tier)
  }
}

/**
 * Clamps tier to valid range (1-4)
 */
function clampTier(tier: number): TierNumber {
  return Math.max(1, Math.min(4, tier)) as TierNumber;
}

// ============================================================================
// Main Router Function
// ============================================================================

/**
 * Recommends a service tier based on intake form data.
 *
 * The algorithm considers:
 * 1. Budget range (primary factor)
 * 2. Timeline requirements
 * 3. Project type complexity
 * 4. Existing assets (survey/drawings)
 *
 * @param data - Intake form data from the lead
 * @returns TierRecommendation with tier, reason, confidence, and review flag
 */
export function recommendTier(data: IntakeFormData): TierRecommendation {
  const reasons: string[] = [];
  let needsReview = false;

  // Step 1: Start with budget-based tier
  let tier = getTierFromBudget(data.budgetRange);
  reasons.push(`Budget range suggests ${TIER_CONFIG[tier].name}`);

  // Step 2: Apply timeline adjustment
  const timelineAdj = getTimelineAdjustment(data.timeline);
  if (timelineAdj !== 0) {
    const newTier = clampTier(tier + timelineAdj);
    if (newTier !== tier) {
      tier = newTier;
      if (timelineAdj > 0) {
        reasons.push('Extended timeline requires more comprehensive service');
      } else {
        reasons.push('Fast timeline allows for streamlined process');
      }
    }
  }

  // Check for tight timeline with complex tier - flag for review
  if (data.timeline === 'asap' && tier >= 3) {
    needsReview = true;
    reasons.push('Tight timeline may not be feasible for this tier');
  }

  // Step 3: Apply project type minimum
  const minTierForProject = getMinTierForProjectType(data.projectType);
  if (minTierForProject > tier) {
    tier = minTierForProject;
    reasons.push(`${data.projectType.replace(/-/g, ' ')} requires ${TIER_CONFIG[tier].name}`);
  }

  // Step 4: Apply asset adjustment
  const assetAdj = getAssetAdjustment(data.hasSurvey, data.hasDrawings);
  if (assetAdj !== 0) {
    // Only allow downgrade if project type permits
    if (assetAdj < 0 && tier > minTierForProject) {
      const newTier = clampTier(tier + assetAdj);
      if (newTier !== tier) {
        tier = newTier;
        reasons.push('Existing survey and drawings allow streamlined process');
      }
    } else if (assetAdj > 0 && !data.hasSurvey && !data.hasDrawings) {
      const newTier = clampTier(tier + assetAdj);
      if (newTier !== tier && newTier >= minTierForProject) {
        tier = newTier;
        reasons.push('Site visit required (no existing survey or drawings)');
      } else if (tier < 3) {
        // Flag for review - may need site visit
        needsReview = true;
        reasons.push('May require site visit due to lack of existing assets');
      }
    }
  }

  // Step 5: Tier 4 always requires manual review
  if (tier === 4) {
    needsReview = true;
    if (!reasons.some((r) => r.includes('white-glove') || r.includes('KAA Premium'))) {
      reasons.push('KAA Premium tier requires team review');
    }
  }

  // Step 6: Flag edge cases for review
  // Budget/tier mismatch
  const budgetTier = getTierFromBudget(data.budgetRange);
  if (Math.abs(budgetTier - tier) >= 2) {
    needsReview = true;
    reasons.push('Budget and requirements suggest different tiers');
  }

  // Step 7: Determine confidence level
  let confidence: Confidence = 'high';
  if (needsReview) {
    confidence = 'low';
  } else if (reasons.length > 3) {
    confidence = 'medium';
  }

  return {
    tier,
    reason: reasons.join('; '),
    confidence,
    needsManualReview: needsReview,
  };
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Get tier configuration details
 */
export function getTierConfig(tier: TierNumber) {
  return TIER_CONFIG[tier];
}

/**
 * Get all tier configurations
 */
export function getAllTierConfigs() {
  return TIER_CONFIG;
}

/**
 * Validate intake form data
 */
export function validateIntakeFormData(data: Partial<IntakeFormData>): string[] {
  const errors: string[] = [];

  if (!data.budgetRange) {
    errors.push('Budget range is required');
  }
  if (!data.timeline) {
    errors.push('Timeline is required');
  }
  if (!data.projectType) {
    errors.push('Project type is required');
  }
  if (typeof data.hasSurvey !== 'boolean') {
    errors.push('Survey status is required');
  }
  if (typeof data.hasDrawings !== 'boolean') {
    errors.push('Drawings status is required');
  }
  if (!data.projectAddress || data.projectAddress.trim() === '') {
    errors.push('Project address is required');
  }

  return errors;
}
