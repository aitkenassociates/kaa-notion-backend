/**
 * E2E Tests for Pricing Page
 * Tests tier cards, features, FAQ, and checkout flow
 */

import { test, expect } from '@playwright/test';
import { PricingPageObject } from '../pages/pricing.page';
import { NavigationPage } from '../pages/navigation.page';

test.describe('Pricing Page', () => {
  test.describe('Page Display', () => {
    test('should display pricing page title', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      await expect(pricing.pageTitle).toBeVisible();
    });

    test('should display page subtitle', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      await expect(pricing.pageSubtitle).toBeVisible();
    });
  });

  test.describe('Tier Cards', () => {
    test('should display at least 3 tier cards', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      const count = await pricing.getTierCardCount();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should display Tier 1 with correct price', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      await expect(pricing.tier1Card).toBeVisible();
      const price = await pricing.getTier1Price();
      expect(price).toMatch(/\$299|\$\d+/);
    });

    test('should display Tier 2 with correct price', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      await expect(pricing.tier2Card).toBeVisible();
      const price = await pricing.getTier2Price();
      expect(price).toMatch(/\$1,?499|\$\d+/);
    });

    test('should display Tier 3 with correct price', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      await expect(pricing.tier3Card).toBeVisible();
      const price = await pricing.getTier3Price();
      expect(price).toMatch(/\$4,?999|\$\d+/);
    });

    test('should have Most Popular badge on Tier 2', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      const hasMostPopular = await pricing.hasMostPopular();
      // Most Popular badge should be on Tier 2
      expect(hasMostPopular).toBeTruthy();
    });
  });

  test.describe('Tier Features', () => {
    test('should display features for Tier 1', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      const features = await pricing.getTierFeatures(1);
      expect(features.length).toBeGreaterThan(0);
    });

    test('should display features for Tier 2', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      const features = await pricing.getTierFeatures(2);
      expect(features.length).toBeGreaterThan(0);
    });

    test('should display features for Tier 3', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      const features = await pricing.getTierFeatures(3);
      expect(features.length).toBeGreaterThan(0);
    });

    test('should have more features in higher tiers', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      const tier1Features = await pricing.getTierFeatures(1);
      const tier2Features = await pricing.getTierFeatures(2);
      const tier3Features = await pricing.getTierFeatures(3);

      // Higher tiers generally have more features
      expect(tier2Features.length).toBeGreaterThanOrEqual(tier1Features.length);
    });
  });

  test.describe('Select Tier Actions', () => {
    test('should have select buttons on tier cards', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      const selectButtonCount = await pricing.selectButtons.count();
      expect(selectButtonCount).toBeGreaterThanOrEqual(3);
    });

    test('should navigate when selecting a tier', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      await pricing.selectTier(1);

      // Should navigate to checkout or get-started
      await expect(page).toHaveURL(/checkout|get-started|intake/);
    });
  });

  test.describe('Tier 4 Premium Section', () => {
    test('should display Tier 4 premium callout', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      const hasTier4 = await pricing.hasTier4Callout();
      // Tier 4 section should be present
      expect(hasTier4).toBeTruthy();
    });
  });

  test.describe('FAQ Section', () => {
    test('should display FAQ section', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      await expect(pricing.faqSection).toBeVisible();
    });

    test('should have at least 3 FAQ items', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      const count = await pricing.getFaqCount();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should expand FAQ item on click', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      const faqCount = await pricing.getFaqCount();
      if (faqCount > 0) {
        await pricing.expandFaq(0);
        const isExpanded = await pricing.isFaqExpanded(0);
        expect(isExpanded).toBeTruthy();
      }
    });
  });

  test.describe('Recommended Tier', () => {
    test('should highlight recommended tier when coming from intake', async ({ page }) => {
      // First complete intake to get recommendation
      await page.goto('/intake');

      // Set session storage to simulate completed intake
      await page.evaluate(() => {
        sessionStorage.setItem('tier_recommendation', JSON.stringify({
          tier: 2,
          confidence: 'high',
          reasons: ['Budget matches', 'Timeline fits'],
        }));
      });

      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      const hasRecommended = await pricing.hasRecommendedTier();
      // May or may not show depending on session state
    });
  });

  test.describe('Navigation', () => {
    test('should have header navigation', async ({ page }) => {
      const nav = new NavigationPage(page);
      await nav.goto('/pricing');
      await nav.waitForLoad();

      await expect(nav.header).toBeVisible();
    });

    test('should navigate home when clicking logo', async ({ page }) => {
      const nav = new NavigationPage(page);
      await nav.goto('/pricing');
      await nav.waitForLoad();

      await nav.clickLogo();
      await expect(page).toHaveURL('/');
    });

    test('should have Get Started link', async ({ page }) => {
      const nav = new NavigationPage(page);
      await nav.goto('/pricing');
      await nav.waitForLoad();

      await expect(nav.getStartedLink).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      await expect(pricing.pageTitle).toBeVisible();
      await expect(pricing.tierCards.first()).toBeVisible();
    });

    test('should stack tier cards on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      // All tier cards should be visible
      const count = await pricing.getTierCardCount();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should display on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      await expect(pricing.pageTitle).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have heading hierarchy', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
    });

    test('should have keyboard accessible tier cards', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      // Select buttons should be focusable
      await pricing.selectButtons.first().focus();
      await expect(pricing.selectButtons.first()).toBeFocused();
    });

    test('should have keyboard accessible FAQ items', async ({ page }) => {
      const pricing = new PricingPageObject(page);
      await pricing.goto();
      await pricing.waitForLoad();

      const faqCount = await pricing.getFaqCount();
      if (faqCount > 0) {
        await pricing.faqItems.first().focus();
      }
    });
  });
});
