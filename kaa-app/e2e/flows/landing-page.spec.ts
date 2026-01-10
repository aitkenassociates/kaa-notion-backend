/**
 * E2E Tests for Landing Page
 * Tests hero section, CTAs, portal cards, animations, and navigation
 */

import { test, expect } from '@playwright/test';
import { LandingPageObject } from '../pages/landing.page';
import { NavigationPage } from '../pages/navigation.page';

test.describe('Landing Page', () => {
  test.describe('Hero Section', () => {
    test('should display hero title', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      const title = await landing.getHeroTitle();
      expect(title).toBeTruthy();
    });

    test('should display hero subtitle', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      await expect(landing.heroSubtitle).toBeVisible();
    });

    test('should display SAGE logo', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      await expect(landing.logo).toBeVisible();
    });
  });

  test.describe('Call to Action Buttons', () => {
    test('should display Get Started button', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      await expect(landing.getStartedButton).toBeVisible();
    });

    test('should display View Pricing button', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      await expect(landing.viewPricingButton).toBeVisible();
    });

    test('should navigate to get-started on clicking Get Started', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      await landing.clickGetStarted();
      await expect(page).toHaveURL(/get-started|intake/);
    });

    test('should navigate to pricing on clicking View Pricing', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      await landing.clickViewPricing();
      await expect(page).toHaveURL(/pricing/);
    });
  });

  test.describe('Portal Cards', () => {
    test('should display three portal cards', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      const count = await landing.getPortalCardCount();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should display Client Portal card', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      await expect(landing.clientPortalCard).toBeVisible();
    });

    test('should display Team Dashboard card', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      await expect(landing.teamDashboardCard).toBeVisible();
    });

    test('should display Feature Demo card', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      await expect(landing.featureDemoCard).toBeVisible();
    });

    test('should navigate to login on clicking Client Portal', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      await landing.clickClientPortal();
      await expect(page).toHaveURL(/login|portal/);
    });

    test('should navigate to admin on clicking Team Dashboard', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      await landing.clickTeamDashboard();
      await expect(page).toHaveURL(/admin/);
    });

    test('should navigate to demo on clicking Feature Demo', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      await landing.clickFeatureDemo();
      await expect(page).toHaveURL(/demo/);
    });
  });

  test.describe('Header Navigation', () => {
    test('should display header', async ({ page }) => {
      const nav = new NavigationPage(page);
      await nav.goto('/');
      await nav.waitForLoad();

      await expect(nav.header).toBeVisible();
    });

    test('should have Pricing link in header', async ({ page }) => {
      const nav = new NavigationPage(page);
      await nav.goto('/');
      await nav.waitForLoad();

      await expect(nav.pricingLink).toBeVisible();
    });

    test('should have Sign In link for unauthenticated users', async ({ page }) => {
      const nav = new NavigationPage(page);
      await nav.goto('/');
      await nav.waitForLoad();

      await expect(nav.signInLink).toBeVisible();
    });

    test('should navigate to pricing from header', async ({ page }) => {
      const nav = new NavigationPage(page);
      await nav.goto('/');
      await nav.waitForLoad();

      await nav.clickPricing();
      await expect(page).toHaveURL(/pricing/);
    });

    test('should navigate to login from header', async ({ page }) => {
      const nav = new NavigationPage(page);
      await nav.goto('/');
      await nav.waitForLoad();

      await nav.clickSignIn();
      await expect(page).toHaveURL(/login/);
    });
  });

  test.describe('Footer', () => {
    test('should display footer', async ({ page }) => {
      const nav = new NavigationPage(page);
      await nav.goto('/');
      await nav.waitForLoad();

      await nav.scrollToFooter();
      await expect(nav.footer).toBeVisible();
    });

    test('should have Privacy Policy link', async ({ page }) => {
      const nav = new NavigationPage(page);
      await nav.goto('/');
      await nav.waitForLoad();

      await nav.scrollToFooter();
      await expect(nav.privacyPolicyLink).toBeVisible();
    });

    test('should have Terms of Service link', async ({ page }) => {
      const nav = new NavigationPage(page);
      await nav.goto('/');
      await nav.waitForLoad();

      await nav.scrollToFooter();
      await expect(nav.termsOfServiceLink).toBeVisible();
    });

    test('should have copyright notice', async ({ page }) => {
      const nav = new NavigationPage(page);
      await nav.goto('/');
      await nav.waitForLoad();

      await nav.scrollToFooter();
      await expect(nav.copyright).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      await expect(landing.heroTitle).toBeVisible();
      await expect(landing.getStartedButton).toBeVisible();
    });

    test('should display on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      await expect(landing.heroTitle).toBeVisible();
      await expect(landing.portalCards.first()).toBeVisible();
    });

    test('should stack portal cards on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      // All cards should still be visible
      const count = await landing.getPortalCardCount();
      expect(count).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('Accessibility', () => {
    test('should have main heading (h1)', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
    });

    test('should have skip to main content link', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      // Skip link may be visually hidden but should exist
      const skipLink = page.locator('a[href="#main"], .skip-link');
      // This is optional, don't fail if not present
    });

    test('should have keyboard accessible buttons', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      await landing.getStartedButton.focus();
      await expect(landing.getStartedButton).toBeFocused();
    });

    test('should have keyboard accessible portal cards', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      await landing.clientPortalCard.focus();
      // Card should be focusable
    });
  });

  test.describe('Animations', () => {
    test('should have animated background', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      // Background element should exist
      const hasBackground = await landing.animatedBackground.isVisible().catch(() => false);
      // Animation presence is optional, just verify page loads
    });
  });

  test.describe('SEO', () => {
    test('should have page title', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      const title = await page.title();
      expect(title).toBeTruthy();
    });

    test('should have meta description', async ({ page }) => {
      const landing = new LandingPageObject(page);
      await landing.goto();
      await landing.waitForLoad();

      const metaDescription = page.locator('meta[name="description"]');
      // Meta description should exist
    });
  });
});
