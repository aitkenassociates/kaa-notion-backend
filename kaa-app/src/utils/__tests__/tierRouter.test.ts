/**
 * Unit tests for Tier Router
 * Tests routing logic for different intake scenarios including
 * budgets, timelines, assets, and project types
 */

import {
  recommendTier,
  getTierForBudget,
  analyzeTimeline,
  analyzeAssets,
  analyzeProjectType,
  parseBudgetRange,
  IntakeFormData,
  TierRecommendation,
  BUDGET_THRESHOLDS,
} from '../tierRouter';

describe('Tier Router', () => {
  describe('parseBudgetRange', () => {
    it('parses standard dollar range correctly', () => {
      expect(parseBudgetRange('$0-$5000')).toBe(5000);
      expect(parseBudgetRange('$5000-$15000')).toBe(15000);
      expect(parseBudgetRange('$15000-$50000')).toBe(50000);
    });

    it('handles open-ended ranges with plus sign', () => {
      expect(parseBudgetRange('$50000+')).toBe(Infinity);
      expect(parseBudgetRange('$100000+')).toBe(Infinity);
    });

    it('handles greater-than notation', () => {
      expect(parseBudgetRange('> $50000')).toBe(Infinity);
      expect(parseBudgetRange('>$100000')).toBe(Infinity);
    });

    it('handles percentage-based pricing', () => {
      expect(parseBudgetRange('10% of install')).toBe(Infinity);
      expect(parseBudgetRange('percentage based')).toBe(Infinity);
      expect(parseBudgetRange('15 percent')).toBe(Infinity);
    });

    it('handles "high" keyword', () => {
      expect(parseBudgetRange('high')).toBe(Infinity);
      expect(parseBudgetRange('HIGH')).toBe(Infinity);
      expect(parseBudgetRange('premium')).toBe(Infinity);
    });

    it('handles ranges without dollar signs', () => {
      expect(parseBudgetRange('5000-15000')).toBe(15000);
      expect(parseBudgetRange('10000 to 20000')).toBe(20000);
    });

    it('returns 0 for unparseable budget', () => {
      expect(parseBudgetRange('unknown')).toBe(0);
      expect(parseBudgetRange('')).toBe(0);
      expect(parseBudgetRange('TBD')).toBe(0);
    });

    it('handles case insensitivity', () => {
      expect(parseBudgetRange('$5000-$15000')).toBe(15000);
      expect(parseBudgetRange('HIGH')).toBe(Infinity);
      expect(parseBudgetRange('Premium Budget')).toBe(Infinity);
    });
  });

  describe('getTierForBudget', () => {
    describe('Tier 1 - Low Budget', () => {
      it('returns Tier 1 for budget up to $5000', () => {
        const result = getTierForBudget('$0-$5000');
        expect(result.tier).toBe(1);
        expect(result.confidence).toBe('high');
      });

      it('returns Tier 1 for budget exactly at $5000', () => {
        const result = getTierForBudget('$5000');
        expect(result.tier).toBe(1);
        expect(result.confidence).toBe('high');
      });

      it('returns Tier 1 for budget under $3000', () => {
        const result = getTierForBudget('$1000-$3000');
        expect(result.tier).toBe(1);
        expect(result.confidence).toBe('high');
      });
    });

    describe('Tier 2 - Mid Budget', () => {
      it('returns Tier 2 for budget $5001-$15000', () => {
        const result = getTierForBudget('$5000-$15000');
        expect(result.tier).toBe(2);
        expect(result.confidence).toBe('high');
      });

      it('returns Tier 2 for budget around $10000', () => {
        const result = getTierForBudget('$8000-$12000');
        expect(result.tier).toBe(2);
        expect(result.confidence).toBe('high');
      });

      it('returns Tier 2 for exact $10000', () => {
        const result = getTierForBudget('$10000');
        expect(result.tier).toBe(2);
        expect(result.confidence).toBe('high');
      });
    });

    describe('Tier 3 - High Budget', () => {
      it('returns Tier 3 for budget $15001-$50000', () => {
        const result = getTierForBudget('$15000-$50000');
        expect(result.tier).toBe(3);
        expect(result.confidence).toBe('high');
      });

      it('returns Tier 3 for budget around $30000', () => {
        const result = getTierForBudget('$25000-$35000');
        expect(result.tier).toBe(3);
        expect(result.confidence).toBe('high');
      });

      it('returns Tier 3 for exact $20000', () => {
        const result = getTierForBudget('$20000');
        expect(result.tier).toBe(3);
        expect(result.confidence).toBe('high');
      });
    });

    describe('Tier 4 - Premium Budget', () => {
      it('returns Tier 4 for budget above $50000', () => {
        const result = getTierForBudget('$50000+');
        expect(result.tier).toBe(4);
        expect(result.confidence).toBe('high');
      });

      it('returns Tier 4 for budget $100000+', () => {
        const result = getTierForBudget('$100000+');
        expect(result.tier).toBe(4);
        expect(result.confidence).toBe('high');
      });

      it('returns Tier 4 for percentage-based pricing', () => {
        const result = getTierForBudget('10% of install');
        expect(result.tier).toBe(4);
        expect(result.confidence).toBe('high');
      });

      it('returns Tier 4 for "high" budget', () => {
        const result = getTierForBudget('high');
        expect(result.tier).toBe(4);
        expect(result.confidence).toBe('high');
      });

      it('returns Tier 4 for premium budget', () => {
        const result = getTierForBudget('premium');
        expect(result.tier).toBe(4);
        expect(result.confidence).toBe('high');
      });
    });

    describe('Unknown Budget', () => {
      it('returns Tier 1 with low confidence for unknown budget', () => {
        const result = getTierForBudget('unknown');
        expect(result.tier).toBe(1);
        expect(result.confidence).toBe('low');
      });

      it('returns Tier 1 with low confidence for empty budget', () => {
        const result = getTierForBudget('');
        expect(result.tier).toBe(1);
        expect(result.confidence).toBe('low');
      });

      it('returns Tier 1 with low confidence for TBD budget', () => {
        const result = getTierForBudget('TBD');
        expect(result.tier).toBe(1);
        expect(result.confidence).toBe('low');
      });
    });

    describe('Budget Thresholds', () => {
      it('correctly uses TIER_1_MAX threshold', () => {
        expect(getTierForBudget(`$${BUDGET_THRESHOLDS.TIER_1_MAX}`).tier).toBe(1);
        expect(getTierForBudget(`$${BUDGET_THRESHOLDS.TIER_1_MAX + 1}`).tier).toBe(2);
      });

      it('correctly uses TIER_2_MAX threshold', () => {
        expect(getTierForBudget(`$${BUDGET_THRESHOLDS.TIER_2_MAX}`).tier).toBe(2);
        expect(getTierForBudget(`$${BUDGET_THRESHOLDS.TIER_2_MAX + 1}`).tier).toBe(3);
      });

      it('correctly uses TIER_3_MAX threshold', () => {
        expect(getTierForBudget(`$${BUDGET_THRESHOLDS.TIER_3_MAX}`).tier).toBe(3);
        expect(getTierForBudget(`$${BUDGET_THRESHOLDS.TIER_3_MAX + 1}`).tier).toBe(4);
      });
    });
  });

  describe('analyzeTimeline', () => {
    describe('Fast Track (< 2 weeks)', () => {
      it('returns correct tier range for < 2 weeks', () => {
        const result = analyzeTimeline('< 2 weeks');
        expect(result.minTier).toBe(1);
        expect(result.maxTier).toBe(2);
        expect(result.needsReview).toBe(false);
        expect(result.reason).toContain('Fast track');
      });

      it('handles "less than 2 weeks" variation', () => {
        const result = analyzeTimeline('less than 2 weeks');
        expect(result.minTier).toBe(1);
        expect(result.maxTier).toBe(2);
      });

      it('handles "under 2 weeks" variation', () => {
        const result = analyzeTimeline('under 2 weeks');
        expect(result.minTier).toBe(1);
        expect(result.maxTier).toBe(2);
      });
    });

    describe('Standard Short (2-4 weeks)', () => {
      it('returns correct tier range for 2-4 weeks', () => {
        const result = analyzeTimeline('2-4 weeks');
        expect(result.minTier).toBe(1);
        expect(result.maxTier).toBe(2);
        expect(result.needsReview).toBe(false);
        expect(result.reason).toContain('2-4 weeks');
      });

      it('handles "2 to 4 weeks" variation', () => {
        const result = analyzeTimeline('2 to 4 weeks');
        expect(result.minTier).toBe(1);
        expect(result.maxTier).toBe(2);
      });
    });

    describe('Standard (4-8 weeks)', () => {
      it('returns correct tier range for 4-8 weeks', () => {
        const result = analyzeTimeline('4-8 weeks');
        expect(result.minTier).toBe(1);
        expect(result.maxTier).toBe(3);
        expect(result.needsReview).toBe(false);
        expect(result.reason).toContain('4-8 weeks');
      });

      it('handles "4 to 8 weeks" variation', () => {
        const result = analyzeTimeline('4 to 8 weeks');
        expect(result.minTier).toBe(1);
        expect(result.maxTier).toBe(3);
      });
    });

    describe('Extended (> 8 weeks)', () => {
      it('returns correct tier range for > 8 weeks', () => {
        const result = analyzeTimeline('> 8 weeks');
        expect(result.minTier).toBe(3);
        expect(result.maxTier).toBe(4);
        expect(result.needsReview).toBe(false);
        expect(result.reason).toContain('Extended');
      });

      it('handles "more than 8 weeks" variation', () => {
        const result = analyzeTimeline('more than 8 weeks');
        expect(result.minTier).toBe(3);
        expect(result.maxTier).toBe(4);
      });

      it('handles "over 8 weeks" variation', () => {
        const result = analyzeTimeline('over 8 weeks');
        expect(result.minTier).toBe(3);
        expect(result.maxTier).toBe(4);
      });
    });

    describe('Long Term (6+ months)', () => {
      it('returns correct tier range for 6+ months', () => {
        const result = analyzeTimeline('6+ months');
        expect(result.minTier).toBe(3);
        expect(result.maxTier).toBe(4);
        expect(result.needsReview).toBe(false);
        expect(result.reason).toContain('Long-term');
      });

      it('handles "6 months" variation', () => {
        const result = analyzeTimeline('6 months');
        expect(result.minTier).toBe(3);
        expect(result.maxTier).toBe(4);
      });

      it('handles generic "months" timeline', () => {
        const result = analyzeTimeline('several months');
        expect(result.minTier).toBe(3);
        expect(result.maxTier).toBe(4);
      });
    });

    describe('Unknown Timeline', () => {
      it('returns full tier range with review needed for unknown', () => {
        const result = analyzeTimeline('unknown');
        expect(result.minTier).toBe(1);
        expect(result.maxTier).toBe(4);
        expect(result.needsReview).toBe(true);
        expect(result.reason).toContain('unclear');
      });

      it('handles empty timeline', () => {
        const result = analyzeTimeline('');
        expect(result.needsReview).toBe(true);
      });

      it('handles unrecognized timeline format', () => {
        const result = analyzeTimeline('ASAP');
        expect(result.needsReview).toBe(true);
      });
    });
  });

  describe('analyzeAssets', () => {
    describe('Has Both Survey and Drawings', () => {
      it('returns Tier 1 minimum when both assets present', () => {
        const result = analyzeAssets(true, true);
        expect(result.minTier).toBe(1);
        expect(result.requiresSiteVisit).toBe(false);
        expect(result.reason).toContain('survey and drawings');
      });
    });

    describe('Has Survey Only', () => {
      it('returns Tier 2 minimum when only survey present', () => {
        const result = analyzeAssets(true, false);
        expect(result.minTier).toBe(2);
        expect(result.requiresSiteVisit).toBe(false);
        expect(result.reason).toContain('survey');
      });
    });

    describe('Has Drawings Only', () => {
      it('returns Tier 2 minimum when only drawings present', () => {
        const result = analyzeAssets(false, true);
        expect(result.minTier).toBe(2);
        expect(result.requiresSiteVisit).toBe(false);
        expect(result.reason).toContain('drawings');
      });
    });

    describe('No Assets', () => {
      it('returns Tier 3 minimum with site visit required when no assets', () => {
        const result = analyzeAssets(false, false);
        expect(result.minTier).toBe(3);
        expect(result.requiresSiteVisit).toBe(true);
        expect(result.reason).toContain('site visit');
      });
    });
  });

  describe('analyzeProjectType', () => {
    describe('Simple Renovation', () => {
      it('returns Tier 1 minimum for renovation', () => {
        const result = analyzeProjectType('renovation');
        expect(result.minTier).toBe(1);
        expect(result.needsReview).toBe(false);
        expect(result.reason).toContain('renovation');
      });

      it('handles "simple" keyword', () => {
        const result = analyzeProjectType('simple renovation');
        expect(result.minTier).toBe(1);
      });
    });

    describe('Addition', () => {
      it('returns Tier 2 minimum for addition', () => {
        const result = analyzeProjectType('addition');
        expect(result.minTier).toBe(2);
        expect(result.needsReview).toBe(false);
        expect(result.reason).toContain('Addition');
      });

      it('handles "add" keyword', () => {
        const result = analyzeProjectType('home addition');
        expect(result.minTier).toBe(2);
      });
    });

    describe('New Build', () => {
      it('returns Tier 3 minimum for new_build', () => {
        const result = analyzeProjectType('new_build');
        expect(result.minTier).toBe(3);
        expect(result.needsReview).toBe(false);
        expect(result.reason).toContain('New build');
      });

      it('handles "new build" variation', () => {
        const result = analyzeProjectType('new build');
        expect(result.minTier).toBe(3);
      });

      it('handles "new construction" variation', () => {
        const result = analyzeProjectType('new construction');
        expect(result.minTier).toBe(3);
      });
    });

    describe('Complex Projects', () => {
      it('returns Tier 4 minimum for complex projects', () => {
        const result = analyzeProjectType('complex');
        expect(result.minTier).toBe(4);
        expect(result.needsReview).toBe(true);
        expect(result.reason).toContain('white-glove');
      });

      it('handles complex keyword in description', () => {
        const result = analyzeProjectType('complex renovation');
        expect(result.minTier).toBe(4);
        expect(result.needsReview).toBe(true);
      });
    });

    describe('Multiple Properties', () => {
      it('returns Tier 4 minimum for multiple_properties', () => {
        const result = analyzeProjectType('multiple_properties');
        expect(result.minTier).toBe(4);
        expect(result.needsReview).toBe(true);
      });

      it('handles "multiple" keyword', () => {
        const result = analyzeProjectType('multiple properties');
        expect(result.minTier).toBe(4);
        expect(result.needsReview).toBe(true);
      });
    });

    describe('Unknown Project Type', () => {
      it('returns Tier 1 with review needed for unknown type', () => {
        const result = analyzeProjectType('unknown');
        expect(result.minTier).toBe(1);
        expect(result.needsReview).toBe(true);
        expect(result.reason).toContain('unclear');
      });

      it('handles empty project type', () => {
        const result = analyzeProjectType('');
        expect(result.needsReview).toBe(true);
      });
    });
  });

  describe('recommendTier', () => {
    const createIntakeData = (overrides: Partial<IntakeFormData> = {}): IntakeFormData => ({
      budgetRange: '$5000-$15000',
      timeline: '4-8 weeks',
      projectType: 'renovation',
      hasSurvey: true,
      hasDrawings: true,
      projectAddress: '123 Main St',
      ...overrides,
    });

    describe('Clear Tier 1 Scenarios', () => {
      it('routes to Tier 1: low budget, has assets, simple project', () => {
        const data = createIntakeData({
          budgetRange: '$0-$5000',
          timeline: '2-4 weeks',
          projectType: 'renovation',
          hasSurvey: true,
          hasDrawings: true,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(1);
        expect(result.confidence).toBe('high');
        expect(result.needsManualReview).toBe(false);
      });

      it('routes to Tier 1: budget at threshold with fast track', () => {
        const data = createIntakeData({
          budgetRange: '$3000-$5000',
          timeline: '< 2 weeks',
          projectType: 'renovation',
          hasSurvey: true,
          hasDrawings: true,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(1);
        expect(result.needsManualReview).toBe(false);
      });
    });

    describe('Clear Tier 2 Scenarios', () => {
      it('routes to Tier 2: mid budget, has assets, standard project', () => {
        const data = createIntakeData({
          budgetRange: '$5000-$15000',
          timeline: '4-8 weeks',
          projectType: 'renovation',
          hasSurvey: true,
          hasDrawings: true,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(2);
        expect(result.confidence).toBe('high');
        expect(result.needsManualReview).toBe(false);
      });

      it('routes to Tier 2: mid budget with partial assets', () => {
        const data = createIntakeData({
          budgetRange: '$8000-$12000',
          timeline: '2-4 weeks',
          projectType: 'addition',
          hasSurvey: true,
          hasDrawings: false,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(2);
      });

      it('routes to Tier 2: low budget but addition project', () => {
        const data = createIntakeData({
          budgetRange: '$3000-$5000',
          timeline: '4-8 weeks',
          projectType: 'addition',
          hasSurvey: true,
          hasDrawings: true,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(2);
      });
    });

    describe('Clear Tier 3 Scenarios', () => {
      it('routes to Tier 3: high budget, new build', () => {
        const data = createIntakeData({
          budgetRange: '$15000-$50000',
          timeline: '> 8 weeks',
          projectType: 'new_build',
          hasSurvey: false,
          hasDrawings: false,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(3);
        expect(result.needsManualReview).toBe(false);
      });

      it('routes to Tier 3: no assets require site visit', () => {
        const data = createIntakeData({
          budgetRange: '$10000-$15000',
          timeline: '4-8 weeks',
          projectType: 'renovation',
          hasSurvey: false,
          hasDrawings: false,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(3);
        expect(result.reason).toContain('site visit');
      });

      it('routes to Tier 3: extended timeline', () => {
        const data = createIntakeData({
          budgetRange: '$10000-$20000',
          timeline: '6+ months',
          projectType: 'addition',
          hasSurvey: true,
          hasDrawings: false,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(3);
      });

      it('downgrades from Tier 3 to Tier 2 with both assets', () => {
        const data = createIntakeData({
          budgetRange: '$20000-$30000',
          timeline: '4-8 weeks',
          projectType: 'renovation',
          hasSurvey: true,
          hasDrawings: true,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(2);
        expect(result.reason).toContain('streamlined');
      });
    });

    describe('Tier 4 Scenarios', () => {
      it('routes to Tier 4: very high budget', () => {
        const data = createIntakeData({
          budgetRange: '$50000+',
          timeline: '> 8 weeks',
          projectType: 'new_build',
          hasSurvey: false,
          hasDrawings: false,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(4);
        expect(result.needsManualReview).toBe(true);
      });

      it('routes to Tier 4: complex project type', () => {
        const data = createIntakeData({
          budgetRange: '$15000-$30000',
          timeline: '4-8 weeks',
          projectType: 'complex',
          hasSurvey: true,
          hasDrawings: true,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(4);
        expect(result.needsManualReview).toBe(true);
      });

      it('routes to Tier 4: multiple properties', () => {
        const data = createIntakeData({
          budgetRange: '$20000-$40000',
          timeline: '6+ months',
          projectType: 'multiple_properties',
          hasSurvey: false,
          hasDrawings: false,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(4);
        expect(result.needsManualReview).toBe(true);
      });

      it('routes to Tier 4: percentage-based pricing', () => {
        const data = createIntakeData({
          budgetRange: '10% of install',
          timeline: '> 8 weeks',
          projectType: 'new_build',
          hasSurvey: false,
          hasDrawings: false,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(4);
        expect(result.needsManualReview).toBe(true);
      });

      it('always requires manual review for Tier 4', () => {
        const data = createIntakeData({
          budgetRange: '$100000+',
          timeline: '> 8 weeks',
          projectType: 'new_build',
          hasSurvey: true,
          hasDrawings: true,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(4);
        expect(result.needsManualReview).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      it('handles unclear budget - needs review', () => {
        const data = createIntakeData({
          budgetRange: 'TBD',
          timeline: '4-8 weeks',
          projectType: 'renovation',
          hasSurvey: true,
          hasDrawings: true,
        });

        const result = recommendTier(data);
        expect(result.confidence).toBe('low');
        expect(result.needsManualReview).toBe(true);
      });

      it('handles unclear timeline - needs review', () => {
        const data = createIntakeData({
          budgetRange: '$10000-$15000',
          timeline: 'ASAP',
          projectType: 'renovation',
          hasSurvey: true,
          hasDrawings: true,
        });

        const result = recommendTier(data);
        expect(result.needsManualReview).toBe(true);
      });

      it('flags tight timeline with high tier for review', () => {
        const data = createIntakeData({
          budgetRange: '$20000-$40000',
          timeline: '< 2 weeks',
          projectType: 'new_build',
          hasSurvey: false,
          hasDrawings: false,
        });

        const result = recommendTier(data);
        expect(result.needsManualReview).toBe(true);
        expect(result.reason).toContain('feasible');
      });

      it('handles all unknown inputs', () => {
        const data = createIntakeData({
          budgetRange: '',
          timeline: '',
          projectType: '',
          hasSurvey: false,
          hasDrawings: false,
        });

        const result = recommendTier(data);
        expect(result.needsManualReview).toBe(true);
        expect(result.confidence).toBe('low');
      });

      it('provides concatenated reasons', () => {
        const data = createIntakeData({
          budgetRange: '$15000-$50000',
          timeline: '> 8 weeks',
          projectType: 'new_build',
          hasSurvey: false,
          hasDrawings: false,
        });

        const result = recommendTier(data);
        expect(result.reason).toContain(';');
        expect(result.reason.split(';').length).toBeGreaterThan(1);
      });
    });

    describe('Confidence Levels', () => {
      it('returns high confidence for clear tier match', () => {
        const data = createIntakeData({
          budgetRange: '$0-$5000',
          timeline: '2-4 weeks',
          projectType: 'renovation',
          hasSurvey: true,
          hasDrawings: true,
        });

        const result = recommendTier(data);
        expect(result.confidence).toBe('high');
      });

      it('returns low confidence when review needed', () => {
        const data = createIntakeData({
          budgetRange: '$50000+',
          timeline: '> 8 weeks',
          projectType: 'complex',
          hasSurvey: false,
          hasDrawings: false,
        });

        const result = recommendTier(data);
        expect(result.confidence).toBe('low');
      });

      it('returns medium confidence with many reasons', () => {
        const data = createIntakeData({
          budgetRange: '$15000-$30000',
          timeline: '4-8 weeks',
          projectType: 'addition',
          hasSurvey: true,
          hasDrawings: false,
        });

        const result = recommendTier(data);
        // Multiple factors contribute to the decision
        expect(['high', 'medium']).toContain(result.confidence);
      });
    });

    describe('Asset Downgrade Logic', () => {
      it('does not downgrade below Tier 2 with assets', () => {
        const data = createIntakeData({
          budgetRange: '$30000-$40000',
          timeline: '4-8 weeks',
          projectType: 'renovation',
          hasSurvey: true,
          hasDrawings: true,
        });

        const result = recommendTier(data);
        expect(result.tier).toBeGreaterThanOrEqual(2);
      });

      it('assets allow streamlined process message', () => {
        const data = createIntakeData({
          budgetRange: '$20000-$30000',
          timeline: '4-8 weeks',
          projectType: 'renovation',
          hasSurvey: true,
          hasDrawings: true,
        });

        const result = recommendTier(data);
        expect(result.reason).toContain('streamlined');
      });
    });

    describe('Integration Scenarios from Documentation', () => {
      it('Test Case 1: Clear Tier 1 - Budget low, timeline standard, has assets', () => {
        const data = createIntakeData({
          budgetRange: '$3000-$5000',
          timeline: '4-8 weeks',
          projectType: 'renovation',
          hasSurvey: true,
          hasDrawings: true,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(1);
      });

      it('Test Case 2: Clear Tier 2 - Budget mid, timeline standard, has some assets', () => {
        const data = createIntakeData({
          budgetRange: '$8000-$12000',
          timeline: '4-8 weeks',
          projectType: 'renovation',
          hasSurvey: true,
          hasDrawings: false,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(2);
      });

      it('Test Case 3: Clear Tier 3 - Budget high, no assets, new build', () => {
        const data = createIntakeData({
          budgetRange: '$25000-$40000',
          timeline: '> 8 weeks',
          projectType: 'new_build',
          hasSurvey: false,
          hasDrawings: false,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(3);
      });

      it('Test Case 4: Tier 4 - Budget very high OR complex project (review required)', () => {
        const data = createIntakeData({
          budgetRange: '$75000-$100000',
          timeline: '6+ months',
          projectType: 'complex',
          hasSurvey: false,
          hasDrawings: false,
        });

        const result = recommendTier(data);
        expect(result.tier).toBe(4);
        expect(result.needsManualReview).toBe(true);
      });

      it('Test Case 5: Edge Case - Budget mid, no timeline (review required)', () => {
        const data = createIntakeData({
          budgetRange: '$10000-$15000',
          timeline: 'not specified',
          projectType: 'renovation',
          hasSurvey: true,
          hasDrawings: true,
        });

        const result = recommendTier(data);
        expect(result.needsManualReview).toBe(true);
      });

      it('Test Case 6: Edge Case - Budget high, tight timeline (review required)', () => {
        const data = createIntakeData({
          budgetRange: '$30000-$50000',
          timeline: '< 2 weeks',
          projectType: 'new_build',
          hasSurvey: false,
          hasDrawings: false,
        });

        const result = recommendTier(data);
        expect(result.needsManualReview).toBe(true);
        expect(result.reason).toContain('feasible');
      });
    });
  });
});
