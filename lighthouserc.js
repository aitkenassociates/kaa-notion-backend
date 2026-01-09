/**
 * Lighthouse CI Configuration
 * Performance, accessibility, and SEO monitoring for KAA Notion Backend
 */

module.exports = {
  ci: {
    collect: {
      // URLs to test
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/login',
        'http://localhost:3000/dashboard',
      ],
      // Start the development server before testing
      startServerCommand: 'cd kaa-app && npm start',
      startServerReadyPattern: 'Compiled successfully',
      startServerReadyTimeout: 60000,
      // Number of runs per URL for consistent results
      numberOfRuns: 3,
      // Chrome flags for headless testing
      settings: {
        chromeFlags: '--no-sandbox --headless --disable-gpu',
        throttlingMethod: 'devtools',
        // Mobile-first testing
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 812,
          deviceScaleFactor: 3,
        },
      },
    },
    assert: {
      // Performance thresholds
      assertions: {
        // Performance metrics
        'categories:performance': ['warn', { minScore: 0.7 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],

        // Core Web Vitals
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],

        // Accessibility requirements
        'color-contrast': 'error',
        'document-title': 'error',
        'html-has-lang': 'error',
        'meta-viewport': 'error',
        'image-alt': 'error',
        'link-name': 'error',
        'button-name': 'error',
        'label': 'warn',

        // Best practices
        'errors-in-console': 'warn',
        'image-aspect-ratio': 'warn',
        'deprecations': 'warn',

        // SEO
        'meta-description': 'warn',
        'robots-txt': 'off', // May not exist in dev
        'tap-targets': 'warn',
      },
    },
    upload: {
      // Upload results to temporary public storage
      target: 'temporary-public-storage',
    },
  },
};
