/**
 * Middleware Index
 * Central export point for all Express middleware.
 */

// Authentication
export {
  createAuthMiddleware,
  requireAuth,
  optionalAuth,
  generateToken,
  verifyToken,
  shouldRefreshToken,
  type JwtPayload,
  type AuthenticatedUser,
  type AuthMiddlewareOptions,
} from './auth';

// Authorization - Tier
export {
  requireTier,
  requireExactTier,
  requireFeature,
  hasFeature,
  getFeaturesForTier,
  TIER_FEATURES,
  type TierConfig,
} from './requireTier';

// Authorization - Admin
export {
  requireAdmin,
  requireSuperAdmin,
  requireAdminOrOwner,
  isAdmin,
  isTeam,
  isAdminOrTeam,
  type AdminRole,
  type AdminOptions,
} from './requireAdmin';

// Validation
export {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  validateAll,
  getErrorMessages,
  getFirstError,
  type ValidationTarget,
  type ValidationOptions,
} from './validate';

// Error Handling
export {
  errorHandler,
  notFoundHandler,
  asyncHandler,
} from './errorHandler';

// Rate Limiting
export {
  createRateLimiter,
  apiRateLimiter,
  authRateLimiter,
  leadCreationRateLimiter,
  checkoutRateLimiter,
  uploadRateLimiter,
  adminRateLimiter,
} from './rateLimit';

// Login protection
export {
  loginProtection,
  onLoginSuccess,
  onLoginFailure,
  isLockedOut,
  getLockoutRemaining,
  recordFailedAttempt,
  clearFailedAttempts,
} from './loginProtection';

// Cache Middleware
export {
  routeCache,
  invalidateCache,
  publicCache,
  userCache,
  statsCache,
  projectListCache,
  noCache,
  type RouteCacheOptions,
} from './cacheMiddleware';

// Compression Middleware
export {
  createCompressionMiddleware,
  compressionMiddleware,
  jsonOptimizer,
  etagMiddleware,
  responseTimeMiddleware,
  trackResponseSize,
  getCompressionStats,
  resetCompressionStats,
  generateETag,
  type CompressionConfig,
} from './compression';

// Feature Flags
export {
  requireNotionService,
  requireStorageService,
} from './featureFlagGuard';

// CSRF Protection
export {
  csrfProtection,
  csrfTokenGenerator,
  csrfTokenEndpoint,
  getCsrfToken,
  type CsrfConfig,
} from './csrf';
