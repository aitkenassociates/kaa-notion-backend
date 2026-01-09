/**
 * Jest Test Setup
 * Global configuration and utilities for all tests
 */

// Load environment variables for testing
require('dotenv').config({ path: '.env.test' });

// Set default test environment
process.env.NODE_ENV = 'test';

// Global timeout
jest.setTimeout(30000);

// Mock console.error to reduce noise (optional)
// global.console.error = jest.fn();

// Database cleanup helper
global.cleanupDatabase = async () => {
  // Add database cleanup logic here when needed
};

// API test helpers
global.testUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
};

global.testProject = {
  id: 'test-project-id',
  name: 'Test Project',
  tier: 1,
  status: 'active',
};

// Mock Notion API responses
global.mockNotionResponses = {
  database: {
    results: [],
    has_more: false,
    next_cursor: null,
  },
  page: {
    id: 'mock-page-id',
    properties: {},
  },
};

// Mock Stripe responses
global.mockStripeResponses = {
  customer: {
    id: 'cus_test123',
    email: 'test@example.com',
  },
  subscription: {
    id: 'sub_test123',
    status: 'active',
  },
  paymentIntent: {
    id: 'pi_test123',
    status: 'succeeded',
  },
};

// Cleanup after all tests
afterAll(async () => {
  // Close any open connections
  await new Promise((resolve) => setTimeout(resolve, 500));
});
