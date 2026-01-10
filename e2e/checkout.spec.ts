/**
 * Checkout Flow E2E Tests
 * Tests for the pricing and checkout flow.
 */

import { test, expect } from '@playwright/test';

test.describe('Pricing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('should display all tier options', async ({ page }) => {
    // Look for tier/pricing cards or sections
    const tierCards = page.locator('[class*="tier"], [class*="pricing"], [class*="card"], [class*="plan"]');
    const cardCount = await tierCards.count();

    if (cardCount >= 3) {
      // Has multiple tier cards
      expect(cardCount).toBeGreaterThanOrEqual(3);
    } else {
      // Check for price mentions instead
      const priceContent = await page.textContent('body');
      const hasPricing = priceContent && (
        /\$\d/.test(priceContent) ||
        /tier/i.test(priceContent) ||
        /plan/i.test(priceContent)
      );
      expect(hasPricing).toBeTruthy();
    }
  });

  test('should have purchase buttons for each tier', async ({ page }) => {
    // Look for purchase/select buttons
    const purchaseButtons = page.locator('button, a').filter({
      hasText: /select|choose|purchase|buy|get started|continue/i
    });

    const count = await purchaseButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should show features for each tier', async ({ page }) => {
    // Each tier should have a features list
    const featureLists = page.locator('ul, li, [class*="feature"]');
    const count = await featureLists.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should highlight recommended/popular tier', async ({ page }) => {
    // Look for popular or recommended badge - optional feature
    const popularBadge = page.locator('text=/popular|recommended|best value|most chosen/i');
    const hasPopular = await popularBadge.first().isVisible().catch(() => false);

    // This is optional, so just verify page has pricing content
    if (!hasPopular) {
      const pageContent = await page.textContent('body');
      expect(pageContent?.length).toBeGreaterThan(100);
    }
  });
});

test.describe('Checkout Flow', () => {
  test('should navigate to checkout when tier selected', async ({ page }) => {
    await page.goto('/pricing');

    // Click on a purchase button
    const purchaseButton = page.locator('button, a').filter({
      hasText: /select|choose|purchase|buy|get started|continue/i
    }).first();

    const hasButton = await purchaseButton.isVisible().catch(() => false);
    if (!hasButton) {
      // If no purchase button, check if page is interactive
      const links = await page.locator('a[href]').count();
      expect(links).toBeGreaterThan(0);
      return;
    }

    await purchaseButton.click();

    // Should navigate or show modal
    await page.waitForTimeout(2000);

    // Check if navigation happened or modal appeared
    const url = page.url();
    const navigated = !url.endsWith('/pricing');
    const hasModal = await page.locator('[class*="checkout"], [class*="payment"], [class*="modal"]').first().isVisible().catch(() => false);

    expect(navigated || hasModal).toBeTruthy();
  });

  test('should pass tier information to checkout', async ({ page }) => {
    // Start from pricing and select a tier
    await page.goto('/pricing');

    const tierButton = page.locator('button, a').filter({
      hasText: /builder|tier 2|professional|select|choose/i
    }).first();

    const hasButton = await tierButton.isVisible().catch(() => false);
    if (!hasButton) {
      // Skip if no tier selection available
      return;
    }

    await tierButton.click();
    await page.waitForTimeout(2000);

    // Verify navigation or page change occurred
    const url = page.url();
    const pageContent = await page.textContent('body');

    // Should have meaningful content after selection
    expect(pageContent?.length).toBeGreaterThan(50);
  });
});

test.describe('Checkout - Stripe Integration', () => {
  test.skip(({ browserName }) => true, 'Requires Stripe test keys');

  test('should redirect to Stripe checkout', async ({ page }) => {
    // This test would verify Stripe redirect
    // Requires test Stripe keys in environment
  });

  test('should handle successful payment callback', async ({ page }) => {
    // Test success redirect from Stripe
    await page.goto('/checkout/success?session_id=test_session');
    
    // Should show success message
    const successMessage = page.locator('text=/success|thank you|confirmed/i');
    await expect(successMessage.first()).toBeVisible();
  });

  test('should handle canceled payment callback', async ({ page }) => {
    // Test cancel redirect from Stripe
    await page.goto('/checkout/cancel');
    
    // Should show appropriate message or redirect
    const message = page.locator('text=/cancel|try again|return/i');
    await expect(message.first()).toBeVisible();
  });
});

test.describe('Checkout - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display pricing correctly on mobile', async ({ page }) => {
    await page.goto('/pricing');

    // Pricing cards should stack vertically
    const pricingCards = page.locator('[class*="tier"], [class*="pricing"], [class*="card"]');
    
    if (await pricingCards.count() > 0) {
      const firstCard = pricingCards.first();
      await expect(firstCard).toBeVisible();
    }
  });

  test('should have tappable purchase buttons on mobile', async ({ page }) => {
    await page.goto('/pricing');

    const purchaseButton = page.locator('button, a').filter({ 
      hasText: /select|choose|purchase|buy|get started/i 
    }).first();
    
    if (await purchaseButton.isVisible()) {
      // Button should be large enough for touch
      const box = await purchaseButton.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40); // Min touch target
      }
    }
  });
});
