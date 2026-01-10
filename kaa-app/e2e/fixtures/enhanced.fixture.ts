/**
 * Enhanced Test Fixtures
 * Provides pre-configured pages with utilities, mocking, and accessibility testing
 */

import { test as base, Page, BrowserContext } from '@playwright/test';
import {
  MockApiManager,
  createMockManager,
  setupCommonMocks,
} from '../utils/mock-api';
import {
  setDeviceViewport,
  DevicePreset,
  DEVICE_PRESETS,
} from '../utils/responsive-helpers';
import {
  generateAccessibilityReport,
  assertNoViolations,
} from '../utils/accessibility-helpers';
import {
  enableConsoleLogging,
  enableErrorLogging,
  takeDebugScreenshot,
  measurePageLoad,
} from '../utils/test-helpers';

// =============================================================================
// Fixture Types
// =============================================================================

type EnhancedFixtures = {
  // Page with console/error logging enabled
  debugPage: Page;

  // Page with mock API manager
  mockedPage: {
    page: Page;
    mocks: MockApiManager;
  };

  // Mobile-configured page
  mobilePage: Page;

  // Tablet-configured page
  tabletPage: Page;

  // Page with accessibility testing helpers
  a11yPage: {
    page: Page;
    checkAccessibility: () => Promise<void>;
    getReport: () => Promise<ReturnType<typeof generateAccessibilityReport>>;
  };

  // Page with performance measurement
  perfPage: {
    page: Page;
    measureLoad: (url: string) => Promise<{
      loadTime: number;
      domContentLoaded: number;
      firstContentfulPaint: number | null;
    }>;
  };

  // Authenticated user with token
  testUser: {
    email: string;
    password: string;
    token: string;
  };

  // Authenticated page (client user)
  authenticatedPage: Page;

  // Admin authenticated page
  adminPage: Page;

  // Page with all features enabled
  fullPage: {
    page: Page;
    mocks: MockApiManager;
    setDevice: (device: DevicePreset) => Promise<void>;
    checkAccessibility: () => Promise<void>;
    takeScreenshot: (name: string) => Promise<string>;
    measureLoad: (url: string) => ReturnType<typeof measurePageLoad>;
  };
};

// =============================================================================
// Enhanced Test Extension
// =============================================================================

export const test = base.extend<EnhancedFixtures>({
  /**
   * Page with debug logging enabled
   */
  debugPage: async ({ page }, use) => {
    enableConsoleLogging(page);
    enableErrorLogging(page);
    await use(page);
  },

  /**
   * Page with mock API manager pre-configured
   */
  mockedPage: async ({ page }, use) => {
    const mocks = createMockManager(page);
    mocks.startRecording();

    await use({ page, mocks });

    // Cleanup
    await mocks.clearMocks();
  },

  /**
   * Mobile-configured page (iPhone 14 Pro)
   */
  mobilePage: async ({ page }, use) => {
    await setDeviceViewport(page, 'iPhone14Pro');
    await use(page);
  },

  /**
   * Tablet-configured page (iPad Air)
   */
  tabletPage: async ({ page }, use) => {
    await setDeviceViewport(page, 'iPadAir');
    await use(page);
  },

  /**
   * Page with accessibility testing helpers
   */
  a11yPage: async ({ page }, use) => {
    await use({
      page,
      checkAccessibility: async () => {
        await assertNoViolations(page, { impactLevel: 'serious' });
      },
      getReport: async () => {
        return generateAccessibilityReport(page);
      },
    });
  },

  /**
   * Page with performance measurement
   */
  perfPage: async ({ page }, use) => {
    await use({
      page,
      measureLoad: async (url: string) => {
        return measurePageLoad(page, url);
      },
    });
  },

  /**
   * Test user with credentials and token
   */
  testUser: async ({}, use) => {
    const user = {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      token: '',
    };

    // Create user via API
    const apiUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    try {
      const response = await fetch(`${apiUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          userType: 'SAGE_CLIENT',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        user.token = data.data?.token || '';
      }
    } catch {
      console.log('Could not register test user via API');
    }

    await use(user);
  },

  /**
   * Authenticated page (client user)
   */
  authenticatedPage: async ({ page, testUser }, use) => {
    // Set auth token in localStorage before navigation
    await page.addInitScript((token) => {
      if (token) {
        localStorage.setItem('authToken', token);
      }
    }, testUser.token);

    await use(page);
  },

  /**
   * Admin authenticated page
   */
  adminPage: async ({ page }, use) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@test.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminTestPass123!';

    await page.goto('/admin/login');
    await page.fill('[name="email"]', adminEmail);
    await page.fill('[name="password"]', adminPassword);
    await page.click('button[type="submit"]');

    try {
      await page.waitForURL(/admin\/dashboard/, { timeout: 5000 });
    } catch {
      console.log('Admin login redirect not completed');
    }

    await use(page);
  },

  /**
   * Full-featured page with all utilities
   */
  fullPage: async ({ page }, use) => {
    const mocks = createMockManager(page);
    mocks.startRecording();

    enableConsoleLogging(page);
    enableErrorLogging(page);

    await use({
      page,
      mocks,
      setDevice: async (device: DevicePreset) => {
        await setDeviceViewport(page, device);
      },
      checkAccessibility: async () => {
        await assertNoViolations(page, { impactLevel: 'serious' });
      },
      takeScreenshot: async (name: string) => {
        return takeDebugScreenshot(page, name);
      },
      measureLoad: (url: string) => measurePageLoad(page, url),
    });

    await mocks.clearMocks();
  },
});

export { expect } from '@playwright/test';

// =============================================================================
// Custom Test Helpers
// =============================================================================

/**
 * Create a test that runs across multiple device sizes
 */
export function testAcrossDevices(
  testName: string,
  testFn: (page: Page, device: DevicePreset) => Promise<void>,
  devices: DevicePreset[] = ['iPhoneSE', 'iPadAir', 'desktop']
) {
  for (const device of devices) {
    test(`${testName} (${device})`, async ({ page }) => {
      await setDeviceViewport(page, device);
      await testFn(page, device);
    });
  }
}

/**
 * Create a test that verifies accessibility
 */
export function testAccessibility(
  testName: string,
  setupFn: (page: Page) => Promise<void>
) {
  test(`${testName} - accessibility`, async ({ a11yPage }) => {
    await setupFn(a11yPage.page);
    await a11yPage.checkAccessibility();
  });
}

/**
 * Create a test that measures performance
 */
export function testPerformance(
  testName: string,
  url: string,
  thresholds: { maxLoadTime?: number; maxFCP?: number } = {}
) {
  test(`${testName} - performance`, async ({ perfPage }) => {
    const metrics = await perfPage.measureLoad(url);

    const { maxLoadTime = 5000, maxFCP = 2500 } = thresholds;

    if (metrics.loadTime > maxLoadTime) {
      console.warn(`Load time ${metrics.loadTime}ms exceeded threshold ${maxLoadTime}ms`);
    }

    if (metrics.firstContentfulPaint && metrics.firstContentfulPaint > maxFCP) {
      console.warn(`FCP ${metrics.firstContentfulPaint}ms exceeded threshold ${maxFCP}ms`);
    }
  });
}

// =============================================================================
// Test Data Setup Helpers
// =============================================================================

/**
 * Setup common test mocks
 */
export async function setupTestMocks(
  page: Page,
  options: {
    mockAuth?: boolean;
    mockProjects?: boolean;
    mockStripe?: boolean;
  } = {}
): Promise<MockApiManager> {
  return setupCommonMocks(page, {
    auth: options.mockAuth ? { id: 'test-user', email: 'test@test.com' } : undefined,
    projects: options.mockProjects
      ? [
          { id: 'p1', name: 'Test Project 1' },
          { id: 'p2', name: 'Test Project 2' },
        ]
      : undefined,
    mockStripe: options.mockStripe,
  });
}

/**
 * Pre-authenticate a page with a mock token
 */
export async function preAuthenticatePage(
  page: Page,
  token: string = 'mock-auth-token'
): Promise<void> {
  await page.addInitScript((t) => {
    localStorage.setItem('authToken', t);
  }, token);
}

/**
 * Setup page for mobile testing
 */
export async function setupMobilePage(
  page: Page,
  device: DevicePreset = 'iPhone14Pro'
): Promise<void> {
  await setDeviceViewport(page, device);
}

/**
 * Setup page with debug logging
 */
export function setupDebugPage(page: Page): void {
  enableConsoleLogging(page);
  enableErrorLogging(page);
}
