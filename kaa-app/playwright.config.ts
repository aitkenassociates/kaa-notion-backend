import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for KAA App mobile responsiveness testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Mobile viewports - Primary testing focus
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'iPhone SE',
      use: { ...devices['iPhone SE'] },
    },
    {
      name: 'Galaxy S9+',
      use: { ...devices['Galaxy S9+'] },
    },

    // Tablet viewports
    {
      name: 'iPad',
      use: { ...devices['iPad (gen 7)'] },
    },
    {
      name: 'iPad Pro',
      use: { ...devices['iPad Pro 11'] },
    },

    // Custom viewport testing
    {
      name: 'Mobile 320px',
      use: {
        viewport: { width: 320, height: 568 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'Mobile 375px',
      use: {
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'Mobile 480px Landscape',
      use: {
        viewport: { width: 480, height: 320 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],

  // Run local dev server before tests
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
