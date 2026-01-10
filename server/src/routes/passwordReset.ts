/**
 * Password Reset Routes
 *
 * Handles password reset flow:
 * 1. POST /api/auth/forgot-password - Request reset token
 * 2. POST /api/auth/reset-password - Reset password with token
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { z } from 'zod';
import { sendPasswordResetEmail } from '../services/emailService';
import { logger } from '../config/logger';
import { passwordResetRateLimit } from '../middleware/rateLimit';

const router = Router();
const prisma = new PrismaClient();

// Token expiry time (1 hour)
const TOKEN_EXPIRY_MS = 60 * 60 * 1000;
const TOKEN_EXPIRY_DISPLAY = '1 hour';

// Store reset tokens (in production, use Redis or database)
interface ResetToken {
  userId: string;
  email: string;
  expiresAt: Date;
}

const resetTokens = new Map<string, ResetToken>();

// Cleanup expired tokens periodically
setInterval(() => {
  const now = new Date();
  for (const [token, data] of resetTokens.entries()) {
    if (data.expiresAt < now) {
      resetTokens.delete(token);
    }
  }
}, 60000); // Every minute

// ========================================
// Validation Schemas
// ========================================

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// ========================================
// Password Hashing
// ========================================

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ========================================
// Routes
// ========================================

/**
 * POST /api/auth/forgot-password
 *
 * Request a password reset email.
 * Always returns success to prevent email enumeration.
 */
router.post('/forgot-password', passwordResetRateLimit, async (req: Request, res: Response) => {
  try {
    const validation = forgotPasswordSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error.issues[0].message,
        },
      });
    }

    const { email } = validation.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true },
    });

    // Always respond with success to prevent email enumeration
    const successResponse = {
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
    };

    if (!user) {
      logger.info('Password reset requested for non-existent email', { email });
      return res.json(successResponse);
    }

    // Generate reset token
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    // Store token
    resetTokens.set(token, {
      userId: user.id,
      email: user.email!,
      expiresAt,
    });

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    const emailResult = await sendPasswordResetEmail({
      to: user.email!,
      name: user.name || 'User',
      resetUrl,
      expiresIn: TOKEN_EXPIRY_DISPLAY,
    });

    if (!emailResult.success) {
      logger.error('Failed to send password reset email', { email, error: emailResult.error });
      // Still return success to prevent email enumeration
    } else {
      logger.info('Password reset email sent', { email, userId: user.id });
    }

    return res.json(successResponse);
  } catch (error) {
    logger.error('Forgot password error', {}, error as Error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred. Please try again later.',
      },
    });
  }
});

/**
 * POST /api/auth/reset-password
 *
 * Reset password using the token from the email.
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const validation = resetPasswordSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error.issues[0].message,
          details: validation.error.issues,
        },
      });
    }

    const { token, password } = validation.data;

    // Find and validate token
    const tokenData = resetTokens.get(token);

    if (!tokenData) {
      logger.warn('Invalid password reset token used');
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'This password reset link is invalid or has expired.',
        },
      });
    }

    // Check expiry
    if (tokenData.expiresAt < new Date()) {
      resetTokens.delete(token);
      logger.info('Expired password reset token used', { email: tokenData.email });
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'This password reset link has expired. Please request a new one.',
        },
      });
    }

    // Hash new password
    const passwordHash = hashPassword(password);

    // Update user password
    await prisma.user.update({
      where: { id: tokenData.userId },
      data: { passwordHash },
    });

    // Delete used token
    resetTokens.delete(token);

    // Invalidate all tokens for this user (security measure)
    for (const [t, data] of resetTokens.entries()) {
      if (data.userId === tokenData.userId) {
        resetTokens.delete(t);
      }
    }

    logger.info('Password reset successful', { userId: tokenData.userId, email: tokenData.email });

    return res.json({
      success: true,
      message: 'Your password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    logger.error('Reset password error', {}, error as Error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred. Please try again later.',
      },
    });
  }
});

/**
 * GET /api/auth/verify-reset-token
 *
 * Verify if a reset token is valid (optional - for frontend validation).
 */
router.get('/verify-reset-token', async (req: Request, res: Response) => {
  const token = req.query.token as string;

  if (!token) {
    return res.status(400).json({
      success: false,
      valid: false,
      error: 'Token is required',
    });
  }

  const tokenData = resetTokens.get(token);

  if (!tokenData || tokenData.expiresAt < new Date()) {
    return res.json({
      success: true,
      valid: false,
    });
  }

  return res.json({
    success: true,
    valid: true,
    email: tokenData.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email
  });
});

export default router;
