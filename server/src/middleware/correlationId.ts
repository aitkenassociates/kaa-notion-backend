/**
 * Correlation ID Middleware
 * Adds unique request IDs for distributed tracing and debugging.
 *
 * Features:
 * - Generates a unique correlation ID for each request
 * - Uses existing X-Correlation-ID header if provided
 * - Adds correlation ID to response headers
 * - Attaches correlation ID to request object for logging
 * - Supports parent-child request tracking
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface CorrelationIdConfig {
  /** Header name for the correlation ID (default: x-correlation-id) */
  headerName: string;
  /** Header name for parent correlation ID (for distributed tracing) */
  parentHeaderName: string;
  /** Generator function for new correlation IDs */
  generator: () => string;
  /** Whether to include the ID in response headers */
  includeInResponse: boolean;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      parentCorrelationId?: string;
    }
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: CorrelationIdConfig = {
  headerName: 'x-correlation-id',
  parentHeaderName: 'x-parent-correlation-id',
  generator: () => randomUUID(),
  includeInResponse: true,
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Correlation ID Middleware
 * Adds a unique correlation ID to each request for tracing
 */
export function correlationId(customConfig: Partial<CorrelationIdConfig> = {}) {
  const config = { ...DEFAULT_CONFIG, ...customConfig };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Use existing correlation ID from header or generate new one
    const existingId = req.headers[config.headerName] as string | undefined;
    const correlationId = existingId || config.generator();

    // Check for parent correlation ID (for distributed tracing)
    const parentId = req.headers[config.parentHeaderName] as string | undefined;

    // Attach to request object
    req.correlationId = correlationId;
    if (parentId) {
      req.parentCorrelationId = parentId;
    }

    // Add to response headers
    if (config.includeInResponse) {
      res.setHeader('X-Correlation-ID', correlationId);
      if (parentId) {
        res.setHeader('X-Parent-Correlation-ID', parentId);
      }
    }

    next();
  };
}

/**
 * Get correlation ID from request
 */
export function getCorrelationId(req: Request): string {
  return req.correlationId || '';
}

/**
 * Create a child correlation ID for async operations
 */
export function createChildCorrelationId(parentId: string): string {
  return `${parentId}:${randomUUID().slice(0, 8)}`;
}

/**
 * Create request context object for logging
 */
export function getRequestContext(req: Request): Record<string, unknown> {
  return {
    correlationId: req.correlationId,
    parentCorrelationId: req.parentCorrelationId,
    method: req.method,
    path: req.path,
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: req.headers['user-agent'],
  };
}

// ============================================================================
// ASYNC LOCAL STORAGE (for accessing correlation ID in async contexts)
// ============================================================================

import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  correlationId: string;
  parentCorrelationId?: string;
  userId?: string;
  userType?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Middleware that stores request context in AsyncLocalStorage
 * Allows accessing correlation ID from anywhere without passing request object
 */
export function asyncContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const context: RequestContext = {
    correlationId: req.correlationId,
    parentCorrelationId: req.parentCorrelationId,
    userId: req.headers['x-user-id'] as string | undefined,
    userType: req.headers['x-user-type'] as string | undefined,
  };

  asyncLocalStorage.run(context, () => {
    next();
  });
}

/**
 * Get the current request context from AsyncLocalStorage
 */
export function getAsyncContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get the current correlation ID from AsyncLocalStorage
 */
export function getCurrentCorrelationId(): string | undefined {
  return asyncLocalStorage.getStore()?.correlationId;
}

/**
 * Run a function with a specific context
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default correlationId;
