/**
 * Environment Configuration & Validation
 * Validates required environment variables at startup.
 */

import { z } from 'zod';
import { logger } from '../logger';

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

/**
 * Required environment variables schema
 */
const requiredEnvSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),

  // Database (required)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT Authentication (required)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

/**
 * Optional environment variables schema
 */
const optionalEnvSchema = z.object({
  // Stripe (optional but recommended)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_SUCCESS_URL: z.string().url().optional(),
  STRIPE_CANCEL_URL: z.string().url().optional(),

  // Notion (optional)
  NOTION_API_KEY: z.string().optional(),
  NOTION_PROJECTS_DATABASE_ID: z.string().optional(),

  // Supabase Storage (optional)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  STORAGE_BUCKET: z.string().default('deliverables'),
  MAX_FILE_SIZE_MB: z.string().default('50').transform(Number),

  // Email (optional - falls back to console)
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_SECURE: z.string().transform(v => v === 'true').optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('SAGE <hello@sage.design>'),
  EMAIL_REPLY_TO: z.string().default('support@sage.design'),

  // Frontend & CORS
  FRONTEND_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).optional(),
  SERVICE_NAME: z.string().default('sage-api'),

  // API Docs
  ENABLE_API_DOCS: z.string().transform(v => v === 'true').optional(),

  // Figma (legacy)
  FIGMA_ACCESS_TOKEN: z.string().optional(),
});

// Combined schema
const envSchema = requiredEnvSchema.merge(optionalEnvSchema);

// ============================================================================
// TYPES
// ============================================================================

export type Environment = z.infer<typeof envSchema>;

export interface ValidationResult {
  valid: boolean;
  config?: Environment;
  errors?: string[];
  warnings?: string[];
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate environment variables
 */
export function validateEnvironment(): ValidationResult {
  const warnings: string[] = [];
  
  // Parse and validate
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map(issue => {
      const path = issue.path.join('.');
      return `${path}: ${issue.message}`;
    });
    
    return {
      valid: false,
      errors,
    };
  }

  const config = result.data;

  // Production-specific warnings
  if (config.NODE_ENV === 'production') {
    if (!config.STRIPE_SECRET_KEY) {
      warnings.push('STRIPE_SECRET_KEY not set - payments will not work');
    }
    if (!config.STRIPE_WEBHOOK_SECRET) {
      warnings.push('STRIPE_WEBHOOK_SECRET not set - webhooks will not be verified');
    }
    if (!config.RESEND_API_KEY && !config.SMTP_HOST) {
      warnings.push('No email provider configured - emails will be logged to console');
    }
    if (config.JWT_SECRET === 'development-secret-key' || config.JWT_SECRET.length < 64) {
      warnings.push('JWT_SECRET appears to be weak - use a strong random secret in production');
    }
    if (!config.FRONTEND_URL) {
      warnings.push('FRONTEND_URL not set - email links may not work correctly');
    }

    // Database SSL enforcement for production
    const dbUrl = config.DATABASE_URL.toLowerCase();
    if (!dbUrl.includes('sslmode=require') && !dbUrl.includes('ssl=true') && !dbUrl.includes('sslmode=verify')) {
      warnings.push(
        'DATABASE_URL does not include SSL mode - add ?sslmode=require for encrypted connections. ' +
        'Example: postgres://user:pass@host:5432/db?sslmode=require'
      );
    }

    // Check for non-secure database connections
    if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
      warnings.push('DATABASE_URL points to localhost in production - this is likely a misconfiguration');
    }
  }

  // Development warnings
  if (config.NODE_ENV === 'development') {
    if (!config.DATABASE_URL.includes('localhost') && !config.DATABASE_URL.includes('127.0.0.1')) {
      warnings.push('DATABASE_URL points to non-local database in development mode');
    }
  }

  return {
    valid: true,
    config,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate and log environment on startup
 */
export function initEnvironment(): Environment {
  logger.info('Validating environment configuration...');
  
  const result = validateEnvironment();

  if (!result.valid) {
    logger.error('Environment validation failed', { errors: result.errors });
    logger.error('Environment validation failed', {
      errors: result.errors?.map((err) => `• ${err}`),
    });
    logger.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  // Log warnings
  if (result.warnings && result.warnings.length > 0) {
    logger.warn('Environment warnings detected', { warnings: result.warnings });
    logger.warn('Environment warnings', {
      warnings: result.warnings.map((warn) => `• ${warn}`),
    });
  }

  logger.info('Environment validation passed', {
    environment: result.config!.NODE_ENV,
    port: result.config!.PORT,
  });

  return result.config!;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a type-safe environment variable
 */
export function getEnv<K extends keyof Environment>(key: K): Environment[K] {
  const result = validateEnvironment();
  if (!result.valid || !result.config) {
    throw new Error(`Environment not valid: ${result.errors?.join(', ')}`);
  }
  return result.config[key];
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Get feature flags from environment
 */
export function getFeatureFlags(): {
  apiDocsEnabled: boolean;
  notionEnabled: boolean;
  storageEnabled: boolean;
  emailEnabled: boolean;
  stripeEnabled: boolean;
} {
  return {
    apiDocsEnabled: process.env.ENABLE_API_DOCS === 'true' || isDevelopment(),
    notionEnabled: !!process.env.NOTION_API_KEY,
    storageEnabled: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_KEY,
    emailEnabled: !!process.env.RESEND_API_KEY || !!process.env.SMTP_HOST,
    stripeEnabled: !!process.env.STRIPE_SECRET_KEY,
  };
}
