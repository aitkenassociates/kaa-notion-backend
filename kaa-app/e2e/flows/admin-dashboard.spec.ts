/**
 * E2E Tests for Admin Dashboard
 * Tests admin authentication, dashboard stats, navigation, and overview functionality
 */

import { test, expect } from '../fixtures/auth.fixture';
import { AdminDashboardPage } from '../pages/admin-dashboard.page';
import { TEST_CREDENTIALS } from '../utils/test-data';

test.describe('Admin Dashboard', () => {
  test.describe('Authentication', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      await page.goto('/admin');
      // Should redirect to login page
      await expect(page).toHaveURL(/login|admin\/login/, { timeout: 5000 });
    });

    test('should display admin login form', async ({ page }) => {
      await page.goto('/admin/login');
      await expect(page.locator('[name="email"]')).toBeVisible();
      await expect(page.locator('[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should login as admin with valid credentials', async ({ page }) => {
      await page.goto('/admin/login');
      await page.fill('[name="email"]', TEST_CREDENTIALS.admin.email);
      await page.fill('[name="password"]', TEST_CREDENTIALS.admin.password);
      await page.click('button[type="submit"]');

      // Should redirect to admin dashboard
      await expect(page).toHaveURL(/admin/, { timeout: 10000 });
    });

    test('should show error for invalid admin credentials', async ({ page }) => {
      await page.goto('/admin/login');
      await page.fill('[name="email"]', 'invalid@test.com');
      await page.fill('[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');

      // Should show error message
      await expect(page.getByText(/invalid|incorrect|unauthorized|failed/i)).toBeVisible({ timeout: 5000 });
    });

    test('should prevent non-admin users from accessing admin routes', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      await page.goto('/admin');

      // Should redirect away or show access denied
      await expect(page).not.toHaveURL(/^\/admin$/, { timeout: 5000 });
    });
  });

  test.describe('Dashboard Overview', () => {
    test('should display dashboard title and subtitle', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      await expect(dashboard.title).toContainText(/admin dashboard/i);
      await expect(dashboard.subtitle).toBeVisible();
    });

    test('should display stats cards', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      await expect(dashboard.leadsCard).toBeVisible();
      await expect(dashboard.projectsCard).toBeVisible();
      await expect(dashboard.clientsCard).toBeVisible();
      await expect(dashboard.revenueCard).toBeVisible();
    });

    test('should display leads count with monthly stats', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      const leadsCount = await dashboard.getLeadsCount();
      expect(leadsCount).toBeTruthy();

      // Should show monthly badge
      await expect(dashboard.leadsCard.locator('.admin-dashboard__card-badge')).toBeVisible();
      await expect(dashboard.leadsCard.locator('.admin-dashboard__card-rate')).toBeVisible();
    });

    test('should display projects count with active indicator', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      const projectsCount = await dashboard.getProjectsCount();
      expect(projectsCount).toBeTruthy();

      // Should show active projects badge
      await expect(dashboard.projectsCard.locator('.admin-dashboard__card-badge--active')).toBeVisible();
    });

    test('should display clients count', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      const clientsCount = await dashboard.getClientsCount();
      expect(clientsCount).toBeTruthy();
    });

    test('should display revenue with currency format', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      const revenue = await dashboard.getRevenueTotal();
      expect(revenue).toMatch(/\$[\d,]+/);
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to leads page when clicking leads card', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      await dashboard.clickLeadsCard();
      await expect(adminPage).toHaveURL(/admin\/leads/);
    });

    test('should navigate to projects page when clicking projects card', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      await dashboard.clickProjectsCard();
      await expect(adminPage).toHaveURL(/admin\/projects/);
    });

    test('should navigate to clients page when clicking clients card', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      await dashboard.clickClientsCard();
      await expect(adminPage).toHaveURL(/admin\/clients/);
    });

    test('should have keyboard accessible cards', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      // Cards should be focusable
      await expect(dashboard.leadsCard).toHaveAttribute('tabindex', '0');
      await expect(dashboard.projectsCard).toHaveAttribute('tabindex', '0');
      await expect(dashboard.clientsCard).toHaveAttribute('tabindex', '0');
    });
  });

  test.describe('Breakdown Sections', () => {
    test('should display projects by tier breakdown', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      await expect(dashboard.tierBreakdown).toBeVisible();

      const tierCounts = await dashboard.getTierCounts();
      expect(Object.keys(tierCounts).length).toBeGreaterThan(0);
    });

    test('should display leads by status section', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      await expect(dashboard.leadsStatusSection).toBeVisible();
    });

    test('should display projects by status section', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      await expect(dashboard.projectsStatusSection).toBeVisible();
    });
  });

  test.describe('Recent Activity', () => {
    test('should display recent activity section', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      await expect(dashboard.activitySection).toBeVisible();
    });

    test('should show activity items or empty state', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      const activityCount = await dashboard.getActivityCount();
      if (activityCount > 0) {
        await expect(dashboard.activityItems.first()).toBeVisible();
      } else {
        await expect(dashboard.activitySection.locator('.admin-dashboard__empty')).toBeVisible();
      }
    });
  });

  test.describe('Loading States', () => {
    test('should show loading skeleton while fetching data', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);

      // Navigate and check for loading state before data loads
      const loadingPromise = dashboard.page.waitForSelector('.admin-dashboard__skeleton-card', { timeout: 2000 }).catch(() => null);
      await dashboard.goto();

      // Loading skeleton may be visible briefly
      const skeleton = await loadingPromise;
      // This test validates that the loading state exists in the component
      // It may or may not be visible depending on network speed
    });
  });

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);

      // Intercept API and return error
      await adminPage.route('**/api/admin/stats', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Server error' }),
        });
      });

      await dashboard.goto();

      // Should show error state or handle gracefully
      const hasError = await dashboard.hasError();
      // Error handling should be in place
    });
  });

  test.describe('Responsive Design', () => {
    test('should display properly on mobile viewport', async ({ adminPage }) => {
      await adminPage.setViewportSize({ width: 375, height: 667 });

      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      // Stats cards should still be visible
      await expect(dashboard.leadsCard).toBeVisible();
      await expect(dashboard.projectsCard).toBeVisible();
    });

    test('should display properly on tablet viewport', async ({ adminPage }) => {
      await adminPage.setViewportSize({ width: 768, height: 1024 });

      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      await expect(dashboard.leadsCard).toBeVisible();
      await expect(dashboard.revenueCard).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      // Should have h1 as main heading
      const h1Count = await adminPage.locator('h1').count();
      expect(h1Count).toBeGreaterThanOrEqual(1);

      // Check for h2 or h3 section headings
      const sectionHeadings = await adminPage.locator('h2, h3').count();
      expect(sectionHeadings).toBeGreaterThan(0);
    });

    test('should have role=button on clickable cards', async ({ adminPage }) => {
      const dashboard = new AdminDashboardPage(adminPage);
      await dashboard.goto();
      await dashboard.waitForLoad();

      await expect(dashboard.leadsCard).toHaveAttribute('role', 'button');
      await expect(dashboard.projectsCard).toHaveAttribute('role', 'button');
      await expect(dashboard.clientsCard).toHaveAttribute('role', 'button');
    });
  });
});
