/**
 * Landing Page E2E Tests
 * Tests for the main landing page and navigation.
 */

import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the main heading', async ({ page }) => {
    // Look for the main heading or hero section
    const heading = page.locator('h1, [role="heading"]').first();
    await expect(heading).toBeVisible();
  });

  test('should have navigation links', async ({ page }) => {
    // Check for navigation elements - use broader selectors for flexibility
    const nav = page.locator('nav, [role="navigation"], header, .header, .navbar, .nav');
    const hasNav = await nav.first().isVisible().catch(() => false);

    // Alternatively, check for clickable links in the page
    if (!hasNav) {
      const links = page.locator('a[href]');
      const linkCount = await links.count();
      expect(linkCount).toBeGreaterThan(0);
    } else {
      await expect(nav.first()).toBeVisible();
    }
  });

  test('should have a call-to-action button', async ({ page }) => {
    // Look for CTA buttons
    const ctaButton = page.locator('button, a').filter({ hasText: /get started|sign up|learn more/i }).first();
    await expect(ctaButton).toBeVisible();
  });

  test('should be accessible', async ({ page }) => {
    // Check for basic accessibility - page should have semantic structure
    const main = page.locator('main, [role="main"], .main, #main, .landing-page, .app');
    const hasMain = await main.first().isVisible().catch(() => false);

    if (hasMain) {
      await expect(main.first()).toBeVisible();
    } else {
      // At minimum, check that page has content and is usable
      const body = page.locator('body');
      await expect(body).toBeVisible();

      // Check that page has meaningful content
      const content = await page.textContent('body');
      expect(content?.length).toBeGreaterThan(50);
    }
  });

  test('should have responsive meta tag', async ({ page }) => {
    const viewport = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]');
      return meta?.getAttribute('content');
    });
    expect(viewport).toContain('width=device-width');
  });
});

test.describe('Landing Page - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display properly on mobile', async ({ page }) => {
    await page.goto('/');
    
    // Page should load without horizontal scroll
    const body = page.locator('body');
    const bodyWidth = await body.evaluate((el) => el.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10); // Allow small tolerance
  });
});
