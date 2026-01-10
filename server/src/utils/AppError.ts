/**
 * AppError - Custom Error Class
 *
 * Provides a standardized error class with:
 * - HTTP status code
 * - Error code for programmatic handling
 * - Human-readable message
 * - Optional details for debugging
 * - Optional field-level errors for validation
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ErrorDetails {
  [key: string]: unknown;
}

export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

export interface SerializedError {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode?: number;
    details?: ErrorDetails | Record<string, unknown> | string;
    fieldErrors?: FieldError[];
    timestamp?: string;
    stack?: string;
  };
}

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  statusCode?: number;
  details?: ErrorDetails | Record<string, unknown> | string;
  fieldErrors?: FieldError[];
  isOperational?: boolean;
  cause?: Error;
}

// ============================================================================
// ERROR CODES
// ============================================================================

export const ErrorCodes = {
  // Authentication & Authorization (401, 403)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  NO_TOKEN: 'NO_TOKEN',
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_TIER: 'INSUFFICIENT_TIER',
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Validation (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',

  // Resource (404, 409)
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  LEAD_NOT_FOUND: 'LEAD_NOT_FOUND',
  DELIVERABLE_NOT_FOUND: 'DELIVERABLE_NOT_FOUND',
  MILESTONE_NOT_FOUND: 'MILESTONE_NOT_FOUND',
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  CONFLICT: 'CONFLICT',

  // Business Logic (400, 422)
  INVALID_STATE: 'INVALID_STATE',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  LEAD_ALREADY_CONVERTED: 'LEAD_ALREADY_CONVERTED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',

  // External Services (502, 503)
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  STRIPE_ERROR: 'STRIPE_ERROR',
  STRIPE_UNAVAILABLE: 'STRIPE_UNAVAILABLE',
  NOTION_ERROR: 'NOTION_ERROR',
  NOTION_UNAVAILABLE: 'NOTION_UNAVAILABLE',
  STORAGE_ERROR: 'STORAGE_ERROR',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Rate Limiting (429)
  RATE_LIMITED: 'RATE_LIMITED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // Server (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ============================================================================
// HTTP STATUS MAPPING
// ============================================================================

const ERROR_STATUS_MAP: Partial<Record<ErrorCode, number>> = {
  // 401 Unauthorized
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.INVALID_TOKEN]: 401,
  [ErrorCodes.TOKEN_EXPIRED]: 401,
  [ErrorCodes.NO_TOKEN]: 401,
  [ErrorCodes.INVALID_CREDENTIALS]: 401,

  // 403 Forbidden
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.INSUFFICIENT_TIER]: 403,
  [ErrorCodes.ADMIN_REQUIRED]: 403,

  // 400 Bad Request
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.INVALID_INPUT]: 400,
  [ErrorCodes.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCodes.MISSING_FIELD]: 400,
  [ErrorCodes.INVALID_FORMAT]: 400,
  [ErrorCodes.INVALID_FILE_TYPE]: 400,
  [ErrorCodes.FILE_TOO_LARGE]: 400,
  [ErrorCodes.INVALID_STATE]: 400,
  [ErrorCodes.INVALID_TRANSITION]: 400,

  // 404 Not Found
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.RESOURCE_NOT_FOUND]: 404,
  [ErrorCodes.USER_NOT_FOUND]: 404,
  [ErrorCodes.PROJECT_NOT_FOUND]: 404,
  [ErrorCodes.CLIENT_NOT_FOUND]: 404,
  [ErrorCodes.LEAD_NOT_FOUND]: 404,
  [ErrorCodes.MILESTONE_NOT_FOUND]: 404,
  [ErrorCodes.DELIVERABLE_NOT_FOUND]: 404,

  // 409 Conflict
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.ALREADY_EXISTS]: 409,
  [ErrorCodes.DUPLICATE_ENTRY]: 409,
  [ErrorCodes.DUPLICATE_EMAIL]: 409,

  // 422 Unprocessable Entity
  [ErrorCodes.OPERATION_NOT_ALLOWED]: 422,
  [ErrorCodes.LEAD_ALREADY_CONVERTED]: 422,
  [ErrorCodes.PAYMENT_REQUIRED]: 422,
  [ErrorCodes.PAYMENT_FAILED]: 422,

  // 429 Too Many Requests
  [ErrorCodes.RATE_LIMITED]: 429,
  [ErrorCodes.TOO_MANY_REQUESTS]: 429,

  // 500 Internal Server Error
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.UNKNOWN_ERROR]: 500,
  [ErrorCodes.DATABASE_ERROR]: 500,
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 502,

  // 503 Service Unavailable
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.NOTION_UNAVAILABLE]: 503,
  [ErrorCodes.STORAGE_UNAVAILABLE]: 503,
  [ErrorCodes.STRIPE_UNAVAILABLE]: 503,
  [ErrorCodes.NOTION_ERROR]: 502,
  [ErrorCodes.STORAGE_ERROR]: 502,
  [ErrorCodes.STRIPE_ERROR]: 502,
};

// ============================================================================
// APP ERROR CLASS
// ============================================================================

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: ErrorDetails | Record<string, unknown> | string;
  public readonly fieldErrors?: FieldError[];
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly originalCause?: Error;
  public readonly cause?: Error; // ES2022 Error cause property

  constructor(
    codeOrOptions: ErrorCode | AppErrorOptions,
    message?: string,
    statusCode?: number,
    options?: {
      details?: ErrorDetails | Record<string, unknown> | string;
      fieldErrors?: FieldError[];
      isOperational?: boolean;
      cause?: Error;
    }
  ) {
    // Handle both constructor signatures
    if (typeof codeOrOptions === 'object') {
      // New style: AppErrorOptions object
      const opts = codeOrOptions as AppErrorOptions;
      super(opts.message);
      this.code = opts.code;
      this.statusCode = opts.statusCode ?? ERROR_STATUS_MAP[opts.code] ?? 500;
      this.details = opts.details;
      this.fieldErrors = opts.fieldErrors;
      this.isOperational = opts.isOperational ?? true;
      this.originalCause = opts.cause;
    } else {
      // Old style: separate parameters
      super(message || 'An error occurred');
      this.code = codeOrOptions;
      this.statusCode = statusCode ?? ERROR_STATUS_MAP[codeOrOptions] ?? 500;
      this.details = options?.details;
      this.fieldErrors = options?.fieldErrors;
      this.isOperational = options?.isOperational ?? true;
      if (options?.cause) {
        this.originalCause = options.cause;
        this.cause = options.cause;
      }
    }

    this.name = 'AppError';
    this.timestamp = new Date();

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serialize error for API response
   */
  toJSON(includeStack = false): SerializedError {
    const error: SerializedError = {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        timestamp: this.timestamp.toISOString(),
      },
    };

    if (this.details && (typeof this.details === 'string' || Object.keys(this.details).length > 0)) {
      error.error.details = this.details;
    }

    if (this.fieldErrors && this.fieldErrors.length > 0) {
      error.error.fieldErrors = this.fieldErrors;
    }

    if (includeStack && this.stack) {
      error.error.stack = this.stack;
    }

    return error;
  }

  /**
   * Log format for console/file logging
   */
  toLogFormat(): string {
    const parts = [
      `[${this.timestamp.toISOString()}]`,
      `[${this.code}]`,
      `[${this.statusCode}]`,
      this.message,
    ];

    if (this.details) {
      parts.push(`Details: ${JSON.stringify(this.details)}`);
    }

    if (this.fieldErrors) {
      parts.push(`Fields: ${JSON.stringify(this.fieldErrors)}`);
    }

    return parts.join(' ');
  }

  /**
   * Check if error is a specific type
   */
  is(code: ErrorCode): boolean {
    return this.code === code;
  }

  /**
   * Check if error is an authentication error
   */
  isAuthError(): boolean {
    const authCodes: ErrorCode[] = [
      ErrorCodes.UNAUTHORIZED,
      ErrorCodes.INVALID_TOKEN,
      ErrorCodes.TOKEN_EXPIRED,
      ErrorCodes.NO_TOKEN,
      ErrorCodes.INVALID_CREDENTIALS,
    ];
    return authCodes.includes(this.code);
  }

  /**
   * Check if error is an authorization error
   */
  isAuthzError(): boolean {
    const authzCodes: ErrorCode[] = [
      ErrorCodes.FORBIDDEN,
      ErrorCodes.INSUFFICIENT_TIER,
      ErrorCodes.ADMIN_REQUIRED,
    ];
    return authzCodes.includes(this.code);
  }

  /**
   * Check if error is a validation error
   */
  isValidationError(): boolean {
    const validationCodes: ErrorCode[] = [
      ErrorCodes.VALIDATION_ERROR,
      ErrorCodes.INVALID_INPUT,
      ErrorCodes.MISSING_FIELD,
      ErrorCodes.MISSING_REQUIRED_FIELD,
      ErrorCodes.INVALID_FORMAT,
    ];
    return validationCodes.includes(this.code);
  }

  /**
   * Check if error is a not found error
   */
  isNotFoundError(): boolean {
    return this.statusCode === 404;
  }
}

// ============================================================================
// ERROR FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a 400 Bad Request error
 */
export function badRequest(
  message: string,
  code: ErrorCode = ErrorCodes.INVALID_INPUT,
  details?: ErrorDetails
): AppError {
  return new AppError(code, message, 400, { details });
}

/**
 * Create a 401 Unauthorized error
 */
export function unauthorized(
  message = 'Authentication required',
  code: ErrorCode = ErrorCodes.UNAUTHORIZED
): AppError {
  return new AppError(code, message, 401);
}

/**
 * Create an invalid token error
 */
export function invalidToken(message = 'Invalid authentication token'): AppError {
  return new AppError({
    code: ErrorCodes.INVALID_TOKEN,
    message,
  });
}

/**
 * Create a token expired error
 */
export function tokenExpired(message = 'Authentication token has expired'): AppError {
  return new AppError({
    code: ErrorCodes.TOKEN_EXPIRED,
    message,
  });
}

/**
 * Create a 403 Forbidden error
 */
export function forbidden(
  message = 'Access denied',
  code: ErrorCode = ErrorCodes.FORBIDDEN,
  details?: ErrorDetails
): AppError {
  return new AppError(code, message, 403, { details });
}

/**
 * Create an insufficient tier error
 */
export function insufficientTier(requiredTier: number, currentTier: number): AppError {
  return new AppError({
    code: ErrorCodes.INSUFFICIENT_TIER,
    message: `This feature requires Tier ${requiredTier} or higher`,
    details: { requiredTier, currentTier },
  });
}

/**
 * Create an admin required error
 */
export function adminRequired(message = 'Admin access required'): AppError {
  return new AppError({
    code: ErrorCodes.ADMIN_REQUIRED,
    message,
  });
}

/**
 * Create a 404 Not Found error
 */
export function notFound(
  resource = 'Resource',
  code: ErrorCode = ErrorCodes.NOT_FOUND,
  id?: string
): AppError {
  const resourceCodes: Record<string, ErrorCode> = {
    user: ErrorCodes.USER_NOT_FOUND,
    project: ErrorCodes.PROJECT_NOT_FOUND,
    client: ErrorCodes.CLIENT_NOT_FOUND,
    lead: ErrorCodes.LEAD_NOT_FOUND,
    milestone: ErrorCodes.MILESTONE_NOT_FOUND,
    deliverable: ErrorCodes.DELIVERABLE_NOT_FOUND,
  };

  const errorCode = resourceCodes[resource.toLowerCase()] || code;
  const message = id
    ? `${resource} with ID ${id} not found`
    : `${resource} not found`;

  return new AppError(errorCode, message, 404);
}

/**
 * Create a 409 Conflict error
 */
export function conflict(
  message: string,
  code: ErrorCode = ErrorCodes.CONFLICT,
  details?: ErrorDetails
): AppError {
  return new AppError(code, message, 409, { details });
}

/**
 * Create a 422 Unprocessable Entity error
 */
export function unprocessableEntity(
  message: string,
  code: ErrorCode = ErrorCodes.INVALID_STATE,
  details?: ErrorDetails
): AppError {
  return new AppError(code, message, 422, { details });
}

/**
 * Create a 429 Too Many Requests error
 */
export function rateLimited(
  message = 'Too many requests, please try again later',
  retryAfter?: number
): AppError {
  return new AppError(ErrorCodes.RATE_LIMITED, message, 429, {
    details: retryAfter ? { retryAfter } : undefined,
  });
}

/**
 * Create a 500 Internal Server error
 */
export function internalError(
  message = 'An unexpected error occurred',
  cause?: Error
): AppError {
  return new AppError(ErrorCodes.INTERNAL_ERROR, message, 500, {
    isOperational: false,
    cause,
  });
}

/**
 * Create a 502 Bad Gateway error (external service failure)
 */
export function externalServiceError(
  service: string,
  message?: string,
  cause?: Error
): AppError {
  return new AppError(
    ErrorCodes.EXTERNAL_SERVICE_ERROR,
    message || `${service} service is unavailable`,
    502,
    {
      details: { service },
      cause,
    }
  );
}

/**
 * Create a 503 Service Unavailable error
 */
export function serviceUnavailable(
  service: string,
  retryAfter?: number
): AppError {
  const serviceCodes: Record<string, ErrorCode> = {
    notion: ErrorCodes.NOTION_UNAVAILABLE,
    storage: ErrorCodes.STORAGE_UNAVAILABLE,
    stripe: ErrorCodes.STRIPE_UNAVAILABLE,
  };

  const code = serviceCodes[service.toLowerCase()] || ErrorCodes.SERVICE_UNAVAILABLE;

  return new AppError(code, `${service} service is currently unavailable`, 503, {
    details: retryAfter ? { retryAfter } : undefined,
  });
}

/**
 * Create a validation error with field-level errors
 */
export function validationError(
  fieldErrorsOrMessage: FieldError[] | string,
  detailsOrMessage?: Record<string, unknown> | string
): AppError {
  // Handle both signatures: (FieldError[], message?) and (message, details?)
  if (Array.isArray(fieldErrorsOrMessage)) {
    const message = typeof detailsOrMessage === 'string' ? detailsOrMessage : 'Validation failed';
    return new AppError(ErrorCodes.VALIDATION_ERROR, message, 400, {
      fieldErrors: fieldErrorsOrMessage,
    });
  } else {
    const message = fieldErrorsOrMessage;
    const details = typeof detailsOrMessage === 'object' ? detailsOrMessage : undefined;
    return new AppError(ErrorCodes.VALIDATION_ERROR, message, 400, {
      details,
    });
  }
}

// ============================================================================
// ERROR TYPE GUARDS
// ============================================================================

/**
 * Check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Check if error is operational (expected, can be handled gracefully)
 */
export function isOperationalError(error: unknown): boolean {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}

/**
 * Check if error is a specific type
 */
export function isErrorCode(error: unknown, code: ErrorCode): boolean {
  if (isAppError(error)) {
    return error.code === code;
  }
  return false;
}

// ============================================================================
// ERROR CONVERSION
// ============================================================================

/**
 * Convert any error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      ErrorCodes.UNKNOWN_ERROR,
      error.message || 'An unexpected error occurred',
      500,
      {
        isOperational: false,
        cause: error,
      }
    );
  }

  if (typeof error === 'string') {
    return new AppError(ErrorCodes.UNKNOWN_ERROR, error, 500, {
      isOperational: false,
    });
  }

  return new AppError(ErrorCodes.UNKNOWN_ERROR, 'An unexpected error occurred', 500, {
    isOperational: false,
    details: { originalError: String(error) },
  });
}

/**
 * Wrap a function to convert thrown errors to AppErrors
 */
export function wrapAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw toAppError(error);
    }
  };
}

export default AppError;
