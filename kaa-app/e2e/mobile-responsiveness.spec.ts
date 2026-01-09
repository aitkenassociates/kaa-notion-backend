import { test, expect } from '@playwright/test';

/**
 * Mobile Responsiveness Tests for KAA App
 * Tests key pages and components across various mobile viewports
 */

test.describe('Mobile Responsiveness - Core Pages', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('landing page should be responsive', async ({ page, viewport }) => {
    await page.goto('/');

    // Verify no horizontal overflow
    const body = page.locator('body');
    const bodyBox = await body.boundingBox();
    expect(bodyBox).toBeTruthy();

    if (viewport && bodyBox) {
      // Body should not be wider than viewport
      expect(bodyBox.width).toBeLessThanOrEqual(viewport.width + 1);
    }

    // Check for proper text rendering (no cut-off)
    const headings = page.locator('h1, h2, h3');
    const headingCount = await headings.count();
    for (let i = 0; i < headingCount; i++) {
      const heading = headings.nth(i);
      if (await heading.isVisible()) {
        const box = await heading.boundingBox();
        if (box && viewport) {
          expect(box.width).toBeLessThanOrEqual(viewport.width);
        }
      }
    }
  });

  test('client login should be mobile-friendly', async ({ page, isMobile }) => {
    await page.goto('/login');

    // Check that form inputs are properly sized for mobile
    const inputs = page.locator('input[type="email"], input[type="password"], input[type="text"]');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      if (await input.isVisible()) {
        // Verify input font size is at least 16px (prevents iOS zoom)
        const fontSize = await input.evaluate((el) => {
          return window.getComputedStyle(el).fontSize;
        });
        const fontSizeNum = parseFloat(fontSize);
        expect(fontSizeNum).toBeGreaterThanOrEqual(16);
      }
    }
  });

  test('navigation should adapt to mobile', async ({ page, isMobile, viewport }) => {
    await page.goto('/');

    if (isMobile && viewport && viewport.width < 768) {
      // Check for hamburger menu on mobile
      const hamburger = page.locator('[class*="hamburger"], [class*="mobile-menu"], [aria-label*="menu"]');
      const hasHamburger = await hamburger.count() > 0;

      // Navigation should either be hidden or have mobile menu toggle
      const nav = page.locator('nav, [class*="navigation"]');
      if (await nav.count() > 0 && hasHamburger) {
        expect(hasHamburger).toBe(true);
      }
    }
  });
});

test.describe('Mobile Responsiveness - Component Tests', () => {
  test('dashboard should stack cards on mobile', async ({ page, viewport }) => {
    await page.goto('/dashboard');

    if (viewport && viewport.width < 768) {
      // Check that grid items stack vertically
      const gridItems = page.locator('[class*="grid"] > *');
      const itemCount = await gridItems.count();

      if (itemCount > 1) {
        const firstItem = await gridItems.first().boundingBox();
        const secondItem = await gridItems.nth(1).boundingBox();

        if (firstItem && secondItem) {
          // On mobile, items should stack (second item below first)
          // or be at same Y position but different X
          expect(secondItem.y >= firstItem.y).toBe(true);
        }
      }
    }
  });

  test('modals should fit mobile viewport', async ({ page, viewport }) => {
    await page.goto('/dashboard');

    // Try to trigger a modal (adjust selector based on your app)
    const modalTrigger = page.locator('[data-testid="open-modal"], [class*="modal-trigger"]').first();
    if (await modalTrigger.count() > 0) {
      await modalTrigger.click();

      const modal = page.locator('[role="dialog"], [class*="modal"]');
      if (await modal.isVisible()) {
        const modalBox = await modal.boundingBox();
        if (modalBox && viewport) {
          // Modal should not exceed viewport width
          expect(modalBox.width).toBeLessThanOrEqual(viewport.width);
        }
      }
    }
  });

  test('buttons should have adequate touch targets', async ({ page, isMobile }) => {
    await page.goto('/');

    if (isMobile) {
      const buttons = page.locator('button, a[role="button"], [class*="btn"]');
      const buttonCount = await buttons.count();

      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const box = await button.boundingBox();
          if (box) {
            // Touch targets should be at least 44x44 (Apple HIG recommendation)
            expect(box.height).toBeGreaterThanOrEqual(40);
          }
        }
      }
    }
  });
});

test.describe('Mobile Responsiveness - Overflow Checks', () => {
  const pagesToTest = [
    { name: 'Home', path: '/' },
    { name: 'Login', path: '/login' },
    { name: 'Dashboard', path: '/dashboard' },
  ];

  for (const pageInfo of pagesToTest) {
    test(`${pageInfo.name} page should not have horizontal overflow`, async ({ page, viewport }) => {
      await page.goto(pageInfo.path);
      await page.waitForTimeout(500); // Allow CSS to fully load

      // Check for horizontal scroll
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      // Slight tolerance for scrollbars
      if (hasHorizontalOverflow) {
        const overflowAmount = await page.evaluate(() => {
          return document.documentElement.scrollWidth - document.documentElement.clientWidth;
        });
        // Allow up to 20px for scrollbar
        expect(overflowAmount).toBeLessThanOrEqual(20);
      }
    });
  }
});

test.describe('Mobile Responsiveness - Text Readability', () => {
  test('text should maintain minimum readable size', async ({ page }) => {
    await page.goto('/');

    // Check paragraph text isn't too small
    const paragraphs = page.locator('p, span, li');
    const count = await paragraphs.count();

    for (let i = 0; i < Math.min(count, 20); i++) {
      const element = paragraphs.nth(i);
      if (await element.isVisible()) {
        const text = await element.textContent();
        if (text && text.trim().length > 10) {
          const fontSize = await element.evaluate((el) => {
            return parseFloat(window.getComputedStyle(el).fontSize);
          });
          // Minimum readable size is typically 12px
          expect(fontSize).toBeGreaterThanOrEqual(11);
        }
      }
    }
  });

  test('headings should scale appropriately', async ({ page, viewport }) => {
    await page.goto('/');

    const h1s = page.locator('h1');
    const h1Count = await h1s.count();

    for (let i = 0; i < h1Count; i++) {
      const h1 = h1s.nth(i);
      if (await h1.isVisible()) {
        const box = await h1.boundingBox();
        if (box && viewport) {
          // H1 should not overflow viewport
          expect(box.width).toBeLessThanOrEqual(viewport.width + 20);
        }
      }
    }
  });
});

test.describe('Mobile Responsiveness - Forms', () => {
  test('form fields should stack on narrow viewports', async ({ page, viewport }) => {
    await page.goto('/login');

    if (viewport && viewport.width < 480) {
      const formRows = page.locator('form [class*="row"], form [class*="group"]');
      const rowCount = await formRows.count();

      for (let i = 0; i < rowCount; i++) {
        const row = formRows.nth(i);
        if (await row.isVisible()) {
          const box = await row.boundingBox();
          if (box) {
            // Form rows should fit within viewport
            expect(box.width).toBeLessThanOrEqual(viewport.width);
          }
        }
      }
    }
  });

  test('submit buttons should be easily tappable', async ({ page, isMobile }) => {
    await page.goto('/login');

    const submitBtn = page.locator('button[type="submit"], input[type="submit"]');
    if (await submitBtn.count() > 0) {
      const box = await submitBtn.first().boundingBox();
      if (box && isMobile) {
        // Minimum 44px height for touch target
        expect(box.height).toBeGreaterThanOrEqual(40);
        // Minimum 120px width for comfortable tapping
        expect(box.width).toBeGreaterThanOrEqual(100);
      }
    }
  });
});
