import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { FigmaClient } from './figma-client';
import { handleFigmaWebhook } from './webhook-handler';
import { performHealthCheck, livenessCheck, readinessCheck } from './services/healthService';
import { 
  createProjectsRouter, 
  createMilestonesRouter, 
  createDeliverablesRouter, 
  createAdminRouter, 
  createNotionRouter, 
  createUploadRouter, 
  createLeadsRouter,
  createCheckoutRouter,
  createWebhooksRouter,
  createAuthRouter,
} from './routes';
import {
  initNotionSyncService,
  initStorageService,
  initAuditService,
  initAuthService,
  initEmailService,
  initRealtimeService,
  shutdownRealtimeService,
} from './services';
import { initStripe } from './utils/stripeHelpers';
import { 
  errorHandler, 
  notFoundHandler,
  apiRateLimiter,
  authRateLimiter,
  leadCreationRateLimiter,
  checkoutRateLimiter,
  uploadRateLimiter,
  adminRateLimiter,
  requireAuth,
} from './middleware';
import { logger, requestLogger } from './logger';
import { setupSwagger } from './config/swagger';
import { initEnvironment, getFeatureFlags } from './config/environment';
import { setupSentry, sentryErrorHandler, captureException } from './config/sentry';
import { metricsMiddleware, createMetricsRouter } from './config/metrics';
import { createPrismaClient, connectWithRetry, checkDatabaseHealth } from './config/database';
import { internalError, serviceUnavailable } from './utils/AppError';

dotenv.config();

// Validate environment configuration at startup
const envConfig = initEnvironment();
const features = getFeatureFlags();

// Initialize Prisma client with connection pooling and monitoring
const prisma = createPrismaClient({
  connectionLimit: parseInt(process.env.DATABASE_CONNECTION_LIMIT || '10', 10),
  connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '5000', 10),
  queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '10000', 10),
  idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '60000', 10),
  logQueries: process.env.NODE_ENV === 'development',
  slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000', 10),
});

// Initialize Stripe helpers for checkout and webhook handling
if (process.env.STRIPE_SECRET_KEY) {
  initStripe({
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    successUrl: process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/success',
    cancelUrl: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/cancel',
  });
  logger.info('Stripe service initialized');
}

const app = express();
const port = process.env.PORT || 3001;

// Setup Sentry error tracking (must be early)
setupSentry(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',') 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id', 'x-user-id', 'x-user-type', 'x-client-id'],
};
app.use(cors(corsOptions));

// Compression for responses
app.use(compression());

// Stripe webhooks need the raw body for signature verification - keep this before express.json().
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

// JSON parsing for all other routes
app.use(express.json({ limit: '10mb' }));

// Request logging with correlation IDs (skip for health checks)
app.use((req, res, next) => {
  if (req.path === '/api/health' || req.path === '/test') {
    return next();
  }
  requestLogger(req, res, next);
});

// Prometheus metrics middleware
app.use(metricsMiddleware);

// Initialize Notion sync service if configured
if (features.notionEnabled && process.env.NOTION_PROJECTS_DATABASE_ID) {
  initNotionSyncService(prisma, {
    notionApiKey: process.env.NOTION_API_KEY!,
    projectsDatabaseId: process.env.NOTION_PROJECTS_DATABASE_ID,
    rateLimitMs: 350,
    maxRetries: 3,
    retryDelayMs: 1000,
    batchSize: 10,
  });
  logger.info('Notion sync service initialized');
}

// Initialize storage service if configured
if (features.storageEnabled) {
  initStorageService({
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!,
    bucketName: process.env.STORAGE_BUCKET || 'deliverables',
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
  });
  logger.info('Storage service initialized');
}

// Initialize audit service
initAuditService(prisma);
logger.info('Audit service initialized');

// Initialize auth service
initAuthService({
  jwtSecret: process.env.JWT_SECRET || 'development-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  saltRounds: 12,
});
logger.info('Auth service initialized');

// Initialize email service
const emailProvider = process.env.RESEND_API_KEY ? 'resend' : 
                     process.env.SMTP_HOST ? 'nodemailer' : 'console';
initEmailService({
  provider: emailProvider,
  resendApiKey: process.env.RESEND_API_KEY,
  smtpConfig: process.env.SMTP_HOST ? {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  } : undefined,
  defaultFrom: process.env.EMAIL_FROM || 'SAGE <hello@sage.design>',
  replyTo: process.env.EMAIL_REPLY_TO || 'support@sage.design',
});
logger.info(`Email service initialized with provider: ${emailProvider}`);

// Setup Swagger API documentation
if (features.apiDocsEnabled) {
  setupSwagger(app);
  logger.info('Swagger API documentation available at /api/docs');
}

// API Routes with Rate Limiting
app.use('/api/projects', apiRateLimiter, createProjectsRouter(prisma));
app.use('/api', apiRateLimiter, createMilestonesRouter(prisma)); // Handles /api/projects/:id/milestones and /api/milestones/:id
app.use('/api', apiRateLimiter, createDeliverablesRouter(prisma)); // Handles /api/projects/:id/deliverables and /api/deliverables/:id
app.use('/api/admin', adminRateLimiter, createAdminRouter(prisma)); // Handles /api/admin/* endpoints
app.use('/api/notion', adminRateLimiter, requireNotionService, createNotionRouter({ prisma })); // Handles /api/notion/* sync endpoints
app.use('/api/upload', uploadRateLimiter, requireStorageService, createUploadRouter({ prisma })); // Handles /api/upload/* file upload endpoints
const apiAuth = requireAuth(prisma);
app.use('/api/projects', apiRateLimiter, apiAuth, createProjectsRouter(prisma));
app.use('/api', apiRateLimiter, apiAuth, createMilestonesRouter(prisma)); // Handles /api/projects/:id/milestones and /api/milestones/:id
app.use('/api', apiRateLimiter, apiAuth, createDeliverablesRouter(prisma)); // Handles /api/projects/:id/deliverables and /api/deliverables/:id
app.use('/api/admin', adminRateLimiter, apiAuth, createAdminRouter(prisma)); // Handles /api/admin/* endpoints
app.use('/api/notion', adminRateLimiter, apiAuth, createNotionRouter({ prisma })); // Handles /api/notion/* sync endpoints
app.use('/api/upload', uploadRateLimiter, createUploadRouter({ prisma })); // Handles /api/upload/* file upload endpoints
app.use('/api/leads', leadCreationRateLimiter, createLeadsRouter(prisma)); // Handles /api/leads/* endpoints
app.use('/api/checkout', checkoutRateLimiter, createCheckoutRouter(prisma)); // Handles /api/checkout/* endpoints
app.use('/api/webhooks', createWebhooksRouter(prisma)); // Handles /api/webhooks/* endpoints (no rate limit for webhooks)
app.use('/api/auth', authRateLimiter, createAuthRouter(prisma)); // Handles /api/auth/* endpoints

// Prometheus metrics endpoint
app.use('/api/metrics', createMetricsRouter());

// Initialize Figma client
const figmaClient = new FigmaClient({
  accessToken: process.env.FIGMA_ACCESS_TOKEN || '',
});

// WebSocket server for real-time updates (notifications + Figma requests)
const wss = new WebSocketServer({ port: 3002 });
initRealtimeService(wss, {}, figmaClient);

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    status: 'Server is running',
    token: process.env.FIGMA_ACCESS_TOKEN ? 'Present' : 'Missing'
  });
});

// REST API endpoints
app.get('/file/:fileKey', async (req, res, next) => {
  try {
    logger.debug('Fetching file:', req.params.fileKey);
    const fileData = await figmaClient.getFile(req.params.fileKey);
    logger.debug('File data received successfully');
    res.json(fileData);
  } catch (error) {
    next(internalError('Failed to fetch Figma file', error as Error));
  }
});

app.get('/file/:fileKey/nodes', async (req, res, next) => {
  try {
    const { nodeIds } = req.query;
    if (!nodeIds || typeof nodeIds !== 'string') {
      return res.status(400).json({ error: 'nodeIds parameter is required' });
    }
    const nodesData = await figmaClient.getFileNodes(req.params.fileKey, nodeIds.split(','));
    res.json(nodesData);
  } catch (error) {
    next(internalError('Failed to fetch Figma nodes', error as Error));
  }
});

app.post('/webhook', handleFigmaWebhook);

// Stripe Checkout endpoint
app.post('/api/stripe/checkout', async (req, res, next) => {
  try {
    const { leadId, tier } = req.body;

    // Validate required fields
    if (!leadId || !tier) {
      return res.status(400).json({ error: 'leadId and tier are required' });
    }

    // Get the price ID from environment variable based on tier
    const priceIdEnvVar = `STRIPE_TIER${tier}_PRICE_ID`;
    const priceId = process.env[priceIdEnvVar];

    if (!priceId) {
      return res.status(400).json({
        error: `Price ID not configured for tier ${tier}. Expected env var: ${priceIdEnvVar}`
      });
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        leadId: String(leadId),
        tier: String(tier),
      },
      success_url: process.env.STRIPE_SUCCESS_URL || `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: process.env.STRIPE_CANCEL_URL || `${req.headers.origin}/cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    next(internalError('Failed to create checkout session', error as Error));
  }
});

// Health check endpoints
app.get('/api/health', async (req, res, next) => {
  try {
    const detailed = req.query.detailed === 'true';
    const result = await performHealthCheck(prisma, { detailed });
    
    const statusCode = result.status === 'healthy' ? 200 
                     : result.status === 'degraded' ? 200 
                     : 503;
    
    res.status(statusCode).json({
      success: result.status !== 'unhealthy',
      ...result,
    });
  } catch (error) {
    next(serviceUnavailable('health'));
  }
});

// Kubernetes liveness probe
app.get('/api/health/live', (_req, res) => {
  const result = livenessCheck();
  res.json({ success: true, ...result });
});

// Kubernetes readiness probe
app.get('/api/health/ready', async (_req, res) => {
  const result = await readinessCheck(prisma);
  res.status(result.ready ? 200 : 503).json({ success: result.ready, ...result });
});

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Sentry error handler (captures errors before our handler)
app.use(sentryErrorHandler());

// Global error handler (must be last)
app.use(errorHandler);

// Connect to database with retry
connectWithRetry(prisma, 5, 1000)
  .then((connected) => {
    if (!connected) {
      logger.error('Failed to connect to database. Server may not function correctly.');
      process.exit(1);
    }
    
    // Perform health check
    checkDatabaseHealth(prisma)
      .then((health) => {
        if (health.healthy) {
          logger.info(`Database health check passed (latency: ${health.latencyMs}ms)`);
        } else {
          logger.warn(`Database health check failed: ${health.error}`);
        }
      })
      .catch((error) => {
        logger.warn('Database health check error', { error });
      });
  })
  .catch((error) => {
    logger.error('Database connection error', { error });
    process.exit(1);
  });

// Start the server
const server = app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  logger.info('Test the server at: http://localhost:3001/test');
  logger.info('API health check: http://localhost:3001/api/health');
});

// Graceful shutdown with connection draining
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '30000', 10); // 30 seconds default
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal', { signal });
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Create a timeout to force shutdown if graceful shutdown takes too long
  const forceShutdownTimer = setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    // 1. Stop accepting new connections and complete in-flight requests
    logger.info('Stopping HTTP server...');
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          logger.error('Error closing HTTP server', { error: err.message });
          reject(err);
        } else {
          logger.info('HTTP server closed, no longer accepting connections');
          resolve();
        }
      });
    });

    // 2. Close WebSocket connections gracefully
    logger.info('Closing WebSocket connections...');
    shutdownRealtimeService();
    await new Promise<void>((resolve) => {
      wss.close(() => {
        logger.info('WebSocket server closed');
        resolve();
      });
    });

    // 3. Close database connection pool
    logger.info('Disconnecting from database...');
    await prisma.$disconnect();
    logger.info('Database connection closed');

    // Clear the force shutdown timer
    clearTimeout(forceShutdownTimer);

    logger.info('Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    clearTimeout(forceShutdownTimer);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  captureException(error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
  if (reason instanceof Error) {
    captureException(reason);
  }
  // Don't shutdown on unhandled rejection, just log it
  // shutdown('unhandledRejection');
}); 
