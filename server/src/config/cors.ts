/**
 * CORS Configuration
 *
 * Configures Cross-Origin Resource Sharing for the API.
 * Whitelists production domains and handles preflight requests.
 */

import cors, { CorsOptions, CorsOptionsDelegate } from 'cors';
import { Request } from 'express';

// Allowed origins from environment or defaults
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Add default development origins
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push(
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  );
}

// Production domains (add your domains here)
const productionOrigins = [
  'https://sage.com',
  'https://www.sage.com',
  'https://app.sage.com',
  'https://api.sage.com',
];

if (process.env.NODE_ENV === 'production') {
  allowedOrigins.push(...productionOrigins);
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    // Allow requests with no origin (e.g., mobile apps, Postman)
    return true;
  }

  // Check exact match
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Check wildcard subdomains (e.g., *.vercel.app for preview deployments)
  const wildcardPatterns = [
    /^https:\/\/.*\.vercel\.app$/,
    /^https:\/\/.*\.netlify\.app$/,
    /^https:\/\/.*-sage\.vercel\.app$/,
  ];

  return wildcardPatterns.some((pattern) => pattern.test(origin));
}

/**
 * Dynamic CORS options based on request origin
 */
const corsOptionsDelegate: CorsOptionsDelegate<Request> = (
  req,
  callback
) => {
  const origin = req.header('Origin');
  const allowed = isOriginAllowed(origin);

  const corsOptions: CorsOptions = {
    origin: allowed ? origin : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-ID',
      'X-Correlation-ID',
    ],
    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    credentials: true,
    maxAge: 86400, // 24 hours - cache preflight requests
    optionsSuccessStatus: 204,
  };

  callback(null, corsOptions);
};

/**
 * CORS middleware with dynamic origin checking
 */
export const corsMiddleware = cors(corsOptionsDelegate);

/**
 * Simple CORS for public endpoints (more permissive)
 */
export const publicCors = cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400,
});

/**
 * Strict CORS for sensitive endpoints
 */
export const strictCors = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 3600, // 1 hour
});

export default corsMiddleware;
