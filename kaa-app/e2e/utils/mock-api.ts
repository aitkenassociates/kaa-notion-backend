/**
 * API Mocking Utilities for E2E Tests
 * Provides isolated testing with mock responses and network simulation
 */

import { Page, Route, Request } from '@playwright/test';

// =============================================================================
// Mock Response Types
// =============================================================================

export interface MockResponse<T = unknown> {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: T;
  delay?: number;
}

export interface MockEndpoint {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | '*';
  url: string | RegExp;
  response: MockResponse | ((request: Request) => MockResponse | Promise<MockResponse>);
}

export interface ApiCallRecord {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData: string | null;
  timestamp: number;
  response?: {
    status: number;
    body?: unknown;
  };
}

// =============================================================================
// Mock API Manager
// =============================================================================

export class MockApiManager {
  private page: Page;
  private mocks: Map<string, MockEndpoint> = new Map();
  private callRecords: ApiCallRecord[] = [];
  private isRecording = false;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Register a mock endpoint
   */
  async mock(endpoint: MockEndpoint): Promise<void> {
    const key = `${endpoint.method || '*'}:${endpoint.url.toString()}`;
    this.mocks.set(key, endpoint);

    await this.page.route(endpoint.url, async (route) => {
      const request = route.request();

      // Check method match
      if (endpoint.method && endpoint.method !== '*' && request.method() !== endpoint.method) {
        await route.continue();
        return;
      }

      // Get response
      const response =
        typeof endpoint.response === 'function'
          ? await endpoint.response(request)
          : endpoint.response;

      // Apply delay if specified
      if (response.delay) {
        await new Promise((resolve) => setTimeout(resolve, response.delay));
      }

      // Record the call
      if (this.isRecording) {
        this.callRecords.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData(),
          timestamp: Date.now(),
          response: {
            status: response.status ?? 200,
            body: response.body,
          },
        });
      }

      // Fulfill the request
      await route.fulfill({
        status: response.status ?? 200,
        statusText: response.statusText ?? 'OK',
        headers: {
          'Content-Type': 'application/json',
          ...response.headers,
        },
        body: response.body ? JSON.stringify(response.body) : undefined,
      });
    });
  }

  /**
   * Mock multiple endpoints at once
   */
  async mockAll(endpoints: MockEndpoint[]): Promise<void> {
    await Promise.all(endpoints.map((e) => this.mock(e)));
  }

  /**
   * Clear all mocks
   */
  async clearMocks(): Promise<void> {
    for (const endpoint of this.mocks.values()) {
      await this.page.unroute(endpoint.url);
    }
    this.mocks.clear();
  }

  /**
   * Start recording API calls
   */
  startRecording(): void {
    this.isRecording = true;
    this.callRecords = [];
  }

  /**
   * Stop recording and return calls
   */
  stopRecording(): ApiCallRecord[] {
    this.isRecording = false;
    return [...this.callRecords];
  }

  /**
   * Get recorded calls
   */
  getRecordedCalls(): ApiCallRecord[] {
    return [...this.callRecords];
  }

  /**
   * Wait for a specific API call
   */
  async waitForCall(
    urlPattern: string | RegExp,
    options: { method?: string; timeout?: number } = {}
  ): Promise<ApiCallRecord> {
    const { method, timeout = 30000 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const call = this.callRecords.find((c) => {
        const urlMatch =
          typeof urlPattern === 'string' ? c.url.includes(urlPattern) : urlPattern.test(c.url);
        const methodMatch = !method || c.method === method;
        return urlMatch && methodMatch;
      });

      if (call) return call;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`API call not found: ${urlPattern} (method: ${method ?? 'any'})`);
  }

  /**
   * Assert a call was made
   */
  assertCallMade(
    urlPattern: string | RegExp,
    options: { method?: string; times?: number } = {}
  ): void {
    const { method, times } = options;

    const calls = this.callRecords.filter((c) => {
      const urlMatch =
        typeof urlPattern === 'string' ? c.url.includes(urlPattern) : urlPattern.test(c.url);
      const methodMatch = !method || c.method === method;
      return urlMatch && methodMatch;
    });

    if (calls.length === 0) {
      throw new Error(`Expected API call to ${urlPattern} but none was made`);
    }

    if (times !== undefined && calls.length !== times) {
      throw new Error(`Expected ${times} calls to ${urlPattern} but got ${calls.length}`);
    }
  }

  /**
   * Assert no call was made
   */
  assertNoCallMade(urlPattern: string | RegExp, method?: string): void {
    const call = this.callRecords.find((c) => {
      const urlMatch =
        typeof urlPattern === 'string' ? c.url.includes(urlPattern) : urlPattern.test(c.url);
      const methodMatch = !method || c.method === method;
      return urlMatch && methodMatch;
    });

    if (call) {
      throw new Error(`Expected no API call to ${urlPattern} but found: ${call.url}`);
    }
  }
}

// =============================================================================
// Pre-built Mock Factories
// =============================================================================

/**
 * Create mock for successful authentication
 */
export function mockAuthSuccess(user: {
  id: string;
  email: string;
  name?: string;
  role?: string;
}): MockEndpoint[] {
  return [
    {
      method: 'POST',
      url: '**/api/auth/login',
      response: {
        status: 200,
        body: {
          success: true,
          data: {
            token: 'mock-jwt-token-' + Date.now(),
            user: {
              id: user.id,
              email: user.email,
              name: user.name ?? 'Test User',
              role: user.role ?? 'USER',
            },
          },
        },
      },
    },
    {
      method: 'POST',
      url: '**/api/auth/register',
      response: {
        status: 200,
        body: {
          success: true,
          data: {
            token: 'mock-jwt-token-' + Date.now(),
            user: {
              id: user.id,
              email: user.email,
              name: user.name ?? 'Test User',
              role: user.role ?? 'USER',
            },
          },
        },
      },
    },
    {
      method: 'GET',
      url: '**/api/auth/me',
      response: {
        status: 200,
        body: {
          success: true,
          data: {
            id: user.id,
            email: user.email,
            name: user.name ?? 'Test User',
            role: user.role ?? 'USER',
          },
        },
      },
    },
  ];
}

/**
 * Create mock for authentication failure
 */
export function mockAuthFailure(error: string = 'Invalid credentials'): MockEndpoint[] {
  return [
    {
      method: 'POST',
      url: '**/api/auth/login',
      response: {
        status: 401,
        body: {
          success: false,
          error,
        },
      },
    },
    {
      method: 'POST',
      url: '**/api/auth/register',
      response: {
        status: 400,
        body: {
          success: false,
          error: 'Email already registered',
        },
      },
    },
  ];
}

/**
 * Create mock for project list
 */
export function mockProjects(
  projects: Array<{
    id: string;
    name: string;
    status?: string;
    tier?: number;
    progress?: number;
  }>
): MockEndpoint {
  return {
    method: 'GET',
    url: '**/api/projects**',
    response: {
      status: 200,
      body: {
        success: true,
        data: projects.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status ?? 'active',
          tier: p.tier ?? 2,
          progress: p.progress ?? 50,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
      },
    },
  };
}

/**
 * Create mock for single project
 */
export function mockProject(project: {
  id: string;
  name: string;
  status?: string;
  tier?: number;
  milestones?: Array<{ id: string; title: string; completed: boolean }>;
  deliverables?: Array<{ id: string; title: string; status: string }>;
}): MockEndpoint {
  return {
    method: 'GET',
    url: new RegExp(`/api/projects/${project.id}`),
    response: {
      status: 200,
      body: {
        success: true,
        data: {
          id: project.id,
          name: project.name,
          status: project.status ?? 'active',
          tier: project.tier ?? 2,
          milestones: project.milestones ?? [
            { id: 'm1', title: 'Milestone 1', completed: true },
            { id: 'm2', title: 'Milestone 2', completed: false },
          ],
          deliverables: project.deliverables ?? [
            { id: 'd1', title: 'Deliverable 1', status: 'completed' },
            { id: 'd2', title: 'Deliverable 2', status: 'in_progress' },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    },
  };
}

/**
 * Create mock for leads list
 */
export function mockLeads(
  leads: Array<{
    id: string;
    email: string;
    status?: string;
    tier?: number;
    createdAt?: string;
  }>
): MockEndpoint {
  return {
    method: 'GET',
    url: '**/api/leads**',
    response: {
      status: 200,
      body: {
        success: true,
        data: leads.map((l) => ({
          id: l.id,
          email: l.email,
          status: l.status ?? 'new',
          tier: l.tier ?? 2,
          createdAt: l.createdAt ?? new Date().toISOString(),
        })),
      },
    },
  };
}

/**
 * Create mock for intake form submission
 */
export function mockIntakeSubmission(
  tierRecommendation: { tier: number; confidence: string; reasons: string[] }
): MockEndpoint {
  return {
    method: 'POST',
    url: '**/api/intake**',
    response: {
      status: 200,
      body: {
        success: true,
        data: {
          leadId: 'lead-' + Date.now(),
          recommendation: tierRecommendation,
        },
      },
    },
  };
}

/**
 * Create mock for Stripe checkout
 */
export function mockStripeCheckout(sessionId: string = 'cs_test_123'): MockEndpoint[] {
  return [
    {
      method: 'POST',
      url: '**/api/checkout/create-session',
      response: {
        status: 200,
        body: {
          success: true,
          data: {
            sessionId,
            url: `https://checkout.stripe.com/c/pay/${sessionId}`,
          },
        },
      },
    },
    {
      method: 'GET',
      url: '**/api/checkout/session/**',
      response: {
        status: 200,
        body: {
          success: true,
          data: {
            id: sessionId,
            status: 'complete',
            amountTotal: 29900,
            currency: 'usd',
            customerEmail: 'test@example.com',
          },
        },
      },
    },
  ];
}

/**
 * Create mock for pricing tiers
 */
export function mockPricingTiers(): MockEndpoint {
  return {
    method: 'GET',
    url: '**/api/pricing**',
    response: {
      status: 200,
      body: {
        success: true,
        data: [
          {
            id: 1,
            name: 'Tier 1 - Essential',
            price: 299,
            features: ['Feature 1', 'Feature 2', 'Feature 3'],
          },
          {
            id: 2,
            name: 'Tier 2 - Professional',
            price: 1499,
            features: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5'],
            mostPopular: true,
          },
          {
            id: 3,
            name: 'Tier 3 - Premium',
            price: 4999,
            features: ['All features', 'Priority support', 'Custom solutions'],
          },
          {
            id: 4,
            name: 'Tier 4 - Enterprise',
            price: null,
            features: ['Custom pricing', 'Dedicated support', 'Custom integrations'],
            contactSales: true,
          },
        ],
      },
    },
  };
}

// =============================================================================
// Network Simulation
// =============================================================================

/**
 * Simulate network conditions
 */
export async function simulateNetworkCondition(
  page: Page,
  condition: 'offline' | 'slow-3g' | 'fast-3g' | '4g' | 'wifi'
): Promise<void> {
  const conditions: Record<string, { latency: number; downloadThroughput: number }> = {
    offline: { latency: 0, downloadThroughput: 0 },
    'slow-3g': { latency: 2000, downloadThroughput: 40000 }, // 40 KB/s
    'fast-3g': { latency: 562, downloadThroughput: 180000 }, // 180 KB/s
    '4g': { latency: 100, downloadThroughput: 4000000 }, // 4 MB/s
    wifi: { latency: 20, downloadThroughput: 30000000 }, // 30 MB/s
  };

  const config = conditions[condition];

  if (condition === 'offline') {
    await page.context().setOffline(true);
  } else {
    await page.context().setOffline(false);

    // Apply throttling via route handler
    await page.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, config.latency));
      await route.continue();
    });
  }
}

/**
 * Simulate random network failures
 */
export async function simulateUnreliableNetwork(
  page: Page,
  failureRate: number = 0.2 // 20% failure rate
): Promise<void> {
  await page.route('**/api/**', async (route) => {
    if (Math.random() < failureRate) {
      await route.abort('failed');
    } else {
      await route.continue();
    }
  });
}

/**
 * Simulate timeout for specific endpoints
 */
export async function simulateTimeout(
  page: Page,
  urlPattern: string | RegExp,
  timeoutMs: number = 30000
): Promise<void> {
  await page.route(urlPattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, timeoutMs));
    await route.abort('timedout');
  });
}

// =============================================================================
// Error Response Mocks
// =============================================================================

/**
 * Create mock for server error
 */
export function mockServerError(
  urlPattern: string | RegExp = '**/api/**'
): MockEndpoint {
  return {
    url: urlPattern,
    response: {
      status: 500,
      body: {
        success: false,
        error: 'Internal server error',
      },
    },
  };
}

/**
 * Create mock for not found error
 */
export function mockNotFound(urlPattern: string | RegExp = '**/api/**'): MockEndpoint {
  return {
    url: urlPattern,
    response: {
      status: 404,
      body: {
        success: false,
        error: 'Resource not found',
      },
    },
  };
}

/**
 * Create mock for validation error
 */
export function mockValidationError(
  urlPattern: string | RegExp = '**/api/**',
  errors: Record<string, string[]>
): MockEndpoint {
  return {
    url: urlPattern,
    response: {
      status: 400,
      body: {
        success: false,
        error: 'Validation failed',
        errors,
      },
    },
  };
}

/**
 * Create mock for rate limiting
 */
export function mockRateLimited(
  urlPattern: string | RegExp = '**/api/**',
  retryAfter: number = 60
): MockEndpoint {
  return {
    url: urlPattern,
    response: {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
      },
      body: {
        success: false,
        error: 'Too many requests',
        retryAfter,
      },
    },
  };
}

/**
 * Create mock for unauthorized error
 */
export function mockUnauthorized(urlPattern: string | RegExp = '**/api/**'): MockEndpoint {
  return {
    url: urlPattern,
    response: {
      status: 401,
      body: {
        success: false,
        error: 'Unauthorized',
      },
    },
  };
}

/**
 * Create mock for forbidden error
 */
export function mockForbidden(urlPattern: string | RegExp = '**/api/**'): MockEndpoint {
  return {
    url: urlPattern,
    response: {
      status: 403,
      body: {
        success: false,
        error: 'Forbidden',
      },
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a mock manager for a page
 */
export function createMockManager(page: Page): MockApiManager {
  return new MockApiManager(page);
}

/**
 * Setup common mocks for a test
 */
export async function setupCommonMocks(
  page: Page,
  options: {
    auth?: { id: string; email: string; role?: string };
    projects?: Array<{ id: string; name: string }>;
    mockStripe?: boolean;
  } = {}
): Promise<MockApiManager> {
  const manager = new MockApiManager(page);

  const endpoints: MockEndpoint[] = [];

  if (options.auth) {
    endpoints.push(...mockAuthSuccess(options.auth));
  }

  if (options.projects) {
    endpoints.push(mockProjects(options.projects));
  }

  if (options.mockStripe) {
    endpoints.push(...mockStripeCheckout());
  }

  endpoints.push(mockPricingTiers());

  await manager.mockAll(endpoints);
  manager.startRecording();

  return manager;
}
