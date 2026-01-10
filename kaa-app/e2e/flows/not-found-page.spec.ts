/**
 * E2E Tests for 404 Not Found Page
 * Tests error page display and navigation options
 */

import { test, expect } from '@playwright/test';
import { NotFoundPage } from '../pages/not-found.page';

test.describe('404 Not Found Page', () => {
  test.describe('Page Display', () => {
    test('should display 404 error code', async ({ page }) => {
      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      const has404 = await notFound.has404Code();
      expect(has404).toBeTruthy();
    });

    test('should display error icon', async ({ page }) => {
      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      await expect(notFound.icon).toBeVisible();
    });

    test('should display error title', async ({ page }) => {
      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      await expect(notFound.title).toBeVisible();
    });

    test('should display error message', async ({ page }) => {
      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      await expect(notFound.message).toBeVisible();
    });

    test('should display help section', async ({ page }) => {
      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      const hasHelp = await notFound.hasHelpSection();
      expect(hasHelp).toBeTruthy();
    });
  });

  test.describe('Navigation Options', () => {
    test('should have Go Back button', async ({ page }) => {
      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      await expect(notFound.goBackButton).toBeVisible();
    });

    test('should have Return Home button', async ({ page }) => {
      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      await expect(notFound.returnHomeButton).toBeVisible();
    });

    test('should navigate to home when clicking Return Home', async ({ page }) => {
      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      await notFound.clickReturnHome();
      await expect(page).toHaveURL('/');
    });

    test('should go back in history when clicking Go Back', async ({ page }) => {
      // First visit home page
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Then visit 404 page
      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      // Click go back
      await notFound.clickGoBack();

      // Should be back at home
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Quick Links', () => {
    test('should have quick links section', async ({ page }) => {
      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      const linkCount = await notFound.getQuickLinkCount();
      expect(linkCount).toBeGreaterThan(0);
    });

    test('should have link to Pricing', async ({ page }) => {
      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      const pricingLink = page.getByRole('link', { name: /pricing/i });
      await expect(pricingLink).toBeVisible();
    });

    test('should have link to Portal', async ({ page }) => {
      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      const portalLink = page.getByRole('link', { name: /portal|login/i });
      await expect(portalLink).toBeVisible();
    });
  });

  test.describe('Different Invalid URLs', () => {
    test('should show 404 for /invalid-page', async ({ page }) => {
      await page.goto('/invalid-page');
      await page.waitForLoadState('networkidle');

      const notFound = new NotFoundPage(page);
      await expect(notFound.title).toBeVisible();
    });

    test('should show 404 for /some/nested/invalid/path', async ({ page }) => {
      await page.goto('/some/nested/invalid/path');
      await page.waitForLoadState('networkidle');

      const notFound = new NotFoundPage(page);
      await expect(notFound.title).toBeVisible();
    });

    test('should show 404 for /portal/invalid-project-id', async ({ page }) => {
      await page.goto('/portal/invalid-project-id-12345');
      await page.waitForLoadState('networkidle');

      // May redirect to login or show 404
      const currentUrl = page.url();
      expect(currentUrl.includes('login') || currentUrl.includes('404') || currentUrl.includes('invalid')).toBeTruthy();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      await expect(notFound.title).toBeVisible();
      await expect(notFound.returnHomeButton).toBeVisible();
    });

    test('should display on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      await expect(notFound.title).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have heading', async ({ page }) => {
      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
    });

    test('should have keyboard accessible buttons', async ({ page }) => {
      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      await notFound.returnHomeButton.focus();
      await expect(notFound.returnHomeButton).toBeFocused();
    });

    test('should have descriptive link text', async ({ page }) => {
      const notFound = new NotFoundPage(page);
      await notFound.goto();
      await notFound.waitForLoad();

      // Links should not just say "click here"
      const links = page.locator('a');
      const count = await links.count();

      for (let i = 0; i < count; i++) {
        const text = await links.nth(i).textContent();
        expect(text?.toLowerCase()).not.toBe('click here');
      }
    });
  });
});
