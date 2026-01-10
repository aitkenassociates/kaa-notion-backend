/**
 * Performance Monitoring
 *
 * Tracks application performance metrics:
 * - Response times
 * - Database query durations
 * - External API call latencies
 * - Memory usage
 * - Event loop lag
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { addBreadcrumb } from './sentry';

// ========================================
// Metrics Storage
// ========================================

interface Metric {
  count: number;
  total: number;
  min: number;
  max: number;
  avg: number;
  p95: number;
  p99: number;
  values: number[];
}

// Metric without values for reports (to avoid sending large arrays)
type MetricReport = Omit<Metric, 'values'>;

interface MetricsStore {
  requests: Map<string, Metric>;
  queries: Map<string, Metric>;
  external: Map<string, Metric>;
  errors: Map<string, number>;
}

const metrics: MetricsStore = {
  requests: new Map(),
  queries: new Map(),
  external: new Map(),
  errors: new Map(),
};

const MAX_VALUES = 1000; // Keep last 1000 values for percentile calculation

// ========================================
// Metric Helpers
// ========================================

function updateMetric(store: Map<string, Metric>, key: string, value: number): void {
  const existing = store.get(key) || {
    count: 0,
    total: 0,
    min: Infinity,
    max: -Infinity,
    avg: 0,
    p95: 0,
    p99: 0,
    values: [],
  };

  existing.count++;
  existing.total += value;
  existing.min = Math.min(existing.min, value);
  existing.max = Math.max(existing.max, value);
  existing.avg = existing.total / existing.count;

  // Keep values for percentile calculation
  existing.values.push(value);
  if (existing.values.length > MAX_VALUES) {
    existing.values.shift();
  }

  // Calculate percentiles
  const sorted = [...existing.values].sort((a, b) => a - b);
  existing.p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  existing.p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

  store.set(key, existing);
}

function getPercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * (percentile / 100));
  return sorted[index] || 0;
}

// ========================================
// Request Performance Middleware
// ========================================

export interface PerformanceOptions {
  slowThreshold?: number; // ms
  enableMemoryTracking?: boolean;
  enableEventLoopTracking?: boolean;
}

const defaultOptions: PerformanceOptions = {
  slowThreshold: 1000,
  enableMemoryTracking: true,
  enableEventLoopTracking: true,
};

/**
 * Performance monitoring middleware
 */
export function performanceMiddleware(options: PerformanceOptions = {}) {
  const config = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime.bigint();
    const startMemory = config.enableMemoryTracking ? process.memoryUsage() : null;

    // Track response
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to ms

      const routeKey = `${req.method} ${req.route?.path || req.path}`;
      updateMetric(metrics.requests, routeKey, duration);

      // Log slow requests
      if (duration > config.slowThreshold!) {
        logger.warn('Slow request detected', {
          method: req.method,
          path: req.path,
          duration: `${duration.toFixed(2)}ms`,
          statusCode: res.statusCode,
        });

        addBreadcrumb({
          category: 'performance',
          message: 'Slow request',
          data: {
            method: req.method,
            path: req.path,
            duration,
          },
          level: 'warning',
        });
      }

      // Track memory delta
      if (startMemory && config.enableMemoryTracking) {
        const endMemory = process.memoryUsage();
        const heapDelta = endMemory.heapUsed - startMemory.heapUsed;

        if (heapDelta > 10 * 1024 * 1024) { // 10MB
          logger.warn('High memory allocation in request', {
            method: req.method,
            path: req.path,
            heapDelta: `${(heapDelta / 1024 / 1024).toFixed(2)}MB`,
          });
        }
      }

      // Track errors
      if (res.statusCode >= 500) {
        const errorKey = `${res.statusCode} ${routeKey}`;
        metrics.errors.set(errorKey, (metrics.errors.get(errorKey) || 0) + 1);
      }
    });

    next();
  };
}

// ========================================
// Database Query Tracking
// ========================================

/**
 * Track a database query
 */
export function trackQuery(
  operation: string,
  model: string,
  duration: number
): void {
  const key = `${operation} ${model}`;
  updateMetric(metrics.queries, key, duration);

  if (duration > 100) { // 100ms threshold for slow queries
    logger.warn('Slow database query', {
      operation,
      model,
      duration: `${duration.toFixed(2)}ms`,
    });

    addBreadcrumb({
      category: 'database',
      message: 'Slow query',
      data: {
        operation,
        model,
        duration,
      },
      level: 'warning',
    });
  }
}

/**
 * Wrap Prisma client for automatic query tracking
 */
export function createQueryTracker() {
  return {
    query: (e: { query: string; params: string; duration: number }) => {
      const operation = e.query.split(' ')[0]; // SELECT, INSERT, UPDATE, DELETE
      trackQuery(operation, 'prisma', e.duration);
    },
  };
}

// ========================================
// External API Tracking
// ========================================

/**
 * Track an external API call
 */
export function trackExternalCall(
  service: string,
  endpoint: string,
  duration: number,
  success: boolean
): void {
  const key = `${service} ${endpoint}`;
  updateMetric(metrics.external, key, duration);

  if (!success) {
    const errorKey = `${service} error`;
    metrics.errors.set(errorKey, (metrics.errors.get(errorKey) || 0) + 1);
  }

  if (duration > 2000) { // 2s threshold for slow external calls
    logger.warn('Slow external API call', {
      service,
      endpoint,
      duration: `${duration.toFixed(2)}ms`,
      success,
    });
  }
}

/**
 * Wrapper for tracking external API calls
 */
export async function withExternalTracking<T>(
  service: string,
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  let success = true;

  try {
    return await fn();
  } catch (error) {
    success = false;
    throw error;
  } finally {
    trackExternalCall(service, endpoint, Date.now() - start, success);
  }
}

// ========================================
// Event Loop Monitoring
// ========================================

let eventLoopLag = 0;
let eventLoopInterval: NodeJS.Timeout | null = null;

/**
 * Start event loop monitoring
 */
export function startEventLoopMonitoring(checkInterval: number = 1000): void {
  if (eventLoopInterval) return;

  let lastCheck = process.hrtime.bigint();

  eventLoopInterval = setInterval(() => {
    const now = process.hrtime.bigint();
    const expected = BigInt(checkInterval * 1_000_000); // Convert to ns
    const actual = now - lastCheck;
    const lag = Number(actual - expected) / 1_000_000; // Convert to ms

    eventLoopLag = Math.max(0, lag);

    if (eventLoopLag > 100) { // 100ms lag threshold
      logger.warn('Event loop lag detected', {
        lag: `${eventLoopLag.toFixed(2)}ms`,
      });
    }

    lastCheck = now;
  }, checkInterval);
}

/**
 * Stop event loop monitoring
 */
export function stopEventLoopMonitoring(): void {
  if (eventLoopInterval) {
    clearInterval(eventLoopInterval);
    eventLoopInterval = null;
  }
}

// ========================================
// Metrics Reporting
// ========================================

export interface PerformanceReport {
  timestamp: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  eventLoopLag: number;
  requests: Record<string, MetricReport>;
  queries: Record<string, MetricReport>;
  external: Record<string, MetricReport>;
  errors: Record<string, number>;
}

/**
 * Get current performance metrics
 */
export function getPerformanceReport(): PerformanceReport {
  const memory = process.memoryUsage();

  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
      external: Math.round(memory.external / 1024 / 1024),
      rss: Math.round(memory.rss / 1024 / 1024),
    },
    eventLoopLag,
    requests: Object.fromEntries(
      Array.from(metrics.requests.entries()).map(([k, { values, ...rest }]) => [
        k,
        rest, // Omit values from report
      ])
    ),
    queries: Object.fromEntries(
      Array.from(metrics.queries.entries()).map(([k, { values, ...rest }]) => [
        k,
        rest,
      ])
    ),
    external: Object.fromEntries(
      Array.from(metrics.external.entries()).map(([k, { values, ...rest }]) => [
        k,
        rest,
      ])
    ),
    errors: Object.fromEntries(metrics.errors),
  };
}

/**
 * Reset all metrics
 */
export function resetMetrics(): void {
  metrics.requests.clear();
  metrics.queries.clear();
  metrics.external.clear();
  metrics.errors.clear();
}

/**
 * Get summary statistics
 */
export function getMetricsSummary(): {
  totalRequests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
  slowQueries: number;
} {
  let totalRequests = 0;
  let totalDuration = 0;
  const allResponseTimes: number[] = [];
  let totalErrors = 0;
  let slowQueries = 0;

  for (const metric of metrics.requests.values()) {
    totalRequests += metric.count;
    totalDuration += metric.total;
    allResponseTimes.push(...metric.values);
  }

  for (const count of metrics.errors.values()) {
    totalErrors += count;
  }

  for (const metric of metrics.queries.values()) {
    if (metric.p95 > 100) slowQueries++;
  }

  return {
    totalRequests,
    avgResponseTime: totalRequests > 0 ? totalDuration / totalRequests : 0,
    p95ResponseTime: getPercentile(allResponseTimes, 95),
    errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
    slowQueries,
  };
}

// ========================================
// Performance Endpoint
// ========================================

/**
 * Express route handler for metrics endpoint
 */
export function metricsHandler(req: Request, res: Response): void {
  const report = getPerformanceReport();
  res.json(report);
}

/**
 * Express route handler for metrics summary
 */
export function metricsSummaryHandler(req: Request, res: Response): void {
  const summary = getMetricsSummary();
  res.json(summary);
}

export default {
  middleware: performanceMiddleware,
  trackQuery,
  trackExternalCall,
  withExternalTracking,
  startEventLoopMonitoring,
  stopEventLoopMonitoring,
  getReport: getPerformanceReport,
  getSummary: getMetricsSummary,
  reset: resetMetrics,
  metricsHandler,
  metricsSummaryHandler,
};
