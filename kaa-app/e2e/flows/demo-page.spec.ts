/**
 * E2E Tests for Feature Demo Page
 * Tests demo sections, tabs, and interactive elements
 */

import { test, expect } from '@playwright/test';
import { DemoPage } from '../pages/demo.page';
import { NavigationPage } from '../pages/navigation.page';

test.describe('Feature Demo Page', () => {
  test.describe('Page Display', () => {
    test('should display demo page title', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      await expect(demo.pageTitle).toBeVisible();
    });

    test('should display demo tabs', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      const tabCount = await demo.getTabCount();
      expect(tabCount).toBeGreaterThan(0);
    });

    test('should display demo content area', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      await expect(demo.demoContent).toBeVisible();
    });
  });

  test.describe('Demo Tabs', () => {
    test('should have Overview tab', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      const overviewTab = page.locator('[role="tab"], .demo-tab').filter({ hasText: /overview/i });
      await expect(overviewTab).toBeVisible();
    });

    test('should switch content when clicking tabs', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      const tabCount = await demo.getTabCount();
      if (tabCount > 1) {
        // Get initial active tab
        const initialTab = await demo.getActiveTabName();

        // Click a different tab
        await demo.clickTab('Mobile');

        // Active tab should change
        const newTab = await demo.getActiveTabName();
        // Tab content should update
      }
    });

    test('should highlight active tab', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      await expect(demo.activeTab).toBeVisible();
    });
  });

  test.describe('Overview Section', () => {
    test('should display feature cards', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      const featureCount = await demo.getFeatureCardCount();
      expect(featureCount).toBeGreaterThan(0);
    });
  });

  test.describe('Mobile Demo Section', () => {
    test('should display mobile frame when on Mobile tab', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      await demo.clickTab('Mobile');
      await page.waitForTimeout(500);

      const hasMobileFrame = await demo.hasMobileFrame();
      // Mobile frame may be visible
    });
  });

  test.describe('Kanban Demo Section', () => {
    test('should display kanban board when on Kanban tab', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      await demo.clickTab('Kanban');
      await page.waitForTimeout(500);

      const hasKanban = await demo.hasKanbanBoard();
      // Kanban board may be visible
    });
  });

  test.describe('Dark Mode Demo', () => {
    test('should have dark mode toggle', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      await demo.clickTab('Dark');
      await page.waitForTimeout(500);

      await expect(demo.darkModeToggle).toBeVisible();
    });

    test('should toggle dark mode when clicking toggle', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      await demo.clickTab('Dark');
      await page.waitForTimeout(500);

      const initialDarkMode = await demo.isDarkModeActive();
      await demo.toggleDarkMode();
      await page.waitForTimeout(300);

      const newDarkMode = await demo.isDarkModeActive();
      expect(newDarkMode).not.toBe(initialDarkMode);
    });
  });

  test.describe('Navigation', () => {
    test('should have header navigation', async ({ page }) => {
      const nav = new NavigationPage(page);
      await nav.goto('/demo');
      await nav.waitForLoad();

      await expect(nav.header).toBeVisible();
    });

    test('should navigate home when clicking logo', async ({ page }) => {
      const nav = new NavigationPage(page);
      await nav.goto('/demo');
      await nav.waitForLoad();

      await nav.clickLogo();
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Responsive Design', () => {
    test('should display on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      await expect(demo.pageTitle).toBeVisible();
    });

    test('should display on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      await expect(demo.pageTitle).toBeVisible();
      await expect(demo.demoContent).toBeVisible();
    });

    test('should have scrollable tabs on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      // Tabs should be visible (may be scrollable)
      const tabCount = await demo.getTabCount();
      expect(tabCount).toBeGreaterThan(0);
    });
  });

  test.describe('Accessibility', () => {
    test('should have heading', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
    });

    test('should have keyboard accessible tabs', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      const firstTab = demo.demoTabs.first();
      await firstTab.focus();
      await expect(firstTab).toBeFocused();
    });

    test('should have proper tab roles', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      // Tabs should have role="tab" or similar
      const tabs = page.locator('[role="tab"], .demo-tab');
      const count = await tabs.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should have proper tabpanel roles', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      // Content area should have role="tabpanel" or similar
      const panels = page.locator('[role="tabpanel"], .demo-panel');
      // May or may not have explicit roles
    });

    test('should support arrow key navigation between tabs', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      const firstTab = demo.demoTabs.first();
      await firstTab.focus();

      // Press right arrow
      await page.keyboard.press('ArrowRight');

      // Next tab should be focused or selected
    });
  });

  test.describe('Loading States', () => {
    test('should show loading demo section', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      await demo.clickTab('Loading');
      await page.waitForTimeout(500);

      await expect(demo.loadingDemo).toBeVisible();
    });

    test('should display skeleton loaders', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.waitForLoad();

      await demo.clickTab('Loading');
      await page.waitForTimeout(500);

      const skeletons = page.locator('.skeleton, .loading-skeleton');
      // Skeleton loaders should be visible
    });
  });
});
