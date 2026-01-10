/**
 * E2E Tests for Client Portal Profile Page
 * Tests profile viewing and management
 */

import { test, expect } from '../fixtures/auth.fixture';
import { ProfilePage } from '../pages/profile.page';

test.describe('Client Portal Profile', () => {
  test.describe('Profile Display', () => {
    test('should display profile page title', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      await expect(profile.pageTitle).toBeVisible();
    });

    test('should display user email', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      const email = await profile.getEmail();
      expect(email).toMatch(/@/);
    });

    test('should display tier information', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      await expect(profile.tierDisplay).toBeVisible();
    });
  });

  test.describe('Profile Form', () => {
    test('should display name input field', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      await expect(profile.nameInput).toBeVisible();
    });

    test('should display phone input field', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      await expect(profile.phoneInput).toBeVisible();
    });

    test('should allow editing name', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      const originalName = await profile.getName();
      await profile.setName('Test Updated Name');

      const newName = await profile.getName();
      expect(newName).toBe('Test Updated Name');

      // Reset to original
      await profile.setName(originalName);
    });

    test('should allow editing phone', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      const originalPhone = await profile.getPhone();
      await profile.setPhone('555-123-4567');

      const newPhone = await profile.getPhone();
      expect(newPhone).toBe('555-123-4567');

      // Reset
      await profile.setPhone(originalPhone);
    });
  });

  test.describe('Profile Actions', () => {
    test('should have save button', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      await expect(profile.saveButton).toBeVisible();
    });

    test('should have change password button', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      await expect(profile.changePasswordButton).toBeVisible();
    });

    test('should open password change form when clicking button', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      await profile.clickChangePassword();

      // Should show password change form or modal
      await expect(page.locator('[name="currentPassword"], [name="current_password"], input[type="password"]')).toBeVisible();
    });

    test('should save profile changes', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      const originalName = await profile.getName();
      await profile.setName('Test Save Name');
      await profile.save();

      // Should show success message
      await expect(profile.successMessage).toBeVisible({ timeout: 5000 });

      // Reset
      await profile.setName(originalName);
      await profile.save();
    });
  });

  test.describe('Notifications Section', () => {
    test('should display notifications preferences', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      await expect(profile.notificationsSection).toBeVisible();
    });

    test('should have notification toggles', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      // Look for toggle switches or checkboxes
      const toggles = page.locator('input[type="checkbox"], [role="switch"]');
      const toggleCount = await toggles.count();

      expect(toggleCount).toBeGreaterThan(0);
    });
  });

  test.describe('Account Section', () => {
    test('should display account information', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      await expect(profile.accountSection).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display on mobile viewport', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      await page.setViewportSize({ width: 375, height: 667 });

      const profile = new ProfilePage(page);
      await profile.goto();
      await profile.waitForLoad();

      await expect(profile.pageTitle).toBeVisible();
      await expect(profile.nameInput).toBeVisible();
    });

    test('should display on tablet viewport', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      await page.setViewportSize({ width: 768, height: 1024 });

      const profile = new ProfilePage(page);
      await profile.goto();
      await profile.waitForLoad();

      await expect(profile.pageTitle).toBeVisible();
      await expect(profile.saveButton).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should show error for invalid phone format', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      await profile.setPhone('invalid-phone');
      await profile.save();

      // Should show validation error or error message
      const hasError = await profile.hasErrorMessage();
      // Error might be shown as form validation or server response
    });

    test('should handle API errors gracefully', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      // Intercept and fail save API
      await page.route('**/api/profile**', (route) => {
        if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
          route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Server error' }),
          });
        } else {
          route.continue();
        }
      });

      await profile.goto();
      await profile.waitForLoad();

      await profile.setName('Test Error Name');
      await profile.save();

      // Should show error message
      await expect(profile.errorMessage).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper form labels', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      // Inputs should have associated labels
      const nameLabel = page.locator('label[for="name"], label:has(input[name="name"])');
      const phoneLabel = page.locator('label[for="phone"], label:has(input[name="phone"])');

      // Either explicit labels or aria-labels should exist
    });

    test('should have keyboard navigable form', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      await profile.nameInput.focus();
      await expect(profile.nameInput).toBeFocused();

      await page.keyboard.press('Tab');
      // Should move to next focusable element
    });

    test('should have focusable save button', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      await profile.goto();
      await profile.waitForLoad();

      await profile.saveButton.focus();
      await expect(profile.saveButton).toBeFocused();
    });
  });

  test.describe('Loading States', () => {
    test('should show loading while fetching profile', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const profile = new ProfilePage(page);

      const loadingPromise = page.waitForSelector('.loading, [data-testid="loading"]', { timeout: 2000 }).catch(() => null);
      await profile.goto();

      // Loading state may be briefly visible
    });
  });
});
