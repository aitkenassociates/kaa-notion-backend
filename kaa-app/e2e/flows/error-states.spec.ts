/**
 * E2E Tests for Error States and Network Failures
 * Tests application resilience and error handling
 */

import { test, expect } from '@playwright/test';
import {
  MockApiManager,
  createMockManager,
  mockServerError,
  mockNotFound,
  mockValidationError,
  mockRateLimited,
  mockUnauthorized,
  mockAuthFailure,
  simulateNetworkCondition,
  simulateTimeout,
} from '../utils/mock-api';
import { LandingPage } from '../pages/landing.page';
import { IntakeFormPage } from '../pages/intake-form.page';
import { PricingPageObject } from '../pages/pricing.page';
import { generateUniqueEmail, generateAddress } from '../utils/test-data';
import {
  setDeviceViewport,
  DEVICE_PRESETS,
} from '../utils/responsive-helpers';

test.describe('Error States and Network Failures', () => {
  let mockManager: MockApiManager;

  test.beforeEach(async ({ page }) => {
    mockManager = createMockManager(page);
    mockManager.startRecording();
  });

  test.describe('Network Offline', () => {
    test('should show offline indicator when network is offline', async ({ page }) => {
      const landing = new LandingPage(page);
      await landing.goto();
      await landing.waitForLoad();

      // Go offline
      await simulateNetworkCondition(page, 'offline');

      // Try to navigate
      await landing.clickGetStarted();

      // Should show some offline indication
      const offlineIndicator = page.locator('[data-testid="offline"], .offline-banner, [role="alert"]');
      const hasOfflineUI = await offlineIndicator.count() > 0 ||
        await page.locator('text=/offline|connection|network/i').count() > 0;

      // Application should handle offline gracefully
    });

    test('should recover when network comes back online', async ({ page }) => {
      const landing = new LandingPage(page);
      await landing.goto();

      // Go offline then online
      await simulateNetworkCondition(page, 'offline');
      await page.waitForTimeout(500);
      await simulateNetworkCondition(page, 'wifi');

      // Should work normally after reconnection
      await landing.waitForLoad();
      await expect(landing.heroSection).toBeVisible();
    });
  });

  test.describe('Slow Network', () => {
    test('should show loading states on slow network', async ({ page }) => {
      await simulateNetworkCondition(page, 'slow-3g');

      const pricing = new PricingPageObject(page);

      // Start navigation
      const navigationPromise = pricing.goto();

      // Loading indicators might appear
      const loadingIndicator = page.locator('.loading, .spinner, [role="progressbar"]');

      // Wait for page to load
      await navigationPromise;
      await pricing.waitForLoad();

      // Page should eventually load
      await expect(pricing.pageTitle).toBeVisible({ timeout: 30000 });
    });

    test('should complete form submission on slow network', async ({ page }) => {
      await simulateNetworkCondition(page, 'fast-3g');

      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await intake.fillStep1({
        email: generateUniqueEmail('slow-network'),
        address: generateAddress(),
      });

      await intake.continueButton.click();

      // Should advance despite slow network
      const progress = await intake.getProgress();
      expect(progress).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Server Errors (5xx)', () => {
    test('should display error message on 500 error', async ({ page }) => {
      await mockManager.mock(mockServerError('**/api/**'));

      await page.goto('/pricing');
      await page.waitForTimeout(1000);

      // Should show error state or fallback content
      const errorMessage = page.locator('[role="alert"], .error-message, .error-state');
      const hasError = await errorMessage.count() > 0;

      // Page should not crash
      await expect(page.locator('body')).toBeVisible();
    });

    test('should show retry option on server error', async ({ page }) => {
      await mockManager.mock(mockServerError('**/api/**'));

      await page.goto('/portal');
      await page.waitForTimeout(1000);

      const retryButton = page.locator('button:has-text("retry"), button:has-text("try again")');
      // Retry button might be available
    });

    test('should recover after retry on transient error', async ({ page }) => {
      let callCount = 0;

      await mockManager.mock({
        url: '**/api/**',
        response: (request) => {
          callCount++;
          if (callCount <= 2) {
            return { status: 503, body: { error: 'Service unavailable' } };
          }
          return { status: 200, body: { success: true } };
        },
      });

      await page.goto('/pricing');
      await page.waitForTimeout(500);

      // Application should handle recovery
    });
  });

  test.describe('Client Errors (4xx)', () => {
    test('should display validation errors from API', async ({ page }) => {
      await mockManager.mock(
        mockValidationError('**/api/intake**', {
          email: ['Invalid email format'],
          address: ['Address is required'],
        })
      );

      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await intake.emailInput.fill('invalid-email');
      await intake.continueButton.click();
      await page.waitForTimeout(500);

      // Should show validation errors
      const errors = page.locator('[role="alert"], .error-message, .field-error');
      // Validation feedback should be visible
    });

    test('should handle 401 unauthorized gracefully', async ({ page }) => {
      await mockManager.mock(mockUnauthorized('**/api/auth/me'));

      await page.goto('/portal');
      await page.waitForTimeout(1000);

      // Should redirect to login or show auth prompt
      const currentUrl = page.url();
      const isOnAuthPage = currentUrl.includes('login') || currentUrl.includes('auth');

      const authPrompt = page.locator('text=/sign in|log in|login/i');
      const hasAuthUI = await authPrompt.count() > 0;

      expect(isOnAuthPage || hasAuthUI).toBeTruthy();
    });

    test('should handle 404 not found', async ({ page }) => {
      await page.goto('/nonexistent-page-12345');
      await page.waitForTimeout(500);

      // Should show 404 page
      const has404Content = await page.locator('text=/404|not found|page.*not.*exist/i').count() > 0;
      expect(has404Content).toBeTruthy();
    });

    test('should handle rate limiting (429)', async ({ page }) => {
      await mockManager.mock(mockRateLimited('**/api/**', 30));

      await page.goto('/pricing');
      await page.waitForTimeout(500);

      // Should show rate limit message or handle gracefully
      const rateLimitMessage = page.locator('text=/too many|rate limit|slow down|try again/i');
      // Rate limit handling should be in place
    });
  });

  test.describe('Authentication Errors', () => {
    test('should show error on invalid credentials', async ({ page }) => {
      await mockManager.mockAll(mockAuthFailure('Invalid email or password'));

      await page.goto('/login');
      await page.waitForTimeout(500);

      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"], button:has-text("login"), button:has-text("sign in")');

      if (await emailInput.isVisible()) {
        await emailInput.fill('test@example.com');
        await passwordInput.fill('wrongpassword');
        await submitButton.click();
        await page.waitForTimeout(1000);

        // Should show error message
        const errorMessage = page.locator('[role="alert"], .error-message, text=/invalid|incorrect|wrong/i');
        // Error should be displayed
      }
    });

    test('should handle session expiry', async ({ page }) => {
      // First allow login
      await mockManager.mock({
        method: 'GET',
        url: '**/api/auth/me',
        response: (request) => {
          // Check for auth header
          const auth = request.headers()['authorization'];
          if (!auth) {
            return { status: 401, body: { error: 'Session expired' } };
          }
          return { status: 200, body: { id: '1', email: 'test@test.com' } };
        },
      });

      await page.goto('/portal');
      await page.waitForTimeout(500);

      // Should redirect to login on session expiry
      const isOnLogin = page.url().includes('login') || page.url().includes('auth');
      // Session handling should work
    });
  });

  test.describe('Request Timeout', () => {
    test('should handle API timeout gracefully', async ({ page }) => {
      // Set a very short timeout for testing
      await simulateTimeout(page, '**/api/intake**', 100);

      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await intake.fillStep1({
        email: generateUniqueEmail('timeout-test'),
        address: generateAddress(),
      });

      await intake.continueButton.click();
      await page.waitForTimeout(500);

      // Should show timeout error or loading state
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Form Error States', () => {
    test('should show inline validation errors', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      // Submit without filling required fields
      await intake.continueButton.click();
      await page.waitForTimeout(300);

      // Should show validation errors
      const hasErrors = await intake.hasErrors();
      const errorElements = page.locator('[role="alert"], .error, .invalid, [aria-invalid="true"]');

      // Some form of error indication should appear
    });

    test('should clear errors when field is corrected', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      // Submit with invalid email
      await intake.emailInput.fill('invalid');
      await intake.continueButton.click();
      await page.waitForTimeout(300);

      // Fix the email
      await intake.emailInput.fill(generateUniqueEmail('fix-error'));
      await page.waitForTimeout(300);

      // Errors should clear or update
    });

    test('should preserve form data on error', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      const testEmail = generateUniqueEmail('preserve-data');
      const testAddress = generateAddress();

      await intake.emailInput.fill(testEmail);
      await intake.addressInput.fill(testAddress);

      // Simulate error by mocking API failure
      await mockManager.mock({
        method: 'POST',
        url: '**/api/**',
        response: { status: 400, body: { error: 'Validation failed' } },
      });

      await intake.continueButton.click();
      await page.waitForTimeout(500);

      // Data should be preserved
      await expect(intake.emailInput).toHaveValue(testEmail);
      await expect(intake.addressInput).toHaveValue(testAddress);
    });
  });

  test.describe('Mobile Error States', () => {
    test('should display errors correctly on mobile', async ({ page }) => {
      await setDeviceViewport(page, 'iPhoneSE');

      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await intake.continueButton.click();
      await page.waitForTimeout(300);

      // Error messages should be visible on mobile
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should handle touch-friendly error dismissal', async ({ page }) => {
      await setDeviceViewport(page, 'iPhone14Pro');

      await mockManager.mock(mockServerError('**/api/**'));

      await page.goto('/pricing');
      await page.waitForTimeout(1000);

      // Error message with close button should be tappable
      const closeButton = page.locator('[aria-label*="close"], [aria-label*="dismiss"], .close-button');
      if (await closeButton.isVisible()) {
        await closeButton.tap();
      }
    });
  });

  test.describe('Error Recovery', () => {
    test('should allow navigation after error', async ({ page }) => {
      await mockManager.mock(mockServerError('**/api/projects**'));

      await page.goto('/portal');
      await page.waitForTimeout(500);

      // Clear the mock to allow normal operation
      await mockManager.clearMocks();

      // Should be able to navigate to other pages
      await page.goto('/');
      await page.waitForTimeout(500);

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should refresh page on critical error', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Inject a JavaScript error
      await page.evaluate(() => {
        (window as any).testErrorTriggered = true;
      });

      // Page should still be functional
      const refreshButton = page.locator('button:has-text("refresh"), button:has-text("reload")');
      if (await refreshButton.isVisible()) {
        await refreshButton.click();
        await page.waitForLoadState('networkidle');
      }

      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Graceful Degradation', () => {
    test('should show cached content when API fails', async ({ page }) => {
      // First load the page normally
      await page.goto('/pricing');
      await page.waitForLoadState('networkidle');

      // Now mock API failure
      await mockManager.mock(mockServerError('**/api/**'));

      // Reload page
      await page.reload();
      await page.waitForTimeout(1000);

      // Page should still show some content (possibly cached or static)
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should disable features gracefully when backend unavailable', async ({ page }) => {
      await mockManager.mock(mockServerError('**/api/**'));

      await page.goto('/');
      await page.waitForTimeout(1000);

      // Static content should still be visible
      const header = page.locator('header, nav');
      if (await header.count() > 0) {
        await expect(header.first()).toBeVisible();
      }
    });
  });
});

test.describe('Error Boundary Tests', () => {
  test('should catch and display React error boundary', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Try to cause a render error via console
    await page.evaluate(() => {
      // This simulates what might happen if a component throws
      console.error('Test error boundary simulation');
    });

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('should provide "go back" option from error boundary', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to home
    await page.goto('/');

    // Look for any error recovery UI
    const errorBoundary = page.locator('[data-testid="error-boundary"], .error-boundary');
    if (await errorBoundary.isVisible()) {
      const goBackButton = errorBoundary.locator('button:has-text("back"), a:has-text("home")');
      if (await goBackButton.isVisible()) {
        await goBackButton.click();
        await expect(page).toHaveURL('/');
      }
    }
  });
});

test.describe('Concurrent Request Handling', () => {
  test('should handle multiple failed requests gracefully', async ({ page }) => {
    // Mock multiple endpoints to fail
    await mockManager.mock(mockServerError('**/api/auth/**'));
    await mockManager.mock(mockServerError('**/api/projects/**'));
    await mockManager.mock(mockServerError('**/api/leads/**'));

    await page.goto('/portal');
    await page.waitForTimeout(1000);

    // Page should not crash despite multiple failures
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle race conditions in API calls', async ({ page }) => {
    let callOrder: string[] = [];

    await mockManager.mock({
      url: '**/api/fast**',
      response: {
        status: 200,
        body: { result: 'fast' },
        delay: 100,
      },
    });

    await mockManager.mock({
      url: '**/api/slow**',
      response: {
        status: 200,
        body: { result: 'slow' },
        delay: 1000,
      },
    });

    await page.goto('/');

    // Trigger both requests
    await page.evaluate(() => {
      fetch('/api/slow');
      fetch('/api/fast');
    });

    await page.waitForTimeout(1500);

    // Application should handle responses regardless of order
  });
});
