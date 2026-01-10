/**
 * Database Configuration
 * Prisma connection pooling and management utilities.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../logger';
import { recordDbQuery } from './metrics';

// ============================================================================
// TYPES
// ============================================================================

export interface DatabaseConfig {
  /** Maximum number of connections in the pool (default: 10) */
  connectionLimit: number;
  /** Connection timeout in milliseconds (default: 5000) */
  connectionTimeout: number;
  /** Query timeout in milliseconds (default: 10000) */
  queryTimeout: number;
  /** Idle connection timeout in milliseconds (default: 60000) */
  idleTimeout: number;
  /** Enable query logging */
  logQueries: boolean;
  /** Slow query threshold in milliseconds */
  slowQueryThreshold: number;
}

export interface ConnectionStats {
  /** Total queries executed */
  totalQueries: number;
  /** Total query errors */
  totalErrors: number;
  /** Average query duration in ms */
  avgQueryDuration: number;
  /** Number of slow queries */
  slowQueries: number;
  /** Current connection state */
  connected: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: DatabaseConfig = {
  connectionLimit: parseInt(process.env.DATABASE_CONNECTION_LIMIT || '10', 10),
  connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '5000', 10),
  queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '10000', 10),
  idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '60000', 10),
  logQueries: process.env.NODE_ENV === 'development',
  slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000', 10),
};

let config: DatabaseConfig = { ...DEFAULT_CONFIG };

// ============================================================================
// STATISTICS
// ============================================================================

let stats: ConnectionStats = {
  totalQueries: 0,
  totalErrors: 0,
  avgQueryDuration: 0,
  slowQueries: 0,
  connected: false,
};

let totalDuration = 0;

/**
 * Record a query execution
 */
function recordQuery(durationMs: number, error = false): void {
  stats.totalQueries++;
  totalDuration += durationMs;
  stats.avgQueryDuration = totalDuration / stats.totalQueries;
  
  if (error) {
    stats.totalErrors++;
  }
  
  if (durationMs > config.slowQueryThreshold) {
    stats.slowQueries++;
  }
}

/**
 * Get current connection statistics
 */
export function getDatabaseStats(): ConnectionStats {
  return { ...stats };
}

/**
 * Reset statistics
 */
export function resetDatabaseStats(): void {
  stats = {
    totalQueries: 0,
    totalErrors: 0,
    avgQueryDuration: 0,
    slowQueries: 0,
    connected: stats.connected,
  };
  totalDuration = 0;
}

// ============================================================================
// PRISMA CLIENT FACTORY
// ============================================================================

/**
 * Create a configured Prisma client with logging and extensions
 */
export function createPrismaClient(overrides: Partial<DatabaseConfig> = {}): PrismaClient {
  config = { ...config, ...overrides };
  
  // Configure logging based on environment
  const logConfig: Prisma.PrismaClientOptions['log'] = config.logQueries
    ? [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ]
    : [{ level: 'error', emit: 'event' }];

  // Create Prisma client
  const prisma = new PrismaClient({
    log: logConfig,
    errorFormat: 'pretty',
  });

  // Set up event handlers for logging, stats, and metrics
  if (config.logQueries) {
    // @ts-expect-error - Prisma event types are complex
    prisma.$on('query', (e: Prisma.QueryEvent) => {
      const durationMs = e.duration;
      recordQuery(durationMs);
      
      // Record Prometheus metrics
      // Extract model name from query (simplified - matches common Prisma patterns)
      const modelMatch = e.query.match(/FROM\s+"?(\w+)"?/i) || e.query.match(/INTO\s+"?(\w+)"?/i);
      const model = modelMatch ? modelMatch[1] : 'unknown';
      
      // Determine operation type
      let operation = 'query';
      if (e.query.match(/^INSERT/i)) operation = 'insert';
      else if (e.query.match(/^UPDATE/i)) operation = 'update';
      else if (e.query.match(/^DELETE/i)) operation = 'delete';
      else if (e.query.match(/^SELECT/i)) operation = 'select';
      
      // Record metrics
      recordDbQuery(operation, model, durationMs, true);
      
      if (durationMs > config.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          query: e.query.substring(0, 200),
          duration: durationMs,
          params: e.params?.substring(0, 100),
        });
        // Record slow query as error metric
        recordDbQuery(operation, model, durationMs, false);
      } else {
        logger.debug('Query executed', {
          duration: durationMs,
        });
      }
    });
  } else {
    // Even if not logging, still record metrics for production monitoring
    // @ts-expect-error - Prisma event types are complex
    prisma.$on('query', (e: Prisma.QueryEvent) => {
      const durationMs = e.duration;
      
      // Extract model and operation (simplified)
      const modelMatch = e.query.match(/FROM\s+"?(\w+)"?/i) || e.query.match(/INTO\s+"?(\w+)"?/i);
      const model = modelMatch ? modelMatch[1] : 'unknown';
      
      let operation = 'query';
      if (e.query.match(/^INSERT/i)) operation = 'insert';
      else if (e.query.match(/^UPDATE/i)) operation = 'update';
      else if (e.query.match(/^DELETE/i)) operation = 'delete';
      else if (e.query.match(/^SELECT/i)) operation = 'select';
      
      // Record metrics
      const isSlow = durationMs > config.slowQueryThreshold;
      recordDbQuery(operation, model, durationMs, !isSlow);
    });
  }

  // @ts-expect-error - Prisma event types are complex  
  prisma.$on('error', (e: Error) => {
    logger.error('Database error', { error: e.message });
    stats.totalErrors++;
  });

  // @ts-expect-error - Prisma event types are complex
  prisma.$on('warn', (e: { message: string }) => {
    logger.warn('Database warning', { message: e.message });
  });

  return prisma;
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Test database connection
 */
export async function testConnection(prisma: PrismaClient): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    stats.connected = true;
    return true;
  } catch (error) {
    logger.error('Database connection test failed', { error });
    stats.connected = false;
    return false;
  }
}

/**
 * Connect to database with retry
 */
export async function connectWithRetry(
  prisma: PrismaClient,
  maxRetries = 5,
  retryDelayMs = 1000
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$connect();
      stats.connected = true;
      logger.info('Database connected', { attempt });
      return true;
    } catch (error) {
      logger.warn(`Database connection attempt ${attempt}/${maxRetries} failed`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
  }
  
  stats.connected = false;
  logger.error('Failed to connect to database after all retries');
  return false;
}

/**
 * Graceful disconnect
 */
export async function disconnect(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.$disconnect();
    stats.connected = false;
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Error disconnecting from database', { error });
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export interface DatabaseHealthResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Perform database health check
 */
export async function checkDatabaseHealth(prisma: PrismaClient): Promise<DatabaseHealthResult> {
  const start = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;
    
    return {
      healthy: true,
      latencyMs,
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// TRANSACTION HELPERS
// ============================================================================

export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

const DEFAULT_TRANSACTION_OPTIONS: TransactionOptions = {
  maxWait: 5000,
  timeout: 10000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};

/**
 * Execute a transaction with timeout and retry
 */
export async function executeTransaction<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_TRANSACTION_OPTIONS, ...options };
  
  const start = Date.now();
  
  try {
    const result = await prisma.$transaction(fn, {
      maxWait: opts.maxWait,
      timeout: opts.timeout,
      isolationLevel: opts.isolationLevel,
    }) as T;

    const duration = Date.now() - start;
    recordQuery(duration);

    logger.debug('Transaction completed', { duration });

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    recordQuery(duration, true);
    
    logger.error('Transaction failed', {
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    throw error;
  }
}

// ============================================================================
// QUERY UTILITIES
// ============================================================================

/**
 * Execute query with timeout
 */
export async function queryWithTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs: number = config.queryTimeout
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs);
  });
  
  return Promise.race([queryFn(), timeoutPromise]);
}

/**
 * Execute query with automatic retry on transient failures
 */
export async function queryWithRetry<T>(
  queryFn: () => Promise<T>,
  maxRetries = 3,
  retryDelayMs = 100
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Only retry on transient errors
      const isTransient = isTransientError(lastError);
      
      if (!isTransient || attempt >= maxRetries) {
        throw lastError;
      }
      
      logger.warn(`Query retry ${attempt}/${maxRetries}`, {
        error: lastError.message,
      });
      
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
    }
  }
  
  throw lastError;
}

/**
 * Check if error is transient (retryable)
 */
function isTransientError(error: Error): boolean {
  const transientCodes = [
    'P1001', // Can't reach database server
    'P1002', // Database server timed out
    'P1008', // Operations timed out
    'P1017', // Server has closed the connection
  ];
  
  const message = error.message.toLowerCase();
  
  // Check for Prisma error codes
  for (const code of transientCodes) {
    if (message.includes(code.toLowerCase())) {
      return true;
    }
  }
  
  // Check for common transient error patterns
  const transientPatterns = [
    'connection',
    'timeout',
    'too many connections',
    'connection refused',
    'socket hang up',
  ];
  
  return transientPatterns.some((pattern) => message.includes(pattern));
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createPrismaClient,
  testConnection,
  connectWithRetry,
  disconnect,
  checkDatabaseHealth,
  executeTransaction,
  queryWithTimeout,
  queryWithRetry,
  getDatabaseStats,
  resetDatabaseStats,
};
