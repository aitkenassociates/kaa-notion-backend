import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Mobile Components
 * Captures screenshots at different breakpoints to verify responsive behavior
 */

test.describe('Visual Mobile - Screenshot Comparisons', () => {
  test('landing page visual consistency across viewports', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take screenshot for visual comparison
    await expect(page).toHaveScreenshot('landing-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });

  test('login page layout', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('login-page.png', {
      maxDiffPixelRatio: 0.1,
    });
  });
});

test.describe('Visual Mobile - Component Screenshots', () => {
  test('dashboard cards layout', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(1000); // Wait for animations

    const dashboardSection = page.locator('[class*="dashboard"], main').first();
    if (await dashboardSection.isVisible()) {
      await expect(dashboardSection).toHaveScreenshot('dashboard-section.png', {
        maxDiffPixelRatio: 0.15,
      });
    }
  });

  test('navigation state on mobile', async ({ page, viewport }) => {
    await page.goto('/');

    if (viewport && viewport.width < 768) {
      // Capture mobile nav closed state
      await expect(page.locator('header, nav').first()).toHaveScreenshot('mobile-nav-closed.png', {
        maxDiffPixelRatio: 0.1,
      });

      // Try to open mobile nav
      const menuToggle = page.locator('[class*="hamburger"], [aria-label*="menu"], [class*="mobile-toggle"]').first();
      if (await menuToggle.count() > 0) {
        await menuToggle.click();
        await page.waitForTimeout(300); // Animation time

        await expect(page.locator('header, nav').first()).toHaveScreenshot('mobile-nav-open.png', {
          maxDiffPixelRatio: 0.15,
        });
      }
    }
  });
});

test.describe('Visual Mobile - Breakpoint Transitions', () => {
  const breakpoints = [
    { name: '320px', width: 320, height: 568 },
    { name: '375px', width: 375, height: 667 },
    { name: '480px', width: 480, height: 896 },
    { name: '768px', width: 768, height: 1024 },
    { name: '1024px', width: 1024, height: 768 },
  ];

  for (const bp of breakpoints) {
    test(`layout at ${bp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot(`breakpoint-${bp.name}.png`, {
        fullPage: false,
        maxDiffPixelRatio: 0.1,
      });
    });
  }
});

test.describe('Visual Mobile - Dark Mode', () => {
  test('landing page dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('landing-dark-mode.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('login page dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('login-dark-mode.png', {
      maxDiffPixelRatio: 0.1,
    });
  });
});

test.describe('Visual Mobile - Interactive States', () => {
  test('button hover/focus states', async ({ page }) => {
    await page.goto('/');

    const button = page.locator('button, a[class*="btn"]').first();
    if (await button.isVisible()) {
      // Focus state
      await button.focus();
      await expect(button).toHaveScreenshot('button-focus.png', {
        maxDiffPixelRatio: 0.2,
      });

      // Hover state (desktop only)
      await button.hover();
      await expect(button).toHaveScreenshot('button-hover.png', {
        maxDiffPixelRatio: 0.2,
      });
    }
  });

  test('form input states', async ({ page }) => {
    await page.goto('/login');

    const input = page.locator('input').first();
    if (await input.isVisible()) {
      // Default state
      await expect(input).toHaveScreenshot('input-default.png', {
        maxDiffPixelRatio: 0.2,
      });

      // Focus state
      await input.focus();
      await expect(input).toHaveScreenshot('input-focus.png', {
        maxDiffPixelRatio: 0.2,
      });

      // With value
      await input.fill('test@example.com');
      await expect(input).toHaveScreenshot('input-filled.png', {
        maxDiffPixelRatio: 0.2,
      });
    }
  });
});

test.describe('Visual Mobile - Component Isolation', () => {
  test('footer component', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer').first();
    if (await footer.isVisible()) {
      await footer.scrollIntoViewIfNeeded();
      await expect(footer).toHaveScreenshot('footer-component.png', {
        maxDiffPixelRatio: 0.1,
      });
    }
  });

  test('header component', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('header').first();
    if (await header.isVisible()) {
      await expect(header).toHaveScreenshot('header-component.png', {
        maxDiffPixelRatio: 0.1,
      });
    }
  });
});
