/**
 * Auth Service
 * Handles user authentication, registration, and JWT token management.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient, User, UserType } from '@prisma/client';
import { sendPasswordResetEmail } from './emailService';
import { logger } from '../logger';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  saltRounds: number;
}

export interface TokenPayload {
  userId: string;
  email: string;
  userType: UserType;
  tier?: number;
  type: 'access' | 'refresh';
}

export interface AuthResult {
  user: Pick<User, 'id' | 'email' | 'userType' | 'tier'>;
  token: string;
  refreshToken?: string;
  expiresIn: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  userType?: UserType;
  tier?: number;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

let authConfig: AuthConfig = {
  jwtSecret: process.env.JWT_SECRET || 'development-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m', // Short-lived access token
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d', // Long-lived refresh token
  saltRounds: 12,
};

export function initAuthService(config: Partial<AuthConfig>): void {
  authConfig = { ...authConfig, ...config };
}

export function getAuthConfig(): AuthConfig {
  return authConfig;
}

// ============================================================================
// PASSWORD HASHING
// ============================================================================

/**
 * Hash a password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, authConfig.saltRounds);
}

/**
 * Compare a plain password with a hash.
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Generate an access token for a user.
 */
export function generateToken(payload: Omit<TokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    authConfig.jwtSecret, 
    { expiresIn: authConfig.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
  );
}

/**
 * Generate a refresh token for a user.
 */
export function generateRefreshToken(payload: Omit<TokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    authConfig.jwtSecret,
    { expiresIn: authConfig.refreshTokenExpiresIn as jwt.SignOptions['expiresIn'] }
  );
}

/**
 * Verify and decode a JWT token.
 */
export function verifyToken(token: string, expectedType: 'access' | 'refresh' = 'access'): TokenPayload {
  try {
    const payload = jwt.verify(token, authConfig.jwtSecret) as TokenPayload;
    
    // Backward compatibility: tokens without type are treated as access tokens
    const tokenType = payload.type || 'access';
    
    if (tokenType !== expectedType) {
      throw new Error(`Invalid token type: expected ${expectedType}`);
    }
    
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Extract token from Authorization header.
 */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  
  const [type, token] = authHeader.split(' ');
  if (type.toLowerCase() !== 'bearer' || !token) return null;
  
  return token;
}

// ============================================================================
// USER REGISTRATION
// ============================================================================

/**
 * Register a new user.
 */
export async function registerUser(
  prisma: PrismaClient,
  input: RegisterInput
): Promise<AuthResult> {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(input.password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash,
      userType: input.userType || 'SAGE_CLIENT',
      tier: input.tier,
    },
  });

  // Generate tokens - use email we just set (we know it's not null)
  const tokenPayload = {
    userId: user.id,
    email: user.email!, // We just created this user with an email
    userType: user.userType,
    tier: user.tier || undefined,
  };
  
  const token = generateToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  return {
    user: {
      id: user.id,
      email: user.email!,
      userType: user.userType,
      tier: user.tier,
    },
    token,
    refreshToken,
    expiresIn: authConfig.jwtExpiresIn,
  };
}

// ============================================================================
// USER LOGIN
// ============================================================================

/**
 * Authenticate a user with email and password.
 */
export async function loginUser(
  prisma: PrismaClient,
  input: LoginInput
): Promise<AuthResult> {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Verify password
  const isValid = await comparePassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  // Generate tokens - user found by email so it exists
  const tokenPayload = {
    userId: user.id,
    email: user.email!, // User was found by email, so it exists
    userType: user.userType,
    tier: user.tier || undefined,
  };
  
  const token = generateToken(tokenPayload);
  
  // Only generate refresh token if rememberMe is enabled
  const refreshToken = input.rememberMe ? generateRefreshToken(tokenPayload) : undefined;

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  return {
    user: {
      id: user.id,
      email: user.email!,
      userType: user.userType,
      tier: user.tier,
    },
    token,
    refreshToken,
    expiresIn: authConfig.jwtExpiresIn,
  };
}

// ============================================================================
// USER PROFILE
// ============================================================================

export interface UserProfile {
  id: string;
  email: string | null;
  userType: UserType;
  tier: number | null;
  client?: {
    id: string;
    status: string;
    projectAddress: string | null;
  } | null;
  projects?: {
    id: string;
    name: string;
    status: string;
    tier: number;
  }[];
  createdAt: Date;
}

/**
 * Get the current user's profile with client and project info.
 */
export async function getUserProfile(
  prisma: PrismaClient,
  userId: string
): Promise<UserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      client: {
        include: {
          projects: {
            select: {
              id: true,
              name: true,
              status: true,
              tier: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return {
    id: user.id,
    email: user.email,
    userType: user.userType,
    tier: user.tier,
    client: user.client ? {
      id: user.client.id,
      status: user.client.status,
      projectAddress: user.client.projectAddress,
    } : null,
    projects: user.client?.projects || [],
    createdAt: user.createdAt,
  };
}

// ============================================================================
// TOKEN REFRESH
// ============================================================================

export interface RefreshResult {
  token: string;
  refreshToken: string;
  expiresIn: string;
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(
  prisma: PrismaClient,
  refreshToken: string
): Promise<RefreshResult> {
  // Verify the refresh token
  const payload = verifyToken(refreshToken, 'refresh');
  
  // Verify user still exists and is active
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Generate new tokens
  const tokenPayload = {
    userId: user.id,
    email: user.email!,
    userType: user.userType,
    tier: user.tier || undefined,
  };

  const newAccessToken = generateToken(tokenPayload);
  const newRefreshToken = generateRefreshToken(tokenPayload);

  return {
    token: newAccessToken,
    refreshToken: newRefreshToken,
    expiresIn: authConfig.jwtExpiresIn,
  };
}

// ============================================================================
// PASSWORD RESET
// ============================================================================

// Password reset token expiration time
const PASSWORD_RESET_EXPIRES_IN = '1h'; // 1 hour
const PASSWORD_RESET_EXPIRES_MINUTES = 60;

interface PasswordResetPayload {
  userId: string;
  email: string;
  type: 'password_reset';
  jti: string; // Unique token ID to prevent reuse
}

// In-memory store for used reset tokens (in production, use Redis)
const usedResetTokens = new Set<string>();

/**
 * Generate a password reset token
 */
function generatePasswordResetToken(userId: string, email: string): string {
  const jti = crypto.randomUUID(); // Unique token ID

  return jwt.sign(
    {
      userId,
      email,
      type: 'password_reset',
      jti,
    } as PasswordResetPayload,
    authConfig.jwtSecret,
    { expiresIn: PASSWORD_RESET_EXPIRES_IN }
  );
}

/**
 * Verify a password reset token
 */
function verifyPasswordResetToken(token: string): PasswordResetPayload {
  try {
    const payload = jwt.verify(token, authConfig.jwtSecret) as PasswordResetPayload;

    if (payload.type !== 'password_reset') {
      throw new Error('Invalid token type');
    }

    // Check if token has already been used
    if (usedResetTokens.has(payload.jti)) {
      throw new Error('Token has already been used');
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Password reset link has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid password reset link');
    }
    throw error;
  }
}

/**
 * Mark a reset token as used (prevent reuse)
 */
function markResetTokenAsUsed(jti: string): void {
  usedResetTokens.add(jti);

  // Clean up old tokens periodically (keep set from growing indefinitely)
  // In production, this would use Redis with TTL
  if (usedResetTokens.size > 10000) {
    const tokens = Array.from(usedResetTokens);
    tokens.slice(0, 5000).forEach(t => usedResetTokens.delete(t));
  }
}

/**
 * Initiate password reset - generates a reset token and sends email.
 */
export async function initiatePasswordReset(
  prisma: PrismaClient,
  email: string
): Promise<{ message: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Always return success message to prevent email enumeration
  const successMessage = 'If an account exists with this email, you will receive a password reset link';

  if (!user) {
    logger.info('Password reset requested for non-existent email', {
      email: normalizedEmail.substring(0, 3) + '***' // Partial email for debugging
    });
    return { message: successMessage };
  }

  // Generate reset token
  const resetToken = generatePasswordResetToken(user.id, normalizedEmail);

  // Send email
  try {
    const result = await sendPasswordResetEmail({
      to: normalizedEmail,
      name: user.name || 'User',
      resetToken,
      expiresInMinutes: PASSWORD_RESET_EXPIRES_MINUTES,
    });

    if (!result.success) {
      logger.error('Failed to send password reset email', {
        userId: user.id,
        error: result.error
      });
      // Don't reveal email delivery failure to prevent enumeration
    } else {
      logger.info('Password reset email sent', { userId: user.id });
    }
  } catch (error) {
    logger.error('Error sending password reset email', {
      userId: user.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    // Don't reveal email delivery failure to prevent enumeration
  }

  return { message: successMessage };
}

/**
 * Complete password reset with a new password.
 */
export async function completePasswordReset(
  prisma: PrismaClient,
  resetToken: string,
  newPassword: string
): Promise<{ message: string }> {
  // Validate new password
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  // Verify the reset token
  const payload = verifyPasswordResetToken(resetToken);

  // Find the user
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Verify email matches (extra security check)
  if (user.email?.toLowerCase() !== payload.email.toLowerCase()) {
    throw new Error('Invalid password reset link');
  }

  // Hash the new password
  const passwordHash = await hashPassword(newPassword);

  // Update the password
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  // Mark token as used to prevent reuse
  markResetTokenAsUsed(payload.jti);

  logger.info('Password reset completed', { userId: user.id });

  return { message: 'Password has been reset successfully' };
}
