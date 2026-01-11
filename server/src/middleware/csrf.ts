/**
 * CSRF Protection Middleware
 * Implements the double-submit cookie pattern for CSRF protection.
 *
 * How it works:
 * 1. Server generates a CSRF token and sends it as both:
 *    - A cookie (HttpOnly: false, so JS can read it)
 *    - A response header (X-CSRF-Token)
 * 2. Client must include the token in requests as either:
 *    - X-CSRF-Token header
 *    - csrf_token in request body
 * 3. Server verifies the token matches the cookie value
 *
 * Safe methods (GET, HEAD, OPTIONS) are excluded from verification.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface CsrfConfig {
  cookieName: string;
  headerName: string;
  bodyFieldName: string;
  cookieOptions: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    maxAge: number;
    path: string;
  };
  ignoreMethods: string[];
  ignorePaths: string[];
}

const DEFAULT_CONFIG: CsrfConfig = {
  cookieName: 'csrf_token',
  headerName: 'x-csrf-token',
  bodyFieldName: 'csrf_token',
  cookieOptions: {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  },
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  ignorePaths: [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/auth/password/reset-request',
    '/api/auth/password/reset',
    '/api/leads', // Public lead submission
    '/api/webhooks', // Stripe webhooks use signature verification
    '/api/health', // Health checks
  ],
};

// ============================================================================
// TOKEN GENERATION
// ============================================================================

/**
 * Generate a cryptographically secure CSRF token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * CSRF Protection Middleware
 * @param customConfig - Optional custom configuration
 */
export function csrfProtection(customConfig: Partial<CsrfConfig> = {}) {
  const config = { ...DEFAULT_CONFIG, ...customConfig };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip CSRF check for safe methods
    if (config.ignoreMethods.includes(req.method.toUpperCase())) {
      // Still generate/refresh token for GET requests
      ensureToken(req, res, config);
      return next();
    }

    // Skip CSRF check for ignored paths
    const path = req.path.toLowerCase();
    if (config.ignorePaths.some(ignoredPath => path.startsWith(ignoredPath.toLowerCase()))) {
      return next();
    }

    // Get token from cookie
    const cookieToken = req.cookies?.[config.cookieName];

    // Get token from header or body
    const headerToken = req.headers[config.headerName] as string | undefined;
    const bodyToken = req.body?.[config.bodyFieldName] as string | undefined;
    const submittedToken = headerToken || bodyToken;

    // Verify tokens exist and match
    if (!cookieToken || !submittedToken) {
      logger.warn('CSRF token missing', {
        path: req.path,
        method: req.method,
        hasCookie: !!cookieToken,
        hasHeader: !!headerToken,
        hasBody: !!bodyToken,
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_TOKEN_MISSING',
          message: 'CSRF token is required for this request',
        },
      });
      return;
    }

    if (!safeCompare(cookieToken, submittedToken)) {
      logger.warn('CSRF token mismatch', {
        path: req.path,
        method: req.method,
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_TOKEN_INVALID',
          message: 'Invalid CSRF token',
        },
      });
      return;
    }

    // Token is valid, continue
    next();
  };
}

/**
 * Ensure a CSRF token exists in the response
 */
function ensureToken(req: Request, res: Response, config: CsrfConfig): void {
  let token = req.cookies?.[config.cookieName];

  // Generate new token if none exists
  if (!token) {
    token = generateToken();
    res.cookie(config.cookieName, token, config.cookieOptions);
  }

  // Always include token in response header for easy access
  res.setHeader('X-CSRF-Token', token);
}

/**
 * Middleware to generate and expose CSRF token
 * Use this on GET requests that return HTML or need to expose the token
 */
export function csrfTokenGenerator(customConfig: Partial<CsrfConfig> = {}) {
  const config = { ...DEFAULT_CONFIG, ...customConfig };

  return (req: Request, res: Response, next: NextFunction): void => {
    let token = req.cookies?.[config.cookieName];

    if (!token) {
      token = generateToken();
      res.cookie(config.cookieName, token, config.cookieOptions);
    }

    // Expose token in response header
    res.setHeader('X-CSRF-Token', token);

    // Add helper method to response for templates
    res.locals.csrfToken = token;

    next();
  };
}

/**
 * Get CSRF token from request (for API responses)
 */
export function getCsrfToken(req: Request, config: Partial<CsrfConfig> = {}): string {
  const cookieName = config.cookieName || DEFAULT_CONFIG.cookieName;
  return req.cookies?.[cookieName] || '';
}

/**
 * Express route handler to get a new CSRF token
 * GET /api/csrf-token
 */
export function csrfTokenEndpoint(customConfig: Partial<CsrfConfig> = {}) {
  const config = { ...DEFAULT_CONFIG, ...customConfig };

  return (req: Request, res: Response): void => {
    let token = req.cookies?.[config.cookieName];

    if (!token) {
      token = generateToken();
      res.cookie(config.cookieName, token, config.cookieOptions);
    }

    res.json({
      success: true,
      data: {
        token,
        headerName: config.headerName,
        cookieName: config.cookieName,
      },
    });
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default csrfProtection;
