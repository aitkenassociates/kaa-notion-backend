/**
 * Test data generators for E2E tests
 * Provides comprehensive test data for all scenarios
 */

// =============================================================================
// Basic Data Generators
// =============================================================================

export function generateLeadData() {
  const timestamp = Date.now();
  return {
    email: `lead-${timestamp}@test.com`,
    name: `Test User ${timestamp}`,
    address: `${Math.floor(Math.random() * 9999)} Main St, Test City, TS 12345`,
    budget: '$5,000 - $15,000',
    timeline: '1-2 months',
    projectType: 'Standard Renovation',
    hasSurvey: false,
    hasDrawings: false,
  };
}

export function generateUserData() {
  const timestamp = Date.now();
  return {
    email: `user-${timestamp}@test.com`,
    password: 'TestPassword123!',
    name: `Test User ${timestamp}`,
  };
}

// =============================================================================
// Name Generators
// =============================================================================

const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
];

export function generateName(): { firstName: string; lastName: string; fullName: string } {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
  };
}

// =============================================================================
// Phone Number Generator
// =============================================================================

export function generatePhone(): string {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const prefix = Math.floor(Math.random() * 900) + 100;
  const lineNumber = Math.floor(Math.random() * 9000) + 1000;
  return `(${areaCode}) ${prefix}-${lineNumber}`;
}

// =============================================================================
// Project Data Generators
// =============================================================================

export function generateProjectData(tier: 1 | 2 | 3 | 4 = 2) {
  const timestamp = Date.now();
  const tierConfig = TIER_TEST_DATA[`tier${tier}` as keyof typeof TIER_TEST_DATA];

  return {
    id: `project-${timestamp}`,
    name: `Test Project ${timestamp}`,
    clientEmail: generateUniqueEmail('project-client'),
    address: generateAddress(),
    tier,
    budget: tierConfig.budget,
    timeline: tierConfig.timeline,
    projectType: tierConfig.projectType,
    status: 'active',
    progress: Math.floor(Math.random() * 100),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function generateMilestoneData(projectId: string, index: number = 1) {
  return {
    id: `milestone-${projectId}-${index}`,
    projectId,
    title: `Milestone ${index}`,
    description: `Description for milestone ${index}`,
    status: index === 1 ? 'completed' : index === 2 ? 'in_progress' : 'pending',
    dueDate: new Date(Date.now() + index * 7 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: index === 1 ? new Date().toISOString() : null,
  };
}

export function generateDeliverableData(milestoneId: string, index: number = 1) {
  return {
    id: `deliverable-${milestoneId}-${index}`,
    milestoneId,
    title: `Deliverable ${index}`,
    type: ['document', 'drawing', 'report', 'file'][Math.floor(Math.random() * 4)],
    status: index === 1 ? 'completed' : 'pending',
    url: index === 1 ? `https://example.com/file-${index}.pdf` : null,
  };
}

// =============================================================================
// Client Data Generators
// =============================================================================

export function generateClientData() {
  const name = generateName();
  const timestamp = Date.now();

  return {
    id: `client-${timestamp}`,
    email: generateUniqueEmail('client'),
    name: name.fullName,
    phone: generatePhone(),
    address: generateAddress(),
    status: 'active',
    projectCount: Math.floor(Math.random() * 5),
    totalSpent: Math.floor(Math.random() * 50000) + 1000,
    createdAt: new Date().toISOString(),
  };
}

// =============================================================================
// Intake Form Data Generators
// =============================================================================

export function generateIntakeFormData(options: {
  tier?: 1 | 2 | 3 | 4;
  withSurvey?: boolean;
  withDrawings?: boolean;
} = {}) {
  const { tier = 2, withSurvey = false, withDrawings = false } = options;
  const tierConfig = TIER_TEST_DATA[`tier${tier}` as keyof typeof TIER_TEST_DATA];
  const name = generateName();

  return {
    name: name.fullName,
    email: generateUniqueEmail('intake'),
    phone: generatePhone(),
    address: generateAddress(),
    budget: tierConfig.budget,
    timeline: tierConfig.timeline,
    projectType: tierConfig.projectType,
    hasSurvey: withSurvey,
    hasDrawings: withDrawings,
    additionalNotes: `Test intake submission at ${new Date().toISOString()}`,
  };
}

// =============================================================================
// Complete Test Scenarios
// =============================================================================

export const TEST_SCENARIOS = {
  /**
   * Happy path: Standard tier 2 client
   */
  standardClient: () => ({
    intake: generateIntakeFormData({ tier: 2 }),
    expectedTier: 2,
    expectedConfidence: 'high',
  }),

  /**
   * Small project: Tier 1
   */
  smallProject: () => ({
    intake: generateIntakeFormData({ tier: 1 }),
    expectedTier: 1,
    expectedConfidence: 'high',
  }),

  /**
   * Premium client: Tier 3 with assets
   */
  premiumClient: () => ({
    intake: generateIntakeFormData({ tier: 3, withSurvey: true, withDrawings: true }),
    expectedTier: 3,
    expectedConfidence: 'very_high',
  }),

  /**
   * Enterprise client: Tier 4
   */
  enterpriseClient: () => ({
    intake: generateIntakeFormData({ tier: 4 }),
    expectedTier: 4,
    expectedConfidence: 'medium',
  }),

  /**
   * Edge case: Mismatched budget and timeline
   */
  mismatchedInputs: () => ({
    intake: {
      ...generateIntakeFormData({ tier: 2 }),
      budget: TIER_TEST_DATA.tier4.budget,
      timeline: TIER_TEST_DATA.tier1.timeline,
    },
    expectedTier: 2,
    expectedConfidence: 'low',
  }),
} as const;

// =============================================================================
// Validation Test Data
// =============================================================================

export const INVALID_EMAILS = [
  '',
  'invalid',
  'invalid@',
  '@invalid.com',
  'invalid@.com',
  'invalid@com',
  'invalid @test.com',
  'invalid@test .com',
];

export const VALID_EMAILS = [
  'test@example.com',
  'user.name@domain.com',
  'user+tag@domain.com',
  'user@subdomain.domain.com',
];

export const INVALID_ADDRESSES = [
  '',
  'abc',
  '123',
  'Street Name',
];

export const VALID_ADDRESSES = [
  '123 Main St, City, ST 12345',
  '456 Oak Avenue, Town, CA 90210',
  '789 Park Blvd Apt 101, Metro City, NY 10001',
];

// =============================================================================
// Mock API Response Data
// =============================================================================

export function generateMockAuthResponse(user?: Partial<{ id: string; email: string; name: string; role: string }>) {
  return {
    success: true,
    data: {
      token: `mock-token-${Date.now()}`,
      user: {
        id: user?.id ?? `user-${Date.now()}`,
        email: user?.email ?? generateUniqueEmail('auth'),
        name: user?.name ?? generateName().fullName,
        role: user?.role ?? 'USER',
      },
    },
  };
}

export function generateMockProjectsResponse(count: number = 3) {
  return {
    success: true,
    data: Array.from({ length: count }, (_, i) => generateProjectData((((i % 4) + 1) as 1 | 2 | 3 | 4))),
  };
}

export function generateMockLeadsResponse(count: number = 5) {
  return {
    success: true,
    data: Array.from({ length: count }, () => ({
      id: `lead-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      email: generateUniqueEmail('lead'),
      status: ['new', 'contacted', 'qualified', 'converted'][Math.floor(Math.random() * 4)],
      tier: Math.floor(Math.random() * 4) + 1,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    })),
  };
}

export const TIER_TEST_DATA = {
  tier1: {
    budget: 'Under $500',
    timeline: 'As soon as possible',
    projectType: 'Simple Consultation',
  },
  tier2: {
    budget: '$2,000 - $5,000',
    timeline: '2-4 weeks',
    projectType: 'Small Renovation',
  },
  tier3: {
    budget: '$15,000 - $50,000',
    timeline: '2-4 months',
    projectType: 'Standard Renovation',
  },
  tier4: {
    budget: '$50,000+',
    timeline: '4+ months',
    projectType: 'New Build',
  },
} as const;

export const TEST_CREDENTIALS = {
  client: {
    email: 'testclient@example.com',
    password: 'TestPassword123!',
  },
  admin: {
    email: 'admin@test.com',
    password: 'AdminTestPass123!',
  },
} as const;

export function generateUniqueEmail(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
}

export function generateAddress(): string {
  const streetNumber = Math.floor(Math.random() * 9999) + 1;
  const streets = ['Main St', 'Oak Ave', 'Elm St', 'Park Blvd', 'Cedar Ln'];
  const cities = ['Springfield', 'Riverside', 'Oakville', 'Maplewood', 'Greendale'];
  const states = ['CA', 'TX', 'FL', 'NY', 'IL'];

  const street = streets[Math.floor(Math.random() * streets.length)];
  const city = cities[Math.floor(Math.random() * cities.length)];
  const state = states[Math.floor(Math.random() * states.length)];
  const zip = Math.floor(Math.random() * 90000) + 10000;

  return `${streetNumber} ${street}, ${city}, ${state} ${zip}`;
}
