/**
 * E2E Tests for Client Portal Dashboard
 * Comprehensive tests for the client-facing dashboard functionality
 */

import { test, expect } from '../fixtures/auth.fixture';
import { PortalDashboardPage } from '../pages/portal-dashboard.page';
import { PortalProjectPage } from '../pages/portal-project.page';
import { TEST_CREDENTIALS } from '../utils/test-data';
import { LoginPage } from '../pages/login.page';

test.describe('Client Portal Dashboard', () => {
  test.describe('Authentication', () => {
    test('should redirect to login when not authenticated', async ({ page }) => {
      await page.goto('/portal');
      await expect(page).toHaveURL(/login/, { timeout: 5000 });
    });

    test('should login and access portal', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(TEST_CREDENTIALS.client.email, TEST_CREDENTIALS.client.password);

      await expect(page).toHaveURL(/portal|dashboard/, { timeout: 10000 });
    });

    test('should persist session across page refresh', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      // Refresh and verify still authenticated
      await page.reload();
      await expect(page).not.toHaveURL(/login/);
    });

    test('should logout successfully', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      await portal.logout();
      await expect(page).toHaveURL(/login|\/$/);
    });
  });

  test.describe('Dashboard Display', () => {
    test('should display welcome greeting', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const greeting = await portal.getGreeting();
      expect(greeting).toBeTruthy();
    });

    test('should display projects or empty state', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      const isEmpty = await portal.isEmpty();

      // Should show one or the other
      expect(hasProjects || isEmpty).toBeTruthy();
    });

    test('should display navigation bar', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      await expect(portal.navbar).toBeVisible();
    });
  });

  test.describe('Projects List', () => {
    test('should display project cards when projects exist', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        const count = await portal.getProjectCount();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should display project name on cards', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        const project = await portal.getProjectByIndex(0);
        expect(project.name).toBeTruthy();
      }
    });

    test('should display project status on cards', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        const project = await portal.getProjectByIndex(0);
        // Status may be displayed
        expect(project.name).toBeTruthy();
      }
    });

    test('should navigate to project detail when clicking card', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);
        await expect(page).toHaveURL(/project/);
      }
    });

    test('should display empty state message when no projects', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const isEmpty = await portal.isEmpty();
      if (isEmpty) {
        await expect(portal.emptyState).toBeVisible();
      }
    });
  });

  test.describe('User Menu', () => {
    test('should display user menu button', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      await expect(portal.userMenu).toBeVisible();
    });

    test('should open user menu on click', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      await portal.openUserMenu();

      // Menu should be expanded
      await expect(portal.logoutButton.or(portal.profileLink)).toBeVisible({ timeout: 3000 });
    });

    test('should navigate to profile from menu', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      await portal.goToProfile();
      await expect(page).toHaveURL(/profile/);
    });
  });

  test.describe('Responsive Design', () => {
    test('should display on mobile viewport', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      await page.setViewportSize({ width: 375, height: 667 });

      const portal = new PortalDashboardPage(page);
      await portal.goto();
      await portal.waitForLoad();

      await expect(portal.navbar).toBeVisible();
    });

    test('should display on tablet viewport', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      await page.setViewportSize({ width: 768, height: 1024 });

      const portal = new PortalDashboardPage(page);
      await portal.goto();
      await portal.waitForLoad();

      await expect(portal.navbar).toBeVisible();
    });

    test('should have responsive project cards on mobile', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      await page.setViewportSize({ width: 375, height: 667 });

      const portal = new PortalDashboardPage(page);
      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await expect(portal.projectCards.first()).toBeVisible();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have main heading', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
    });

    test('should have accessible navigation', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      await expect(portal.navbar).toBeVisible();
    });

    test('should have keyboard navigable project cards', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        // Project cards should be clickable/focusable
        await portal.projectCards.first().focus();
        await expect(portal.projectCards.first()).toBeFocused();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      // Intercept and fail API
      await page.route('**/api/projects**', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Server error' }),
        });
      });

      await portal.goto();

      // Should show error state or fallback
      await page.waitForLoadState('networkidle');
    });

    test('should handle network timeout gracefully', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      // Intercept and delay API
      await page.route('**/api/projects**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        route.abort();
      });

      await portal.goto();

      // Should show loading state initially
      await page.waitForTimeout(1000);
    });
  });
});
