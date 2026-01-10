/**
 * Playwright E2E Test Configuration
 */

import { defineConfig, devices } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Auto-detect available Chromium executable from Playwright cache
 */
function findChromiumExecutable(): string | undefined {
  // Use environment variable if provided
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }

  // Look for cached Chromium versions
  const cacheDir = path.join(process.env.HOME || '/root', '.cache', 'ms-playwright');

  if (!fs.existsSync(cacheDir)) {
    return undefined;
  }

  // Find available chromium directories (sorted descending to prefer newer versions)
  const dirs = fs.readdirSync(cacheDir)
    .filter(d => d.startsWith('chromium-') && !d.includes('headless'))
    .sort((a, b) => {
      const versionA = parseInt(a.split('-')[1]) || 0;
      const versionB = parseInt(b.split('-')[1]) || 0;
      return versionB - versionA;
    });

  for (const dir of dirs) {
    const chromePath = path.join(cacheDir, dir, 'chrome-linux', 'chrome');
    if (fs.existsSync(chromePath)) {
      console.log(`Using cached Chromium: ${chromePath}`);
      return chromePath;
    }
  }

  return undefined;
}

const chromiumExecutable = findChromiumExecutable();

/**
 * Chrome launch arguments optimized for containerized/restricted environments
 */
const chromiumArgs = [
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-extensions',
  '--disable-sync',
  '--disable-translate',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-infobars',
  '--no-first-run',
  '--no-zygote',
  '--single-process',
  '--ignore-certificate-errors',
  '--allow-running-insecure-content',
  '--disable-web-security',
  '--disable-features=IsolateOrigins,site-per-process',
];

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video recording */
    video: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // Use auto-detected or custom executable path
          ...(chromiumExecutable && {
            executablePath: chromiumExecutable,
          }),
          args: chromiumArgs,
        },
      },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        launchOptions: {
          // Use auto-detected or custom executable path
          ...(chromiumExecutable && {
            executablePath: chromiumExecutable,
          }),
          args: chromiumArgs,
        },
      },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  /* Timeout for each test */
  timeout: 30 * 1000,
  
  /* Timeout for each expect() assertion */
  expect: {
    timeout: 5 * 1000,
  },
});
