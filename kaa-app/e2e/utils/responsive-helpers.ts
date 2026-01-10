/**
 * Responsive and Mobile Testing Utilities
 * Provides viewport management, touch gestures, and device emulation
 */

import { Page, Locator, BrowserContext } from '@playwright/test';

// =============================================================================
// Device Presets
// =============================================================================

export const DEVICE_PRESETS = {
  // Mobile devices
  iPhoneSE: { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  iPhone12: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  iPhone14Pro: { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  iPhone14ProMax: { width: 430, height: 932, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  Pixel5: { width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true },
  Pixel7: { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
  GalaxyS20: { width: 360, height: 800, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  GalaxyS22: { width: 360, height: 780, deviceScaleFactor: 3, isMobile: true, hasTouch: true },

  // Tablets
  iPadMini: { width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  iPadAir: { width: 820, height: 1180, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  iPadPro11: { width: 834, height: 1194, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  iPadPro12: { width: 1024, height: 1366, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  SurfacePro7: { width: 912, height: 1368, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  GalaxyTab: { width: 800, height: 1280, deviceScaleFactor: 2, isMobile: true, hasTouch: true },

  // Desktop
  laptop: { width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  laptopHiDPI: { width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
  desktop: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  desktop4K: { width: 3840, height: 2160, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
} as const;

export type DevicePreset = keyof typeof DEVICE_PRESETS;

// =============================================================================
// Viewport Breakpoints
// =============================================================================

export const BREAKPOINTS = {
  xs: 320,   // Extra small phones
  sm: 375,   // Small phones (iPhone SE)
  md: 768,   // Tablets
  lg: 1024,  // Large tablets / small laptops
  xl: 1280,  // Laptops
  xxl: 1536, // Large desktops
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

// =============================================================================
// Viewport Management
// =============================================================================

/**
 * Set viewport to a specific device preset
 */
export async function setDeviceViewport(
  page: Page,
  device: DevicePreset
): Promise<void> {
  const preset = DEVICE_PRESETS[device];
  await page.setViewportSize({ width: preset.width, height: preset.height });
}

/**
 * Set viewport to a specific breakpoint
 */
export async function setBreakpointViewport(
  page: Page,
  breakpoint: Breakpoint,
  height: number = 800
): Promise<void> {
  await page.setViewportSize({ width: BREAKPOINTS[breakpoint], height });
}

/**
 * Set custom viewport size
 */
export async function setViewport(
  page: Page,
  width: number,
  height: number
): Promise<void> {
  await page.setViewportSize({ width, height });
}

/**
 * Get current viewport size
 */
export async function getViewport(page: Page): Promise<{ width: number; height: number }> {
  return page.viewportSize() ?? { width: 1280, height: 720 };
}

/**
 * Check if current viewport is mobile size
 */
export async function isMobileViewport(page: Page): Promise<boolean> {
  const viewport = await getViewport(page);
  return viewport.width < BREAKPOINTS.md;
}

/**
 * Check if current viewport is tablet size
 */
export async function isTabletViewport(page: Page): Promise<boolean> {
  const viewport = await getViewport(page);
  return viewport.width >= BREAKPOINTS.md && viewport.width < BREAKPOINTS.lg;
}

/**
 * Check if current viewport is desktop size
 */
export async function isDesktopViewport(page: Page): Promise<boolean> {
  const viewport = await getViewport(page);
  return viewport.width >= BREAKPOINTS.lg;
}

// =============================================================================
// Orientation Management
// =============================================================================

export type Orientation = 'portrait' | 'landscape';

/**
 * Set device orientation (swap width and height)
 */
export async function setOrientation(
  page: Page,
  orientation: Orientation
): Promise<void> {
  const viewport = await getViewport(page);
  const isCurrentlyPortrait = viewport.height > viewport.width;

  if (orientation === 'portrait' && !isCurrentlyPortrait) {
    await page.setViewportSize({ width: viewport.height, height: viewport.width });
  } else if (orientation === 'landscape' && isCurrentlyPortrait) {
    await page.setViewportSize({ width: viewport.height, height: viewport.width });
  }
}

/**
 * Toggle orientation
 */
export async function toggleOrientation(page: Page): Promise<void> {
  const viewport = await getViewport(page);
  await page.setViewportSize({ width: viewport.height, height: viewport.width });
}

// =============================================================================
// Touch Gesture Utilities
// =============================================================================

/**
 * Simulate tap gesture (touch equivalent of click)
 */
export async function tap(
  page: Page,
  locator: Locator,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 10000 } = options;

  await locator.waitFor({ state: 'visible', timeout });
  await locator.tap();
}

/**
 * Simulate double tap gesture
 */
export async function doubleTap(
  page: Page,
  locator: Locator
): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Element not found');

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(100);
  await page.touchscreen.tap(x, y);
}

/**
 * Simulate swipe gesture
 */
export async function swipe(
  page: Page,
  options: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    duration?: number;
  }
): Promise<void> {
  const { startX, startY, endX, endY, duration = 300 } = options;
  const steps = Math.ceil(duration / 16); // ~60fps

  // Start touch
  await page.touchscreen.tap(startX, startY);

  // Move through intermediate points
  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    const currentX = startX + (endX - startX) * progress;
    const currentY = startY + (endY - startY) * progress;
    await page.mouse.move(currentX, currentY);
    await page.waitForTimeout(16);
  }
}

/**
 * Swipe left on an element
 */
export async function swipeLeft(
  page: Page,
  locator: Locator,
  distance: number = 200
): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Element not found');

  const startX = box.x + box.width - 10;
  const startY = box.y + box.height / 2;

  await swipe(page, {
    startX,
    startY,
    endX: startX - distance,
    endY: startY,
  });
}

/**
 * Swipe right on an element
 */
export async function swipeRight(
  page: Page,
  locator: Locator,
  distance: number = 200
): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Element not found');

  const startX = box.x + 10;
  const startY = box.y + box.height / 2;

  await swipe(page, {
    startX,
    startY,
    endX: startX + distance,
    endY: startY,
  });
}

/**
 * Swipe up on an element
 */
export async function swipeUp(
  page: Page,
  locator: Locator,
  distance: number = 200
): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Element not found');

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height - 10;

  await swipe(page, {
    startX,
    startY,
    endX: startX,
    endY: startY - distance,
  });
}

/**
 * Swipe down on an element
 */
export async function swipeDown(
  page: Page,
  locator: Locator,
  distance: number = 200
): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Element not found');

  const startX = box.x + box.width / 2;
  const startY = box.y + 10;

  await swipe(page, {
    startX,
    startY,
    endX: startX,
    endY: startY + distance,
  });
}

/**
 * Pull to refresh gesture
 */
export async function pullToRefresh(
  page: Page,
  options: { distance?: number } = {}
): Promise<void> {
  const { distance = 300 } = options;
  const viewport = await getViewport(page);

  await swipe(page, {
    startX: viewport.width / 2,
    startY: 100,
    endX: viewport.width / 2,
    endY: 100 + distance,
    duration: 500,
  });
}

/**
 * Simulate pinch zoom gesture
 */
export async function pinchZoom(
  page: Page,
  locator: Locator,
  scale: number = 2 // > 1 to zoom in, < 1 to zoom out
): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Element not found');

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  // Simulate pinch by using keyboard zoom (works in some browsers)
  if (scale > 1) {
    await page.keyboard.down('Control');
    await page.keyboard.press('Equal'); // Zoom in
    await page.keyboard.up('Control');
  } else {
    await page.keyboard.down('Control');
    await page.keyboard.press('Minus'); // Zoom out
    await page.keyboard.up('Control');
  }
}

/**
 * Long press gesture
 */
export async function longPress(
  page: Page,
  locator: Locator,
  duration: number = 500
): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Element not found');

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(duration);
  await page.mouse.up();
}

// =============================================================================
// Mobile UI Patterns
// =============================================================================

/**
 * Scroll to element on mobile (with momentum scrolling consideration)
 */
export async function scrollToElementMobile(
  page: Page,
  locator: Locator,
  options: { behavior?: 'smooth' | 'instant' } = {}
): Promise<void> {
  const { behavior = 'smooth' } = options;

  await locator.scrollIntoViewIfNeeded();

  // Additional scroll to account for fixed headers
  await page.evaluate(
    ({ sel, beh }) => {
      const element = document.querySelector(sel);
      if (element) {
        element.scrollIntoView({ behavior: beh, block: 'center' });
      }
    },
    { sel: await getElementSelector(locator), beh: behavior }
  );
}

/**
 * Open mobile menu/hamburger menu
 */
export async function openMobileMenu(
  page: Page,
  menuButtonSelector: string = '[data-testid="mobile-menu"], .hamburger-menu, [aria-label*="menu"]'
): Promise<void> {
  const menuButton = page.locator(menuButtonSelector).first();
  await menuButton.waitFor({ state: 'visible' });
  await tap(page, menuButton);
  await page.waitForTimeout(300); // Wait for animation
}

/**
 * Close mobile menu
 */
export async function closeMobileMenu(
  page: Page,
  closeButtonSelector: string = '[data-testid="close-menu"], .close-menu, [aria-label*="close"]'
): Promise<void> {
  const closeButton = page.locator(closeButtonSelector).first();
  if (await closeButton.isVisible()) {
    await tap(page, closeButton);
    await page.waitForTimeout(300);
  }
}

/**
 * Check if mobile navigation is visible
 */
export async function isMobileNavVisible(
  page: Page,
  navSelector: string = '[data-testid="mobile-nav"], .mobile-nav'
): Promise<boolean> {
  const nav = page.locator(navSelector).first();
  return nav.isVisible();
}

/**
 * Dismiss mobile keyboard (if present)
 */
export async function dismissKeyboard(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
}

/**
 * Check if element is visible in mobile viewport (not behind keyboard)
 */
export async function isVisibleInMobileViewport(
  page: Page,
  locator: Locator
): Promise<boolean> {
  const viewport = await getViewport(page);
  const box = await locator.boundingBox();

  if (!box) return false;

  return (
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= viewport.width &&
    box.y + box.height <= viewport.height
  );
}

// =============================================================================
// Responsive Layout Testing
// =============================================================================

/**
 * Test element visibility across breakpoints
 */
export async function testVisibilityAcrossBreakpoints(
  page: Page,
  locator: Locator
): Promise<Record<Breakpoint, boolean>> {
  const results: Record<string, boolean> = {};

  for (const [breakpoint, width] of Object.entries(BREAKPOINTS)) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(100); // Wait for responsive changes

    results[breakpoint] = await locator.isVisible();
  }

  return results as Record<Breakpoint, boolean>;
}

/**
 * Test layout across common device sizes
 */
export async function testLayoutAcrossDevices(
  page: Page,
  callback: (device: DevicePreset) => Promise<void>
): Promise<void> {
  const testDevices: DevicePreset[] = [
    'iPhoneSE',
    'iPhone14Pro',
    'iPadAir',
    'laptop',
    'desktop',
  ];

  for (const device of testDevices) {
    await setDeviceViewport(page, device);
    await page.waitForTimeout(100);
    await callback(device);
  }
}

/**
 * Capture screenshots across devices
 */
export async function captureResponsiveScreenshots(
  page: Page,
  baseName: string,
  devices: DevicePreset[] = ['iPhoneSE', 'iPadAir', 'desktop']
): Promise<string[]> {
  const screenshots: string[] = [];

  for (const device of devices) {
    await setDeviceViewport(page, device);
    await page.waitForTimeout(100);

    const path = `test-results/${baseName}-${device}.png`;
    await page.screenshot({ path, fullPage: true });
    screenshots.push(path);
  }

  return screenshots;
}

/**
 * Check if element is stacked (vertical layout) or inline (horizontal layout)
 */
export async function isElementsStacked(
  page: Page,
  locators: Locator[]
): Promise<boolean> {
  if (locators.length < 2) return true;

  const boxes = await Promise.all(locators.map((l) => l.boundingBox()));

  for (let i = 1; i < boxes.length; i++) {
    const prev = boxes[i - 1];
    const curr = boxes[i];

    if (!prev || !curr) continue;

    // If current element is below previous (stacked)
    if (curr.y >= prev.y + prev.height - 5) {
      continue;
    }

    // If current element is beside previous (inline)
    if (curr.x >= prev.x + prev.width - 5) {
      return false;
    }
  }

  return true;
}

/**
 * Get element computed style property
 */
export async function getComputedStyle(
  page: Page,
  locator: Locator,
  property: string
): Promise<string> {
  const element = await locator.elementHandle();
  if (!element) throw new Error('Element not found');

  return page.evaluate(
    ({ el, prop }) => {
      return window.getComputedStyle(el).getPropertyValue(prop);
    },
    { el: element, prop: property }
  );
}

/**
 * Check if element has touch-friendly size (minimum 44x44 pixels)
 */
export async function isTouchFriendlySize(locator: Locator): Promise<boolean> {
  const box = await locator.boundingBox();
  if (!box) return false;

  const MIN_TOUCH_SIZE = 44; // Apple's recommendation
  return box.width >= MIN_TOUCH_SIZE && box.height >= MIN_TOUCH_SIZE;
}

/**
 * Test touch target sizes on page
 */
export async function findSmallTouchTargets(
  page: Page
): Promise<Array<{ selector: string; width: number; height: number }>> {
  const MIN_SIZE = 44;

  return page.evaluate((minSize) => {
    const interactiveElements = document.querySelectorAll(
      'a, button, input, select, textarea, [role="button"], [onclick], [tabindex]'
    );

    const smallTargets: Array<{ selector: string; width: number; height: number }> = [];

    interactiveElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        if (rect.width < minSize || rect.height < minSize) {
          // Create a simple selector
          const tagName = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';
          const className = el.className && typeof el.className === 'string'
            ? '.' + el.className.split(' ').filter(Boolean).join('.')
            : '';

          smallTargets.push({
            selector: `${tagName}${id}${className}`,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        }
      }
    });

    return smallTargets;
  }, MIN_SIZE);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get a CSS selector for an element (best effort)
 */
async function getElementSelector(locator: Locator): Promise<string> {
  const element = await locator.elementHandle();
  if (!element) return 'body';

  return locator.page().evaluate((el) => {
    if (el.id) return `#${el.id}`;
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.split(' ').filter(Boolean).join('.');
      if (classes) return `.${classes}`;
    }
    return el.tagName.toLowerCase();
  }, element);
}

/**
 * Create a responsive test wrapper
 */
export function createResponsiveTest(
  testFn: (page: Page, device: DevicePreset) => Promise<void>
) {
  return async (page: Page) => {
    const devices: DevicePreset[] = ['iPhoneSE', 'iPadAir', 'desktop'];

    for (const device of devices) {
      await setDeviceViewport(page, device);
      await testFn(page, device);
    }
  };
}
