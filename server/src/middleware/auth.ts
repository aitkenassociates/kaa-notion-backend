/**
 * Authentication Middleware
 * JWT verification, user attachment, token refresh handling.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { verifyToken as verifyTokenUtil, generateToken as generateTokenUtil } from '../utils/auth';
import { AppError, ErrorCodes, unauthorized, invalidToken, tokenExpired, internalError } from '../utils/AppError';
import { logger } from '../logger';

// ============================================================================
// TYPES
// ============================================================================

export interface JwtPayload {
  userId: string;
  email: string;
  userType: 'KAA_CLIENT' | 'SAGE_CLIENT' | 'TEAM' | 'ADMIN';
  tier?: number;
  iat?: number;
  exp?: number;
}

export interface TokenPayload {
  userId: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  userId: string; // Alias for compatibility
  email: string;
  name: string | null;
  role: string;
  userType: 'KAA_CLIENT' | 'SAGE_CLIENT' | 'TEAM' | 'ADMIN';
  tier: number | null;
  clientId?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  token?: string;
}

// Note: Express Request.user type is extended in src/types/express.d.ts
// We use the same structure here for consistency

// ============================================================================
// CONFIGURATION
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const TOKEN_REFRESH_THRESHOLD = 60 * 60; // Refresh if less than 1 hour remaining
const JWT_REFRESH_THRESHOLD = 60 * 60 * 24; // Refresh if expires within 24 hours

// ============================================================================
// JWT UTILITIES
// ============================================================================

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as string,
  } as jwt.SignOptions);
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw tokenExpired();
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw invalidToken();
    }
    throw error;
  }
}

/**
 * Check if token should be refreshed
 */
export function shouldRefreshToken(payload: JwtPayload | TokenPayload): boolean {
  if (!payload.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp - now < JWT_REFRESH_THRESHOLD;
}

/**
 * Check if token needs refresh (legacy function)
 */
function tokenNeedsRefresh(payload: TokenPayload): boolean {
  if (!payload.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  const timeRemaining = payload.exp - now;
  return timeRemaining > 0 && timeRemaining < TOKEN_REFRESH_THRESHOLD;
}

/**
 * Extract token from request headers
 */
function extractToken(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Support just "token" format
  if (authHeader) {
    return authHeader;
  }

  // Check x-access-token header (alternative)
  const xToken = req.headers['x-access-token'];
  if (typeof xToken === 'string') {
    return xToken;
  }

  // Check query parameter (for downloads, etc.)
  const queryToken = req.query.token;
  if (typeof queryToken === 'string') {
    return queryToken;
  }

  return null;
}

// ============================================================================
// MIDDLEWARE FACTORY
// ============================================================================

export interface AuthMiddlewareOptions {
  prisma: PrismaClient;
  optional?: boolean;
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions) {
  const { prisma: prismaClient, optional = false } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = extractToken(req);

      // No token provided
      if (!token) {
        // For development, check x-user-id header (remove in production)
        if (process.env.NODE_ENV === 'development') {
          const devUserId = req.headers['x-user-id'] as string;
          const devUserType = req.headers['x-user-type'] as string;

          if (devUserId && devUserType) {
            (req as any).user = {
              id: devUserId,
              userId: devUserId,
              email: (req.headers['x-user-email'] as string) || '',
              name: null,
              role: devUserType,
              userType: devUserType as AuthenticatedUser['userType'],
              tier: parseInt(req.headers['x-user-tier'] as string, 10) || undefined,
            };
            return next();
          }
        }

        if (optional) {
          return next();
        }

        throw unauthorized('No authentication token provided');
      }

      // Verify token
      const payload = verifyToken(token);

      // Get user from database to ensure they still exist and are active
      const user = await prismaClient.user.findUnique({
        where: { id: payload.userId },
        include: {
          client: true,
        },
      });

      if (!user) {
        throw invalidToken('User no longer exists');
      }

      // Attach user to request
      (req as any).user = {
        id: user.id,
        userId: user.id,
        email: user.email || '',
        name: user.name || null,
        role: user.userType || user.role || 'SAGE_CLIENT',
        userType: (user.userType as AuthenticatedUser['userType']) || 'SAGE_CLIENT',
        tier: user.tier || undefined,
        clientId: user.client?.id,
      };
      (req as any).token = token;

      // Check if token should be refreshed
      if (shouldRefreshToken(payload)) {
        const newToken = generateToken({
          userId: user.id,
          email: user.email || '',
          userType: (user.userType as JwtPayload['userType']) || 'SAGE_CLIENT',
          tier: user.tier || undefined,
        });
        res.setHeader('X-New-Token', newToken);
        res.setHeader('X-Token-Refresh', newToken);
      }

      // Update last login
      await prismaClient.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }

      next(internalError('Authentication failed', error as Error));
    }
  };
}

// ============================================================================
// STANDALONE MIDDLEWARE
// ============================================================================

/**
 * Authenticate user from JWT token
 * Attaches user to request if valid, returns 401 if not
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'NO_TOKEN',
        message: 'Authentication required. No token provided.',
      },
    });
  }

  // Verify token
  const payload = verifyTokenUtil(token, JWT_SECRET) as TokenPayload | null;

  if (!payload) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token. Please log in again.',
      },
    });
  }

  // Check if userId exists
  if (!payload.userId || typeof payload.userId !== 'string') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN_PAYLOAD',
        message: 'Token payload is invalid.',
      },
    });
  }

  try {
    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        userType: true,
        tier: true,
        client: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User associated with this token no longer exists.',
        },
      });
    }

    // Attach user to request
    (req as AuthenticatedRequest).user = {
      id: user.id,
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role || user.userType || 'SAGE_CLIENT',
      userType: (user.userType as AuthenticatedUser['userType']) || 'SAGE_CLIENT',
      tier: user.tier,
      clientId: user.client?.id,
    };

    // Check if token needs refresh and add new token to response header
    if (tokenNeedsRefresh(payload)) {
      const newToken = generateTokenUtil(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
        },
        JWT_SECRET,
        24 // 24 hours
      );

      res.setHeader('X-Token-Refresh', newToken);
    }

    next();
  } catch (error) {
    console.error('[Auth] Error fetching user:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'An error occurred during authentication.',
      },
    });
  }
}

/**
 * Optional authentication - attaches user if token present, continues if not
 */
export async function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  const payload = verifyTokenUtil(token, JWT_SECRET) as TokenPayload | null;

  if (!payload || !payload.userId) {
    return next();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        userType: true,
        tier: true,
        client: {
          select: {
            id: true,
          },
        },
      },
    });

    if (user) {
      (req as AuthenticatedRequest).user = {
        id: user.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role || user.userType || 'SAGE_CLIENT',
        userType: (user.userType as AuthenticatedUser['userType']) || 'SAGE_CLIENT',
        tier: user.tier,
        clientId: user.client?.id,
      };
    }
  } catch (error) {
    console.error('[Auth] Error in optional auth:', error);
  }

  next();
}

/**
 * Required authentication middleware (convenience wrapper)
 */
export function requireAuth(prismaClient: PrismaClient) {
  return createAuthMiddleware({ prisma: prismaClient, optional: false });
}

/**
 * Optional authentication middleware (convenience wrapper)
 */
export function optionalAuth(prismaClient: PrismaClient) {
  return createAuthMiddleware({ prisma: prismaClient, optional: true });
}

// ============================================================================
// AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Require specific role(s)
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
    }

    if (!roles.includes(user.role) && !roles.includes(user.userType)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role: ${roles.join(' or ')}.`,
        },
      });
    }

    next();
  };
}

/**
 * Require admin role (ADMIN or TEAM)
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void | Response {
  const user = (req as AuthenticatedRequest).user;

  if (!user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      },
    });
  }

  const adminRoles = ['ADMIN', 'TEAM'];
  if (!adminRoles.includes(user.role) && !adminRoles.includes(user.userType)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'ADMIN_REQUIRED',
        message: 'Admin access required.',
      },
    });
  }

  next();
}

/**
 * Require minimum tier level
 */
export function requireTier(minTier: number) {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
    }

    // Admins bypass tier check
    const adminRoles = ['ADMIN', 'TEAM'];
    if (adminRoles.includes(user.role) || adminRoles.includes(user.userType)) {
      return next();
    }

    if (!user.tier || user.tier < minTier) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'TIER_REQUIRED',
          message: `This feature requires Tier ${minTier} or higher.`,
          requiredTier: minTier,
          currentTier: user.tier || 0,
        },
      });
    }

    next();
  };
}

/**
 * Require ownership of resource or admin
 */
export function requireOwnerOrAdmin(getOwnerId: (req: Request) => Promise<string | null>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
    }

    // Admins can access anything
    const adminRoles = ['ADMIN', 'TEAM'];
    if (adminRoles.includes(user.role) || adminRoles.includes(user.userType)) {
      return next();
    }

    try {
      const ownerId = await getOwnerId(req);

      if (!ownerId) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Resource not found.',
          },
        });
      }

      // Check if user owns the resource (by userId or clientId)
      if (ownerId !== user.userId && ownerId !== user.id && ownerId !== user.clientId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this resource.',
          },
        });
      }

      next();
    } catch (error) {
      console.error('[Auth] Error checking ownership:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'An error occurred during authorization.',
        },
      });
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default createAuthMiddleware;
