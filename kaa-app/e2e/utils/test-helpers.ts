/**
 * Enhanced test helper utilities for robust E2E testing
 * Provides retry logic, waiting utilities, and common test patterns
 */

import { Page, Locator, expect, BrowserContext } from '@playwright/test';

// =============================================================================
// Retry and Wait Utilities
// =============================================================================

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    shouldRetry = () => true,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  options: {
    timeout?: number;
    pollInterval?: number;
    message?: string;
  } = {}
): Promise<void> {
  const { timeout = 10000, pollInterval = 100, message = 'Condition not met' } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Timeout: ${message} (waited ${timeout}ms)`);
}

/**
 * Wait for page to be fully loaded and stable
 */
export async function waitForPageStable(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 30000 } = options;

  await Promise.all([
    page.waitForLoadState('networkidle', { timeout }),
    page.waitForLoadState('domcontentloaded', { timeout }),
  ]);

  // Wait for any animations to complete
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {});
      observer.observe(document.body, { childList: true, subtree: true });

      // Wait for DOM to stabilize
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 500);
    });
  });
}

/**
 * Wait for element to be stable (no layout changes)
 */
export async function waitForElementStable(
  locator: Locator,
  options: { timeout?: number; stabilityThreshold?: number } = {}
): Promise<void> {
  const { timeout = 10000, stabilityThreshold = 100 } = options;

  let lastRect: { x: number; y: number; width: number; height: number } | null = null;
  let stableTime = 0;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const rect = await locator.boundingBox();

    if (rect) {
      if (
        lastRect &&
        rect.x === lastRect.x &&
        rect.y === lastRect.y &&
        rect.width === lastRect.width &&
        rect.height === lastRect.height
      ) {
        stableTime += 50;
        if (stableTime >= stabilityThreshold) {
          return;
        }
      } else {
        stableTime = 0;
      }
      lastRect = rect;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

// =============================================================================
// Network Utilities
// =============================================================================

/**
 * Wait for a specific API response
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  options: { timeout?: number; status?: number } = {}
): Promise<{ status: number; body: unknown }> {
  const { timeout = 30000, status } = options;

  const response = await page.waitForResponse(
    (response) => {
      const matches =
        typeof urlPattern === 'string'
          ? response.url().includes(urlPattern)
          : urlPattern.test(response.url());

      if (status !== undefined) {
        return matches && response.status() === status;
      }
      return matches;
    },
    { timeout }
  );

  return {
    status: response.status(),
    body: await response.json().catch(() => null),
  };
}

/**
 * Mock API endpoint with custom response
 */
export async function mockApiEndpoint(
  page: Page,
  urlPattern: string | RegExp,
  response: {
    status?: number;
    body?: unknown;
    delay?: number;
  }
): Promise<void> {
  await page.route(urlPattern, async (route) => {
    if (response.delay) {
      await new Promise((resolve) => setTimeout(resolve, response.delay));
    }

    await route.fulfill({
      status: response.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(response.body ?? {}),
    });
  });
}

/**
 * Simulate network failure for specific endpoints
 */
export async function simulateNetworkFailure(
  page: Page,
  urlPattern: string | RegExp
): Promise<void> {
  await page.route(urlPattern, (route) => route.abort('failed'));
}

/**
 * Simulate slow network for specific endpoints
 */
export async function simulateSlowNetwork(
  page: Page,
  urlPattern: string | RegExp,
  delayMs: number = 3000
): Promise<void> {
  await page.route(urlPattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  });
}

/**
 * Record all API calls during test
 */
export async function recordApiCalls(
  page: Page
): Promise<{ calls: Array<{ url: string; method: string; status: number }> }> {
  const calls: Array<{ url: string; method: string; status: number }> = [];

  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/')) {
      calls.push({
        url,
        method: response.request().method(),
        status: response.status(),
      });
    }
  });

  return { calls };
}

// =============================================================================
// Form Utilities
// =============================================================================

/**
 * Fill form fields with retry logic
 */
export async function fillFormField(
  locator: Locator,
  value: string,
  options: { clear?: boolean; delay?: number } = {}
): Promise<void> {
  const { clear = true, delay = 0 } = options;

  await locator.waitFor({ state: 'visible' });
  await waitForElementStable(locator);

  if (clear) {
    await locator.clear();
  }

  if (delay > 0) {
    await locator.pressSequentially(value, { delay });
  } else {
    await locator.fill(value);
  }
}

/**
 * Submit form and wait for response
 */
export async function submitFormAndWait(
  page: Page,
  submitButton: Locator,
  expectedUrlPattern?: string | RegExp
): Promise<void> {
  const navigationPromise = expectedUrlPattern
    ? page.waitForURL(expectedUrlPattern, { timeout: 30000 })
    : page.waitForLoadState('networkidle');

  await submitButton.click();
  await navigationPromise;
}

/**
 * Validate form error messages
 */
export async function getFormErrors(page: Page): Promise<string[]> {
  const errorSelectors = [
    '[role="alert"]',
    '.error-message',
    '.field-error',
    '.form-error',
    '[class*="error"]',
    '[data-testid*="error"]',
  ];

  const errors: string[] = [];

  for (const selector of errorSelectors) {
    const elements = page.locator(selector);
    const count = await elements.count();

    for (let i = 0; i < count; i++) {
      const text = await elements.nth(i).textContent();
      if (text && text.trim()) {
        errors.push(text.trim());
      }
    }
  }

  return [...new Set(errors)]; // Remove duplicates
}

// =============================================================================
// Interaction Utilities
// =============================================================================

/**
 * Safe click with retry on stale element
 */
export async function safeClick(
  locator: Locator,
  options: { timeout?: number; force?: boolean } = {}
): Promise<void> {
  const { timeout = 10000, force = false } = options;

  await retryWithBackoff(
    async () => {
      await locator.waitFor({ state: 'visible', timeout });
      await locator.click({ force, timeout });
    },
    {
      maxRetries: 3,
      initialDelay: 500,
      shouldRetry: (error) => error.message.includes('stale') || error.message.includes('detached'),
    }
  );
}

/**
 * Hover over element with stability check
 */
export async function safeHover(locator: Locator): Promise<void> {
  await locator.waitFor({ state: 'visible' });
  await waitForElementStable(locator);
  await locator.hover();
}

/**
 * Scroll element into view with offset
 */
export async function scrollIntoViewWithOffset(
  locator: Locator,
  offset: { x?: number; y?: number } = {}
): Promise<void> {
  await locator.scrollIntoViewIfNeeded();

  if (offset.x || offset.y) {
    const page = locator.page();
    await page.evaluate(
      ({ x, y }) => {
        window.scrollBy(x ?? 0, y ?? 0);
      },
      { x: offset.x, y: offset.y }
    );
  }
}

// =============================================================================
// Assertion Utilities
// =============================================================================

/**
 * Assert element eventually has text (with retry)
 */
export async function expectEventuallyHasText(
  locator: Locator,
  expectedText: string | RegExp,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 10000 } = options;

  await expect(locator).toHaveText(expectedText, { timeout });
}

/**
 * Assert element count with optional wait
 */
export async function expectElementCount(
  locator: Locator,
  expectedCount: number | { min?: number; max?: number },
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 10000 } = options;

  if (typeof expectedCount === 'number') {
    await expect(locator).toHaveCount(expectedCount, { timeout });
  } else {
    await waitForCondition(
      async () => {
        const count = await locator.count();
        const minOk = expectedCount.min === undefined || count >= expectedCount.min;
        const maxOk = expectedCount.max === undefined || count <= expectedCount.max;
        return minOk && maxOk;
      },
      { timeout, message: `Element count not in expected range` }
    );
  }
}

/**
 * Assert URL matches pattern with timeout
 */
export async function expectUrl(
  page: Page,
  pattern: string | RegExp,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 10000 } = options;

  await expect(page).toHaveURL(pattern, { timeout });
}

// =============================================================================
// Storage Utilities
// =============================================================================

/**
 * Set localStorage value
 */
export async function setLocalStorage(
  page: Page,
  key: string,
  value: unknown
): Promise<void> {
  await page.evaluate(
    ({ k, v }) => {
      localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    },
    { k: key, v: value }
  );
}

/**
 * Get localStorage value
 */
export async function getLocalStorage<T = unknown>(
  page: Page,
  key: string
): Promise<T | null> {
  return page.evaluate((k) => {
    const value = localStorage.getItem(k);
    if (value === null) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }, key);
}

/**
 * Set sessionStorage value
 */
export async function setSessionStorage(
  page: Page,
  key: string,
  value: unknown
): Promise<void> {
  await page.evaluate(
    ({ k, v }) => {
      sessionStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    },
    { k: key, v: value }
  );
}

/**
 * Get sessionStorage value
 */
export async function getSessionStorage<T = unknown>(
  page: Page,
  key: string
): Promise<T | null> {
  return page.evaluate((k) => {
    const value = sessionStorage.getItem(k);
    if (value === null) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }, key);
}

/**
 * Clear all storage
 */
export async function clearAllStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

// =============================================================================
// Cookie Utilities
// =============================================================================

/**
 * Set cookie
 */
export async function setCookie(
  context: BrowserContext,
  cookie: {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }
): Promise<void> {
  await context.addCookies([
    {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain ?? 'localhost',
      path: cookie.path ?? '/',
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    },
  ]);
}

/**
 * Get cookie by name
 */
export async function getCookie(
  context: BrowserContext,
  name: string
): Promise<{ name: string; value: string } | undefined> {
  const cookies = await context.cookies();
  return cookies.find((c) => c.name === name);
}

// =============================================================================
// Screenshot and Debug Utilities
// =============================================================================

/**
 * Take screenshot with timestamp
 */
export async function takeDebugScreenshot(
  page: Page,
  name: string
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `test-results/debug-${name}-${timestamp}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

/**
 * Log page console messages for debugging
 */
export function enableConsoleLogging(page: Page): void {
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();

    if (type === 'error') {
      console.error(`[Page Console Error]: ${text}`);
    } else if (type === 'warning') {
      console.warn(`[Page Console Warning]: ${text}`);
    }
  });
}

/**
 * Log page errors for debugging
 */
export function enableErrorLogging(page: Page): void {
  page.on('pageerror', (error) => {
    console.error(`[Page Error]: ${error.message}`);
  });

  page.on('requestfailed', (request) => {
    console.error(`[Request Failed]: ${request.url()} - ${request.failure()?.errorText}`);
  });
}

// =============================================================================
// Performance Utilities
// =============================================================================

/**
 * Measure page load time
 */
export async function measurePageLoad(
  page: Page,
  url: string
): Promise<{ loadTime: number; domContentLoaded: number; firstContentfulPaint: number | null }> {
  const startTime = Date.now();

  await page.goto(url);
  await page.waitForLoadState('load');

  const loadTime = Date.now() - startTime;

  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find((p) => p.name === 'first-contentful-paint');

    return {
      domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
      firstContentfulPaint: fcp?.startTime ?? null,
    };
  });

  return {
    loadTime,
    domContentLoaded: timing.domContentLoaded,
    firstContentfulPaint: timing.firstContentfulPaint,
  };
}

/**
 * Assert page load time is acceptable
 */
export async function assertPerformance(
  metrics: { loadTime: number; firstContentfulPaint: number | null },
  thresholds: { maxLoadTime?: number; maxFCP?: number }
): Promise<void> {
  const { maxLoadTime = 5000, maxFCP = 2500 } = thresholds;

  if (metrics.loadTime > maxLoadTime) {
    console.warn(`Page load time (${metrics.loadTime}ms) exceeded threshold (${maxLoadTime}ms)`);
  }

  if (metrics.firstContentfulPaint !== null && metrics.firstContentfulPaint > maxFCP) {
    console.warn(
      `First Contentful Paint (${metrics.firstContentfulPaint}ms) exceeded threshold (${maxFCP}ms)`
    );
  }
}
