/**
 * E2E Test Utilities - Centralized Export
 * Import all utilities from this single file for convenience
 */

// Core test helpers
export {
  retryWithBackoff,
  waitForCondition,
  waitForPageStable,
  waitForElementStable,
  waitForApiResponse,
  mockApiEndpoint,
  simulateNetworkFailure,
  simulateSlowNetwork,
  recordApiCalls,
  fillFormField,
  submitFormAndWait,
  getFormErrors,
  safeClick,
  safeHover,
  scrollIntoViewWithOffset,
  expectEventuallyHasText,
  expectElementCount,
  expectUrl,
  setLocalStorage,
  getLocalStorage,
  setSessionStorage,
  getSessionStorage,
  clearAllStorage,
  setCookie,
  getCookie,
  takeDebugScreenshot,
  enableConsoleLogging,
  enableErrorLogging,
  measurePageLoad,
  assertPerformance,
} from './test-helpers';

// Responsive and mobile testing
export {
  DEVICE_PRESETS,
  BREAKPOINTS,
  setDeviceViewport,
  setBreakpointViewport,
  setViewport,
  getViewport,
  isMobileViewport,
  isTabletViewport,
  isDesktopViewport,
  setOrientation,
  toggleOrientation,
  tap,
  doubleTap,
  swipe,
  swipeLeft,
  swipeRight,
  swipeUp,
  swipeDown,
  pullToRefresh,
  pinchZoom,
  longPress,
  scrollToElementMobile,
  openMobileMenu,
  closeMobileMenu,
  isMobileNavVisible,
  dismissKeyboard,
  isVisibleInMobileViewport,
  testVisibilityAcrossBreakpoints,
  testLayoutAcrossDevices,
  captureResponsiveScreenshots,
  isElementsStacked,
  getComputedStyle,
  isTouchFriendlySize,
  findSmallTouchTargets,
  createResponsiveTest,
} from './responsive-helpers';
export type { DevicePreset, Breakpoint, Orientation } from './responsive-helpers';

// Accessibility testing
export {
  runAccessibilityAudit,
  checkCriticalViolations,
  assertNoViolations,
  testWCAG21LevelA,
  testWCAG21LevelAA,
  testWCAG21LevelAAA,
  checkHeadingHierarchy,
  checkImageAltText,
  checkFormLabels,
  checkLinkText,
  checkColorContrast,
  checkFocusIndicators,
  testKeyboardNavigation,
  testSkipLink,
  findLiveRegions,
  getAccessibleName,
  getAriaRole,
  generateAccessibilityReport,
} from './accessibility-helpers';
export type {
  AccessibilityResult,
  Violation,
  HeadingInfo,
  ImageAltIssue,
  FormLabelIssue,
  LinkTextIssue,
  ColorContrastIssue,
} from './accessibility-helpers';

// API mocking
export {
  MockApiManager,
  createMockManager,
  mockAuthSuccess,
  mockAuthFailure,
  mockProjects,
  mockProject,
  mockLeads,
  mockIntakeSubmission,
  mockStripeCheckout,
  mockPricingTiers,
  simulateNetworkCondition,
  simulateUnreliableNetwork,
  simulateTimeout,
  mockServerError,
  mockNotFound,
  mockValidationError,
  mockRateLimited,
  mockUnauthorized,
  mockForbidden,
  setupCommonMocks,
} from './mock-api';
export type { MockResponse, MockEndpoint, ApiCallRecord } from './mock-api';

// Test data generators
export {
  generateLeadData,
  generateUserData,
  generateUniqueEmail,
  generateAddress,
  TIER_TEST_DATA,
  TEST_CREDENTIALS,
} from './test-data';

// API helpers
export {
  createTestLead,
  registerUser,
  loginUser,
  getProjects,
  simulatePayment,
  healthCheck,
} from './api-helpers';
