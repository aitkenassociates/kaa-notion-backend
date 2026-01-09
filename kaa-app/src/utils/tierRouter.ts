/**
 * Tier Router
 * Determines which service tier (1, 2, 3, or 4) a lead should be assigned to
 * based on their intake form responses.
 *
 * Tiers:
 * - Tier 1: The Concept (No-Touch, Fully Automated)
 * - Tier 2: The Builder (Low-Touch, Systematized with Checkpoints)
 * - Tier 3: The Concierge (Site Visits, Hybrid Tech + Boots on Ground)
 * - Tier 4: KAA White Glove (High-Touch, We Choose the Client)
 */

export interface IntakeFormData {
  budgetRange: string; // "$0-$5000", "$5000-$15000", "$15000-$50000", "$50000+"
  timeline: string; // "< 2 weeks", "2-4 weeks", "4-8 weeks", "> 8 weeks", "6+ months"
  projectType: string; // "renovation", "addition", "new_build", "complex", "multiple_properties"
  hasSurvey: boolean;
  hasDrawings: boolean;
  projectAddress: string;
}

export interface TierRecommendation {
  tier: 1 | 2 | 3 | 4;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  needsManualReview: boolean;
}

// Budget thresholds (in dollars)
export const BUDGET_THRESHOLDS = {
  TIER_1_MAX: 5000,
  TIER_2_MAX: 15000,
  TIER_3_MAX: 50000,
  // Tier 4 is above TIER_3_MAX
};

// Timeline categories
export const TIMELINE = {
  FAST: '< 2 weeks',
  STANDARD_SHORT: '2-4 weeks',
  STANDARD: '4-8 weeks',
  EXTENDED: '> 8 weeks',
  LONG_TERM: '6+ months',
};

// Project types
export const PROJECT_TYPES = {
  RENOVATION: 'renovation',
  ADDITION: 'addition',
  NEW_BUILD: 'new_build',
  COMPLEX: 'complex',
  MULTIPLE_PROPERTIES: 'multiple_properties',
};

/**
 * Parse budget range string into a numeric value for comparison
 * Returns the upper bound of the range, or Infinity for open-ended ranges
 */
export function parseBudgetRange(budgetRange: string): number {
  const normalized = budgetRange.toLowerCase().trim();

  // Handle percentage-based pricing
  if (normalized.includes('%') || normalized.includes('percent')) {
    return Infinity; // Tier 4
  }

  // Handle "high" keyword
  if (normalized === 'high' || normalized.includes('premium')) {
    return Infinity; // Tier 4
  }

  // Extract numbers from the range
  const numbers = normalized.match(/\d+/g);
  if (!numbers || numbers.length === 0) {
    return 0; // Unknown budget, will trigger review
  }

  // If it's an open-ended range like "$50000+" or "> $50000"
  if (normalized.includes('+') || normalized.includes('>')) {
    return Infinity;
  }

  // Return the upper bound of the range
  const upperBound = Math.max(...numbers.map(n => parseInt(n, 10)));
  return upperBound;
}

/**
 * Determine tier based on budget range
 */
export function getTierForBudget(budgetRange: string): { tier: 1 | 2 | 3 | 4; confidence: 'high' | 'medium' | 'low' } {
  const budget = parseBudgetRange(budgetRange);

  if (budget === 0) {
    return { tier: 1, confidence: 'low' }; // Unknown budget
  }

  if (budget === Infinity || budget > BUDGET_THRESHOLDS.TIER_3_MAX) {
    return { tier: 4, confidence: 'high' };
  }

  if (budget > BUDGET_THRESHOLDS.TIER_2_MAX) {
    return { tier: 3, confidence: 'high' };
  }

  if (budget > BUDGET_THRESHOLDS.TIER_1_MAX) {
    return { tier: 2, confidence: 'high' };
  }

  return { tier: 1, confidence: 'high' };
}

/**
 * Analyze timeline and return tier adjustments
 */
export function analyzeTimeline(timeline: string): { minTier: 1 | 2 | 3 | 4; maxTier: 1 | 2 | 3 | 4; needsReview: boolean; reason: string } {
  const normalized = timeline.toLowerCase().trim();

  // Fast track - less than 2 weeks
  if (normalized.includes('< 2') || normalized.includes('less than 2') || normalized.includes('under 2')) {
    return {
      minTier: 1,
      maxTier: 2,
      needsReview: false,
      reason: 'Fast track timeline (< 2 weeks)',
    };
  }

  // Standard short - 2-4 weeks
  if (normalized.includes('2-4') || normalized.includes('2 to 4')) {
    return {
      minTier: 1,
      maxTier: 2,
      needsReview: false,
      reason: 'Standard short timeline (2-4 weeks)',
    };
  }

  // Standard - 4-8 weeks
  if (normalized.includes('4-8') || normalized.includes('4 to 8')) {
    return {
      minTier: 1,
      maxTier: 3,
      needsReview: false,
      reason: 'Standard timeline (4-8 weeks)',
    };
  }

  // Extended - more than 8 weeks
  if (normalized.includes('> 8') || normalized.includes('more than 8') || normalized.includes('over 8')) {
    return {
      minTier: 3,
      maxTier: 4,
      needsReview: false,
      reason: 'Extended timeline (> 8 weeks)',
    };
  }

  // Long term - 6+ months
  if (normalized.includes('6+') || normalized.includes('6 months') || normalized.includes('months')) {
    return {
      minTier: 3,
      maxTier: 4,
      needsReview: false,
      reason: 'Long-term timeline (6+ months)',
    };
  }

  // Unknown timeline
  return {
    minTier: 1,
    maxTier: 4,
    needsReview: true,
    reason: 'Timeline unclear - needs review',
  };
}

/**
 * Analyze existing assets (survey and drawings)
 */
export function analyzeAssets(hasSurvey: boolean, hasDrawings: boolean): { minTier: 1 | 2 | 3 | 4; requiresSiteVisit: boolean; reason: string } {
  if (hasSurvey && hasDrawings) {
    return {
      minTier: 1,
      requiresSiteVisit: false,
      reason: 'Has survey and drawings - ready to start',
    };
  }

  if (hasSurvey || hasDrawings) {
    return {
      minTier: 2,
      requiresSiteVisit: false,
      reason: `Has ${hasSurvey ? 'survey' : 'drawings'} only - some prep work needed`,
    };
  }

  // No assets
  return {
    minTier: 3,
    requiresSiteVisit: true,
    reason: 'No survey or drawings - site visit required',
  };
}

/**
 * Analyze project type
 */
export function analyzeProjectType(projectType: string): { minTier: 1 | 2 | 3 | 4; needsReview: boolean; reason: string } {
  const normalized = projectType.toLowerCase().trim();

  // Simple renovation
  if (normalized === 'renovation' || normalized.includes('simple')) {
    return {
      minTier: 1,
      needsReview: false,
      reason: 'Simple renovation project',
    };
  }

  // Addition
  if (normalized === 'addition' || normalized.includes('add')) {
    return {
      minTier: 2,
      needsReview: false,
      reason: 'Addition project',
    };
  }

  // New build
  if (normalized === 'new_build' || normalized.includes('new build') || normalized.includes('new construction')) {
    return {
      minTier: 3,
      needsReview: false,
      reason: 'New build requires site visits',
    };
  }

  // Complex or multiple properties
  if (normalized === 'complex' || normalized.includes('complex') || normalized === 'multiple_properties' || normalized.includes('multiple')) {
    return {
      minTier: 4,
      needsReview: true,
      reason: 'Complex project requires white-glove service',
    };
  }

  // Unknown project type
  return {
    minTier: 1,
    needsReview: true,
    reason: 'Project type unclear - needs review',
  };
}

/**
 * Main routing function - determines tier based on all factors
 */
export function recommendTier(data: IntakeFormData): TierRecommendation {
  const reasons: string[] = [];
  let needsReview = false;

  // Budget analysis
  const budgetResult = getTierForBudget(data.budgetRange);
  let tier = budgetResult.tier;
  reasons.push(`Budget: Tier ${budgetResult.tier}`);

  if (budgetResult.confidence === 'low') {
    needsReview = true;
    reasons.push('Budget unclear');
  }

  // Tier 4 always needs review
  if (tier === 4) {
    needsReview = true;
    reasons.push('High budget range');
  }

  // Timeline analysis
  const timelineResult = analyzeTimeline(data.timeline);
  reasons.push(timelineResult.reason);

  if (timelineResult.needsReview) {
    needsReview = true;
  }

  // Adjust tier based on timeline constraints
  if (tier < timelineResult.minTier) {
    tier = timelineResult.minTier as 1 | 2 | 3 | 4;
    reasons.push(`Timeline requires minimum Tier ${timelineResult.minTier}`);
  }

  // Check for tight timeline with high tier
  if (timelineResult.maxTier < tier) {
    needsReview = true;
    reasons.push('Tight timeline may not be feasible for this tier');
  }

  // Asset analysis
  const assetResult = analyzeAssets(data.hasSurvey, data.hasDrawings);
  reasons.push(assetResult.reason);

  if (assetResult.requiresSiteVisit && tier < assetResult.minTier) {
    tier = assetResult.minTier as 1 | 2 | 3 | 4;
    reasons.push('Site visit required (no existing assets)');
  }

  // If has both assets, can potentially streamline (only for Tier 3, not Tier 4)
  // Tier 4 clients get white-glove service regardless of assets
  if (data.hasSurvey && data.hasDrawings && tier === 3) {
    // Assets allow for streamlined process, downgrade from Tier 3 to Tier 2
    tier = 2;
    reasons.push('Existing assets allow for streamlined process');
  }

  // Project type analysis
  const projectResult = analyzeProjectType(data.projectType);
  reasons.push(projectResult.reason);

  if (projectResult.needsReview) {
    needsReview = true;
  }

  if (tier < projectResult.minTier) {
    tier = projectResult.minTier as 1 | 2 | 3 | 4;
  }

  // Complex projects always go to Tier 4
  if (data.projectType === 'complex' || data.projectType === 'multiple_properties') {
    tier = 4;
    needsReview = true;
  }

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'high';
  if (needsReview) {
    confidence = 'low';
  } else if (reasons.length > 4) {
    confidence = 'medium';
  }

  // Tier 4 always needs manual review
  if (tier === 4) {
    needsReview = true;
  }

  return {
    tier,
    reason: reasons.join('; '),
    confidence,
    needsManualReview: needsReview,
  };
}

export default {
  recommendTier,
  getTierForBudget,
  analyzeTimeline,
  analyzeAssets,
  analyzeProjectType,
  parseBudgetRange,
  BUDGET_THRESHOLDS,
  TIMELINE,
  PROJECT_TYPES,
};
