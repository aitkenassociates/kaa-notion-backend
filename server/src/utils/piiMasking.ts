/**
 * PII Masking Utility
 * Masks Personally Identifiable Information in logs and error messages.
 *
 * Features:
 * - Email masking (shows first 2 chars + domain)
 * - Phone number masking (shows last 4 digits)
 * - Credit card masking (shows last 4 digits)
 * - IP address masking (shows first 2 octets)
 * - API key/token masking (shows first 4 chars)
 * - Address masking
 * - Custom field masking
 */

// ============================================================================
// TYPES
// ============================================================================

export interface MaskingOptions {
  /** Mask email addresses */
  maskEmails?: boolean;
  /** Mask phone numbers */
  maskPhones?: boolean;
  /** Mask credit card numbers */
  maskCreditCards?: boolean;
  /** Mask IP addresses */
  maskIPs?: boolean;
  /** Mask API keys and tokens */
  maskTokens?: boolean;
  /** Mask addresses */
  maskAddresses?: boolean;
  /** Custom fields to mask (deep path notation: "user.email") */
  customFields?: string[];
  /** Fields to completely redact (replace with [REDACTED]) */
  redactFields?: string[];
}

const DEFAULT_OPTIONS: MaskingOptions = {
  maskEmails: true,
  maskPhones: true,
  maskCreditCards: true,
  maskIPs: true,
  maskTokens: true,
  maskAddresses: false, // Off by default as it can be too aggressive
  customFields: [],
  redactFields: ['password', 'passwordHash', 'secret', 'apiKey', 'accessToken', 'refreshToken'],
};

// ============================================================================
// REGEX PATTERNS
// ============================================================================

const PATTERNS = {
  // Email: matches standard email format
  email: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,

  // Phone: matches various phone formats (US-centric but catches many)
  phone: /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,

  // Credit card: 13-19 digits with optional separators
  creditCard: /\b([0-9]{4})[-.\s]?([0-9]{4})[-.\s]?([0-9]{4})[-.\s]?([0-9]{1,7})\b/g,

  // IP address: IPv4 format
  ipv4: /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g,

  // JWT token: standard JWT format
  jwt: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,

  // API key: common API key formats (alphanumeric, 20+ chars)
  apiKey: /\b([a-zA-Z0-9_-]{4})([a-zA-Z0-9_-]{16,})\b/g,

  // SSN: US Social Security Number
  ssn: /\b(\d{3})[-.\s]?(\d{2})[-.\s]?(\d{4})\b/g,
};

// ============================================================================
// MASKING FUNCTIONS
// ============================================================================

/**
 * Mask an email address
 * john.doe@example.com -> jo***@example.com
 */
export function maskEmail(email: string): string {
  return email.replace(PATTERNS.email, (match, local, domain) => {
    if (local.length <= 2) {
      return `***@${domain}`;
    }
    return `${local.substring(0, 2)}***@${domain}`;
  });
}

/**
 * Mask a phone number
 * (123) 456-7890 -> ***-***-7890
 */
export function maskPhone(phone: string): string {
  return phone.replace(PATTERNS.phone, (match, prefix, area, exchange, line) => {
    return `***-***-${line}`;
  });
}

/**
 * Mask a credit card number
 * 1234-5678-9012-3456 -> ****-****-****-3456
 */
export function maskCreditCard(card: string): string {
  return card.replace(PATTERNS.creditCard, (match, g1, g2, g3, g4) => {
    return `****-****-****-${g4}`;
  });
}

/**
 * Mask an IP address
 * 192.168.1.100 -> 192.168.*.*
 */
export function maskIP(ip: string): string {
  return ip.replace(PATTERNS.ipv4, (match, o1, o2, o3, o4) => {
    return `${o1}.${o2}.*.*`;
  });
}

/**
 * Mask a JWT token
 * eyJhbGci... -> eyJh...****
 */
export function maskJWT(token: string): string {
  return token.replace(PATTERNS.jwt, (match) => {
    if (match.length > 20) {
      return `${match.substring(0, 10)}...****`;
    }
    return '****';
  });
}

/**
 * Mask an API key
 * sk_live_abc123def456 -> sk_l...****
 */
export function maskAPIKey(key: string): string {
  if (key.length <= 8) {
    return '****';
  }
  return `${key.substring(0, 4)}...****`;
}

/**
 * Mask an SSN
 * 123-45-6789 -> ***-**-6789
 */
export function maskSSN(ssn: string): string {
  return ssn.replace(PATTERNS.ssn, (match, area, group, serial) => {
    return `***-**-${serial}`;
  });
}

// ============================================================================
// STRING MASKING
// ============================================================================

/**
 * Mask PII in a string
 */
export function maskString(str: string, options: MaskingOptions = DEFAULT_OPTIONS): string {
  let result = str;

  if (options.maskEmails) {
    result = result.replace(PATTERNS.email, (match, local, domain) => {
      if (local.length <= 2) return `***@${domain}`;
      return `${local.substring(0, 2)}***@${domain}`;
    });
  }

  if (options.maskPhones) {
    result = result.replace(PATTERNS.phone, '***-***-$4');
  }

  if (options.maskCreditCards) {
    result = result.replace(PATTERNS.creditCard, '****-****-****-$4');
  }

  if (options.maskIPs) {
    result = result.replace(PATTERNS.ipv4, '$1.$2.*.*');
  }

  if (options.maskTokens) {
    result = result.replace(PATTERNS.jwt, (match) => {
      if (match.length > 20) return `${match.substring(0, 10)}...****`;
      return '****';
    });
  }

  // Always mask SSNs
  result = result.replace(PATTERNS.ssn, '***-**-$3');

  return result;
}

// ============================================================================
// OBJECT MASKING
// ============================================================================

/**
 * Deep clone an object with PII masked
 */
export function maskObject<T extends Record<string, unknown>>(
  obj: T,
  options: MaskingOptions = DEFAULT_OPTIONS
): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return maskString(obj, options) as unknown as T;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => maskObject(item as Record<string, unknown>, options)) as unknown as T;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if field should be completely redacted
    if (options.redactFields?.some(field => lowerKey.includes(field.toLowerCase()))) {
      result[key] = '[REDACTED]';
      continue;
    }

    // Check if this is a known PII field
    if (typeof value === 'string') {
      if (lowerKey.includes('email') && options.maskEmails) {
        result[key] = maskEmail(value);
      } else if ((lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('tel')) && options.maskPhones) {
        result[key] = maskPhone(value);
      } else if ((lowerKey.includes('card') || lowerKey.includes('credit')) && options.maskCreditCards) {
        result[key] = maskCreditCard(value);
      } else if ((lowerKey.includes('ip') || lowerKey === 'address' && value.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) && options.maskIPs) {
        result[key] = maskIP(value);
      } else if ((lowerKey.includes('token') || lowerKey.includes('key') || lowerKey.includes('auth')) && options.maskTokens) {
        result[key] = maskAPIKey(value);
      } else if (lowerKey.includes('ssn')) {
        result[key] = maskSSN(value);
      } else if (options.customFields?.includes(key)) {
        result[key] = maskString(value, options);
      } else {
        // Apply general string masking
        result[key] = maskString(value, options);
      }
    } else if (typeof value === 'object' && value !== null) {
      result[key] = maskObject(value as Record<string, unknown>, options);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

// ============================================================================
// LOGGER INTEGRATION
// ============================================================================

/**
 * Create a masked logger wrapper
 * Wraps any object with logger-like interface to mask PII before logging
 */
export function createMaskedLogger<T extends Record<string, (...args: unknown[]) => void>>(
  logger: T,
  options: MaskingOptions = DEFAULT_OPTIONS
): T {
  const maskedLogger = {} as T;

  for (const [method, fn] of Object.entries(logger)) {
    if (typeof fn === 'function') {
      (maskedLogger as Record<string, unknown>)[method] = (...args: unknown[]) => {
        const maskedArgs = args.map(arg => {
          if (typeof arg === 'string') {
            return maskString(arg, options);
          }
          if (typeof arg === 'object' && arg !== null) {
            return maskObject(arg as Record<string, unknown>, options);
          }
          return arg;
        });
        fn.apply(logger, maskedArgs);
      };
    }
  }

  return maskedLogger;
}

/**
 * Mask PII in an error object for safe logging
 */
export function maskError(error: Error, options: MaskingOptions = DEFAULT_OPTIONS): Error {
  const maskedError = new Error(maskString(error.message, options));
  maskedError.name = error.name;
  maskedError.stack = error.stack ? maskString(error.stack, options) : undefined;
  return maskedError;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  maskEmail,
  maskPhone,
  maskCreditCard,
  maskIP,
  maskJWT,
  maskAPIKey,
  maskSSN,
  maskString,
  maskObject,
  maskError,
  createMaskedLogger,
};
