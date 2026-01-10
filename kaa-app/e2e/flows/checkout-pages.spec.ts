/**
 * E2E Tests for Checkout Success and Cancel Pages
 * Tests post-payment navigation and user flows
 */

import { test, expect } from '@playwright/test';
import { CheckoutSuccessPage, CheckoutCancelPage } from '../pages/checkout.page';
import { NavigationPage } from '../pages/navigation.page';

test.describe('Checkout Success Page', () => {
  test.describe('Page Display', () => {
    test('should display success icon', async ({ page }) => {
      const success = new CheckoutSuccessPage(page);
      await success.goto();
      await success.waitForLoad();

      await expect(success.successIcon).toBeVisible();
    });

    test('should display success heading', async ({ page }) => {
      const success = new CheckoutSuccessPage(page);
      await success.goto();
      await success.waitForLoad();

      await expect(success.heading).toBeVisible();
    });

    test('should display order details section', async ({ page }) => {
      const success = new CheckoutSuccessPage(page);
      await success.goto();
      await success.waitForLoad();

      await expect(success.orderDetails).toBeVisible();
    });

    test('should display next steps section', async ({ page }) => {
      const success = new CheckoutSuccessPage(page);
      await success.goto();
      await success.waitForLoad();

      const hasNextSteps = await success.hasNextSteps();
      expect(hasNextSteps).toBeTruthy();
    });
  });

  test.describe('Order Details', () => {
    test('should display amount paid', async ({ page }) => {
      const success = new CheckoutSuccessPage(page);
      await success.goto('test-session-123');
      await success.waitForLoad();

      await expect(success.amountPaid).toBeVisible();
    });

    test('should display status', async ({ page }) => {
      const success = new CheckoutSuccessPage(page);
      await success.goto('test-session-123');
      await success.waitForLoad();

      await expect(success.status).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should have Go to Portal button', async ({ page }) => {
      const success = new CheckoutSuccessPage(page);
      await success.goto();
      await success.waitForLoad();

      await expect(success.goToPortalButton).toBeVisible();
    });

    test('should have Return Home button', async ({ page }) => {
      const success = new CheckoutSuccessPage(page);
      await success.goto();
      await success.waitForLoad();

      await expect(success.returnHomeButton).toBeVisible();
    });

    test('should navigate to portal when clicking Go to Portal', async ({ page }) => {
      const success = new CheckoutSuccessPage(page);
      await success.goto();
      await success.waitForLoad();

      await success.clickGoToPortal();
      await expect(page).toHaveURL(/portal|login/);
    });

    test('should navigate to home when clicking Return Home', async ({ page }) => {
      const success = new CheckoutSuccessPage(page);
      await success.goto();
      await success.waitForLoad();

      await success.clickReturnHome();
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Responsive Design', () => {
    test('should display on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const success = new CheckoutSuccessPage(page);
      await success.goto();
      await success.waitForLoad();

      await expect(success.heading).toBeVisible();
      await expect(success.goToPortalButton).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have heading', async ({ page }) => {
      const success = new CheckoutSuccessPage(page);
      await success.goto();
      await success.waitForLoad();

      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
    });

    test('should have keyboard accessible buttons', async ({ page }) => {
      const success = new CheckoutSuccessPage(page);
      await success.goto();
      await success.waitForLoad();

      await success.goToPortalButton.focus();
      await expect(success.goToPortalButton).toBeFocused();
    });
  });
});

test.describe('Checkout Cancel Page', () => {
  test.describe('Page Display', () => {
    test('should display cancel icon', async ({ page }) => {
      const cancel = new CheckoutCancelPage(page);
      await cancel.goto();
      await cancel.waitForLoad();

      await expect(cancel.cancelIcon).toBeVisible();
    });

    test('should display cancel heading', async ({ page }) => {
      const cancel = new CheckoutCancelPage(page);
      await cancel.goto();
      await cancel.waitForLoad();

      await expect(cancel.heading).toBeVisible();
    });

    test('should display explanation', async ({ page }) => {
      const cancel = new CheckoutCancelPage(page);
      await cancel.goto();
      await cancel.waitForLoad();

      await expect(cancel.explanation).toBeVisible();
    });

    test('should display help section', async ({ page }) => {
      const cancel = new CheckoutCancelPage(page);
      await cancel.goto();
      await cancel.waitForLoad();

      const hasHelp = await cancel.hasHelpSection();
      expect(hasHelp).toBeTruthy();
    });
  });

  test.describe('Navigation', () => {
    test('should have Try Again button', async ({ page }) => {
      const cancel = new CheckoutCancelPage(page);
      await cancel.goto();
      await cancel.waitForLoad();

      await expect(cancel.tryAgainButton).toBeVisible();
    });

    test('should have View Pricing button', async ({ page }) => {
      const cancel = new CheckoutCancelPage(page);
      await cancel.goto();
      await cancel.waitForLoad();

      await expect(cancel.viewPricingButton).toBeVisible();
    });

    test('should have Return Home button', async ({ page }) => {
      const cancel = new CheckoutCancelPage(page);
      await cancel.goto();
      await cancel.waitForLoad();

      await expect(cancel.returnHomeButton).toBeVisible();
    });

    test('should navigate to pricing when clicking View Pricing', async ({ page }) => {
      const cancel = new CheckoutCancelPage(page);
      await cancel.goto();
      await cancel.waitForLoad();

      await cancel.clickViewPricing();
      await expect(page).toHaveURL(/pricing/);
    });

    test('should navigate to home when clicking Return Home', async ({ page }) => {
      const cancel = new CheckoutCancelPage(page);
      await cancel.goto();
      await cancel.waitForLoad();

      await cancel.clickReturnHome();
      await expect(page).toHaveURL('/');
    });

    test('should retry checkout when clicking Try Again', async ({ page }) => {
      const cancel = new CheckoutCancelPage(page);
      await cancel.goto();
      await cancel.waitForLoad();

      await cancel.clickTryAgain();
      // Should navigate to pricing or checkout
      await expect(page).toHaveURL(/pricing|checkout|get-started/);
    });
  });

  test.describe('Responsive Design', () => {
    test('should display on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const cancel = new CheckoutCancelPage(page);
      await cancel.goto();
      await cancel.waitForLoad();

      await expect(cancel.heading).toBeVisible();
      await expect(cancel.tryAgainButton).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have heading', async ({ page }) => {
      const cancel = new CheckoutCancelPage(page);
      await cancel.goto();
      await cancel.waitForLoad();

      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
    });

    test('should have keyboard accessible buttons', async ({ page }) => {
      const cancel = new CheckoutCancelPage(page);
      await cancel.goto();
      await cancel.waitForLoad();

      await cancel.tryAgainButton.focus();
      await expect(cancel.tryAgainButton).toBeFocused();
    });
  });
});
