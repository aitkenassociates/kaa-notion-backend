/**
 * Validation Middleware
 * Express middleware for request validation using Zod schemas.
 * Middleware factory for validating request body, query, and params.
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { validationError } from '../utils/AppError';
import { formatZodErrors, getFirstError as getFirstErrorFromValidators } from '../utils/validators';

// ============================================================================
// TYPES
// ============================================================================

export type ValidationTarget = 'body' | 'query' | 'params';

export interface ValidatedRequest<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown
> extends Request {
  validatedBody: TBody;
  validatedQuery: TQuery;
  validatedParams: TParams;
}

export interface ValidationOptions {
  /** Whether to strip unknown keys from the data (default: true) */
  stripUnknown?: boolean;
  /** Custom error message prefix */
  errorPrefix?: string;
  /** Whether to include detailed field errors (default: true) */
  includeFieldErrors?: boolean;
  /** Abort on first error (default: false) */
  abortEarly?: boolean;
}

// ============================================================================
// ERROR FORMATTING
// ============================================================================

/**
 * Format Zod errors into a structured object (local copy for middleware)
 */
function formatZodErrorsLocal(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';

    if (!formatted[path]) {
      formatted[path] = [];
    }

    formatted[path].push(issue.message);
  }

  return formatted;
}

/**
 * Get a flat list of error messages
 */
export function getErrorMessages(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

/**
 * Get the first error message
 */
export function getFirstError(error: ZodError): string {
  const firstIssue = error.issues[0];
  if (!firstIssue) return 'Validation failed';

  const path = firstIssue.path.join('.');
  return path ? `${path}: ${firstIssue.message}` : firstIssue.message;
}

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Create validation middleware for a specific target
 */
export function validate(
  schema: ZodSchema,
  target: ValidationTarget = 'body',
  options: ValidationOptions = {}
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = req[target];

      // Parse and validate
      const result = schema.safeParse(data);

      if (!result.success) {
        const formattedErrors = formatZodErrorsLocal(result.error);
        throw validationError('Validation failed', formattedErrors);
      }

      // Replace request data with parsed/transformed data
      req[target] = result.data;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate request body against a Zod schema
 */
export function validateBody<T extends z.ZodSchema>(
  schema: T,
  options: ValidationOptions = {}
) {
  const { stripUnknown = true, errorPrefix, includeFieldErrors = true } = options;

  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const parseSchema = stripUnknown ? schema : schema;
    const result = parseSchema.safeParse(req.body);

    if (!result.success) {
      // Try to use imported formatters, fall back to local ones
      let formattedErrors: Record<string, string[]>;
      let firstError: string;

      try {
        formattedErrors = formatZodErrors(result.error);
        firstError = getFirstError(result.error);
      } catch {
        formattedErrors = formatZodErrorsLocal(result.error);
        firstError = getFirstError(result.error);
      }

      const message = errorPrefix
        ? `${errorPrefix}: ${firstError}`
        : firstError;

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message,
          ...(includeFieldErrors && { fields: formattedErrors }),
        },
      });
    }

    (req as ValidatedRequest<z.infer<T>>).validatedBody = result.data;
    next();
  };
}

/**
 * Validate request query parameters against a Zod schema
 */
export function validateQuery<T extends z.ZodSchema>(
  schema: T,
  options: ValidationOptions = {}
) {
  const { stripUnknown = true, errorPrefix, includeFieldErrors = true } = options;

  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const parseSchema = stripUnknown ? schema : schema;
    const result = parseSchema.safeParse(req.query);

    if (!result.success) {
      let formattedErrors: Record<string, string[]>;
      let firstError: string;

      try {
        formattedErrors = formatZodErrors(result.error);
        firstError = getFirstError(result.error);
      } catch {
        formattedErrors = formatZodErrorsLocal(result.error);
        firstError = getFirstError(result.error);
      }

      const message = errorPrefix
        ? `${errorPrefix}: ${firstError}`
        : `Invalid query parameters: ${firstError}`;

      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message,
          ...(includeFieldErrors && { fields: formattedErrors }),
        },
      });
    }

    (req as ValidatedRequest<unknown, z.infer<T>>).validatedQuery = result.data;
    next();
  };
}

/**
 * Validate request URL parameters against a Zod schema
 */
export function validateParams<T extends z.ZodSchema>(
  schema: T,
  options: ValidationOptions = {}
) {
  const { stripUnknown = true, errorPrefix, includeFieldErrors = true } = options;

  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const parseSchema = stripUnknown ? schema : schema;
    const result = parseSchema.safeParse(req.params);

    if (!result.success) {
      let formattedErrors: Record<string, string[]>;
      let firstError: string;

      try {
        formattedErrors = formatZodErrors(result.error);
        firstError = getFirstError(result.error);
      } catch {
        formattedErrors = formatZodErrorsLocal(result.error);
        firstError = getFirstError(result.error);
      }

      const message = errorPrefix
        ? `${errorPrefix}: ${firstError}`
        : `Invalid URL parameters: ${firstError}`;

      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message,
          ...(includeFieldErrors && { fields: formattedErrors }),
        },
      });
    }

    (req as ValidatedRequest<unknown, unknown, z.infer<T>>).validatedParams = result.data;
    next();
  };
}

/**
 * Validate multiple parts of the request at once (returns Response on error)
 */
export function validateRequest<
  TBody extends z.ZodSchema | undefined = undefined,
  TQuery extends z.ZodSchema | undefined = undefined,
  TParams extends z.ZodSchema | undefined = undefined
>(schemas: {
  body?: TBody;
  query?: TQuery;
  params?: TParams;
}, options: ValidationOptions = {}) {
  const { includeFieldErrors = true } = options;

  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const errors: Record<string, Record<string, string[]>> = {};

    // Validate body
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.body = formatZodErrorsLocal(result.error);
      } else {
        (req as ValidatedRequest).validatedBody = result.data;
      }
    }

    // Validate query
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.query = formatZodErrorsLocal(result.error);
      } else {
        (req as ValidatedRequest).validatedQuery = result.data;
      }
    }

    // Validate params
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.params = formatZodErrorsLocal(result.error);
      } else {
        (req as ValidatedRequest).validatedParams = result.data;
      }
    }

    // Return errors if any
    if (Object.keys(errors).length > 0) {
      // Get first error message
      const firstSection = Object.keys(errors)[0] as keyof typeof errors;
      const firstField = Object.keys(errors[firstSection]!)[0];
      const firstMessage = errors[firstSection]![firstField][0];

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Validation failed: ${firstMessage}`,
          ...(includeFieldErrors && { fields: errors }),
        },
      });
    }

    next();
  };
}

/**
 * Validate multiple targets (throws error, uses next for error handling)
 */
export function validateAll(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const errors: Record<string, unknown> = {};

      // Validate each target
      for (const [target, schema] of Object.entries(schemas)) {
        if (!schema) continue;

        const data = req[target as ValidationTarget];
        const result = schema.safeParse(data);

        if (!result.success) {
          errors[target] = formatZodErrorsLocal(result.error);
        } else {
          req[target as ValidationTarget] = result.data;
        }
      }

      if (Object.keys(errors).length > 0) {
        throw validationError('Validation failed', errors);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// ============================================================================
// COMMON PARAM SCHEMAS
// ============================================================================

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
});

export const leadIdParamSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID format'),
});

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  validateRequest,
  validateAll,
  getErrorMessages,
  idParamSchema,
  projectIdParamSchema,
  leadIdParamSchema,
};
