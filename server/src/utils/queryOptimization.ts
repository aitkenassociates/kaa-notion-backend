/**
 * Query Optimization Utilities
 * Helpers for efficient Prisma queries with pagination, field selection, caching,
 * and avoiding N+1 problems.
 */

import { Prisma } from '@prisma/client';
import { cacheGet, cacheSet, cacheDel, CacheOptions } from '../services/cacheService';
import { logger } from '../logger';

// ============================================================================
// TYPES
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
  maxLimit?: number;
}

export interface PaginationResult {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QueryOptions extends PaginationParams, SortParams {
  fields?: string[];
  include?: string[];
  search?: string;
}

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  direction?: 'forward' | 'backward';
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  previousCursor: string | null;
  hasMore: boolean;
}

export interface CountByResult {
  _count: number;
  [key: string]: string | number;
}

// ============================================================================
// SELECT FIELDS - Avoid over-fetching
// ============================================================================

/**
 * Minimal user fields for lists and references
 */
export const userSelectMinimal = {
  id: true,
  email: true,
  name: true,
  role: true,
} satisfies Prisma.UserSelect;

/**
 * User fields for profile views
 */
export const userSelectProfile = {
  ...userSelectMinimal,
  userType: true,
  tier: true,
  createdAt: true,
  lastLogin: true,
} satisfies Prisma.UserSelect;

/**
 * Minimal project fields for lists
 */
export const projectSelectMinimal = {
  id: true,
  name: true,
  status: true,
  tier: true,
  projectAddress: true,
  createdAt: true,
} satisfies Prisma.ProjectSelect;

/**
 * Project fields with progress calculation data
 */
export const projectSelectWithProgress = {
  ...projectSelectMinimal,
  paymentStatus: true,
  milestones: {
    select: {
      id: true,
      status: true,
    },
  },
} satisfies Prisma.ProjectSelect;

/**
 * Minimal client fields for references
 */
export const clientSelectMinimal = {
  id: true,
  tier: true,
  status: true,
  userId: true,
} satisfies Prisma.ClientSelect;

/**
 * Minimal lead fields for lists
 */
export const leadSelectMinimal = {
  id: true,
  email: true,
  name: true,
  status: true,
  recommendedTier: true,
  tierOverride: true,
  createdAt: true,
} satisfies Prisma.LeadSelect;

/**
 * Minimal milestone fields
 */
export const milestoneSelectMinimal = {
  id: true,
  name: true,
  order: true,
  status: true,
  dueDate: true,
  completedAt: true,
} satisfies Prisma.MilestoneSelect;

/**
 * Minimal deliverable fields
 */
export const deliverableSelectMinimal = {
  id: true,
  name: true,
  category: true,
  fileType: true,
  fileSize: true,
  createdAt: true,
} satisfies Prisma.DeliverableSelect;

/**
 * Notification fields for lists
 */
export const notificationSelectList = {
  id: true,
  type: true,
  title: true,
  message: true,
  link: true,
  read: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

/**
 * Message fields for lists
 */
export const messageSelectList = {
  id: true,
  content: true,
  isInternal: true,
  createdAt: true,
  sender: {
    select: userSelectMinimal,
  },
} satisfies Prisma.MessageSelect;

// ============================================================================
// INCLUDE PRESETS - Eager loading patterns
// ============================================================================

/**
 * Project with all related data for detail view
 */
export const projectIncludeDetail = {
  client: {
    select: {
      id: true,
      tier: true,
      user: {
        select: userSelectMinimal,
      },
    },
  },
  milestones: {
    select: milestoneSelectMinimal,
    orderBy: { order: 'asc' as const },
  },
  deliverables: {
    select: deliverableSelectMinimal,
    orderBy: { createdAt: 'desc' as const },
  },
  payments: {
    select: {
      id: true,
      amount: true,
      status: true,
      paidAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.ProjectInclude;

/**
 * Client with projects for dashboard
 */
export const clientIncludeDashboard = {
  user: {
    select: userSelectProfile,
  },
  projects: {
    select: projectSelectWithProgress,
    orderBy: { createdAt: 'desc' as const },
    take: 10,
  },
} satisfies Prisma.ClientInclude;

/**
 * Lead with conversion data
 */
export const leadIncludeConversion = {
  client: {
    select: clientSelectMinimal,
  },
  projects: {
    select: projectSelectMinimal,
    take: 1,
  },
} satisfies Prisma.LeadInclude;

// ============================================================================
// PAGINATION HELPERS
// ============================================================================

/**
 * Default pagination limits
 */
export const PAGINATION_DEFAULTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/**
 * Calculate skip and take from page/limit params
 */
export function getPagination(params: PaginationParams): PaginationResult {
  const page = Math.max(1, params.page || PAGINATION_DEFAULTS.DEFAULT_PAGE);
  const maxLimit = params.maxLimit || PAGINATION_DEFAULTS.MAX_LIMIT;
  const limit = Math.min(Math.max(1, params.limit || PAGINATION_DEFAULTS.DEFAULT_LIMIT), maxLimit);
  const skip = (page - 1) * limit;

  return { skip, take: limit, page, limit };
}

/**
 * Parse and validate pagination parameters (alias)
 */
export function parsePagination(params: PaginationParams): { skip: number; take: number; page: number } {
  const result = getPagination(params);
  return { skip: result.skip, take: result.take, page: result.page };
}

/**
 * Build pagination response metadata
 */
export function buildPaginationMeta(
  total: number,
  pageOrPagination: number | PaginationResult,
  limit?: number,
  nextCursor?: string
): PaginationMeta {
  // Handle both signatures
  let page: number;
  let actualLimit: number;

  if (typeof pageOrPagination === 'number') {
    page = pageOrPagination;
    actualLimit = limit || PAGINATION_DEFAULTS.DEFAULT_LIMIT;
  } else {
    page = pageOrPagination.page;
    actualLimit = pageOrPagination.limit;
  }

  const totalPages = Math.ceil(total / actualLimit);

  return {
    page,
    limit: actualLimit,
    total,
    totalPages,
    hasMore: page < totalPages,
    nextCursor,
  };
}

/**
 * Create paginated response
 */
export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  return {
    data,
    meta: buildPaginationMeta(total, page, limit),
  };
}

// ============================================================================
// CURSOR-BASED PAGINATION
// ============================================================================

/**
 * Build cursor pagination query options
 */
export function buildCursorQuery(
  params: CursorPaginationParams,
  orderField: string = 'createdAt'
): {
  take: number;
  skip: number;
  cursor?: { id: string };
  orderBy: Record<string, 'asc' | 'desc'>;
} {
  const limit = Math.min(Math.max(1, params.limit || 20), 100);
  const direction = params.direction || 'forward';

  return {
    take: direction === 'forward' ? limit + 1 : -(limit + 1),
    skip: params.cursor ? 1 : 0,
    cursor: params.cursor ? { id: params.cursor } : undefined,
    orderBy: { [orderField]: direction === 'forward' ? 'desc' : 'asc' },
  };
}

/**
 * Process cursor pagination results
 */
export function processCursorResult<T extends { id: string }>(
  items: T[],
  limit: number,
  direction: 'forward' | 'backward' = 'forward'
): CursorPaginationResult<T> {
  const hasMore = items.length > limit;
  const actualItems = hasMore ? items.slice(0, limit) : items;

  if (direction === 'backward') {
    actualItems.reverse();
  }

  return {
    items: actualItems,
    nextCursor: actualItems.length > 0 ? actualItems[actualItems.length - 1].id : null,
    previousCursor: actualItems.length > 0 ? actualItems[0].id : null,
    hasMore,
  };
}

// ============================================================================
// FIELD SELECTION
// ============================================================================

/**
 * Build Prisma select object from field list
 * Prevents over-fetching by selecting only requested fields
 */
export function buildSelect(fields?: string[]): Record<string, boolean> | undefined {
  if (!fields || fields.length === 0) return undefined;

  const select: Record<string, boolean> = {};
  for (const field of fields) {
    // Handle nested fields (e.g., 'user.name')
    if (field.includes('.')) {
      const [parent, ...rest] = field.split('.');
      if (!select[parent]) {
        select[parent] = true; // Will need to handle nested select separately
      }
    } else {
      select[field] = true;
    }
  }

  return select;
}

/**
 * Build Prisma include object from relations list
 * Prevents N+1 queries by including relations upfront
 */
export function buildInclude(relations?: string[]): Record<string, boolean | object> | undefined {
  if (!relations || relations.length === 0) return undefined;

  const include: Record<string, boolean | object> = {};
  for (const relation of relations) {
    // Handle nested relations (e.g., 'projects.milestones')
    if (relation.includes('.')) {
      const [parent, ...rest] = relation.split('.');
      const nested = buildInclude(rest);
      include[parent] = nested ? { include: nested } : true;
    } else {
      include[relation] = true;
    }
  }

  return include;
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Build Prisma orderBy from sort parameters
 */
export function buildOrderBy(
  params: SortParams,
  allowedFields: string[],
  defaultSort?: { field: string; order: 'asc' | 'desc' }
): Record<string, 'asc' | 'desc'> | undefined {
  const { sortBy, sortOrder = 'asc' } = params;

  if (sortBy && allowedFields.includes(sortBy)) {
    return { [sortBy]: sortOrder };
  }

  if (defaultSort) {
    return { [defaultSort.field]: defaultSort.order };
  }

  return undefined;
}

// ============================================================================
// SEARCH
// ============================================================================

/**
 * Build Prisma where clause for text search across multiple fields
 */
export function buildSearchWhere(
  search: string | undefined,
  searchFields: string[]
): object | undefined {
  if (!search || searchFields.length === 0) return undefined;

  const searchTerm = search.trim();
  if (!searchTerm) return undefined;

  return {
    OR: searchFields.map((field) => ({
      [field]: {
        contains: searchTerm,
        mode: 'insensitive',
      },
    })),
  };
}

// ============================================================================
// BATCH LOADING HELPERS
// ============================================================================

/**
 * Batch load related entities to avoid N+1 queries
 * Use this when you need to load relations for multiple items
 */
export async function batchLoad<T, K extends string | number>(
  ids: K[],
  loader: (ids: K[]) => Promise<Map<K, T>>
): Promise<Map<K, T>> {
  if (ids.length === 0) {
    return new Map();
  }

  // Deduplicate IDs
  const uniqueIds = [...new Set(ids)];
  return loader(uniqueIds);
}

/**
 * Create a batch loader function for a specific entity
 */
export function createBatchLoader<T, K extends string | number>(
  fetchFn: (ids: K[]) => Promise<T[]>,
  getKey: (item: T) => K
): (ids: K[]) => Promise<Map<K, T>> {
  return async (ids: K[]) => {
    const items = await fetchFn(ids);
    const map = new Map<K, T>();
    for (const item of items) {
      map.set(getKey(item), item);
    }
    return map;
  };
}

/**
 * Chunk array for batch processing
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Process items in batches to avoid overwhelming the database
 */
export async function batchProcess<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  batchSize = 10
): Promise<R[]> {
  const results: R[] = [];
  const chunks = chunkArray(items, batchSize);

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map(processFn));
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Process items in batches with concurrency control
 */
export async function batchProcessConcurrent<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  options: { batchSize?: number; concurrency?: number } = {}
): Promise<R[]> {
  const { batchSize = 10, concurrency = 3 } = options;
  const results: R[] = [];
  const chunks = chunkArray(items, batchSize);

  // Process chunks with concurrency limit
  for (let i = 0; i < chunks.length; i += concurrency) {
    const concurrentChunks = chunks.slice(i, i + concurrency);
    const chunkPromises = concurrentChunks.map((chunk) =>
      Promise.all(chunk.map(processFn))
    );
    const concurrentResults = await Promise.all(chunkPromises);
    results.push(...concurrentResults.flat());
  }

  return results;
}

// ============================================================================
// CACHED QUERIES
// ============================================================================

/**
 * Execute a query with caching
 */
export async function cachedQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try cache first
  const cached = await cacheGet<T>(cacheKey);
  if (cached !== null) {
    logger.debug('Query cache hit', { key: cacheKey });
    return cached;
  }

  // Execute query
  const result = await queryFn();

  // Cache result
  await cacheSet(cacheKey, result as object, options);
  logger.debug('Query cached', { key: cacheKey });

  return result;
}

/**
 * Invalidate cached query results
 */
export async function invalidateCachedQuery(cacheKey: string): Promise<void> {
  await cacheDel(cacheKey);
  logger.debug('Query cache invalidated', { key: cacheKey });
}

// ============================================================================
// QUERY PERFORMANCE HELPERS
// ============================================================================

/**
 * Log slow queries in development
 */
export function wrapWithTiming<T>(
  name: string,
  fn: () => Promise<T>,
  thresholdMs = 100
): Promise<T> {
  if (process.env.NODE_ENV !== 'development') {
    return fn();
  }

  const start = performance.now();
  return fn().finally(() => {
    const duration = performance.now() - start;
    if (duration > thresholdMs) {
      console.warn(`[SLOW QUERY] ${name}: ${duration.toFixed(2)}ms`);
    }
  });
}

/**
 * Execute queries in parallel when they're independent
 */
export async function parallelQueries<T extends readonly unknown[]>(
  queries: { [K in keyof T]: () => Promise<T[K]> }
): Promise<T> {
  return Promise.all(queries.map((q) => q())) as unknown as Promise<T>;
}

// ============================================================================
// DATE RANGE HELPERS
// ============================================================================

/**
 * Build date range filter for queries
 */
export function buildDateRangeWhere(
  field: string,
  startDate?: Date,
  endDate?: Date
): object | undefined {
  if (!startDate && !endDate) return undefined;

  const conditions: object[] = [];

  if (startDate) {
    conditions.push({ [field]: { gte: startDate } });
  }
  if (endDate) {
    conditions.push({ [field]: { lte: endDate } });
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return { AND: conditions };
}

/**
 * Calculate date range for common periods
 */
export function getDateRange(period: 'day' | 'week' | 'month' | 'quarter' | 'year'): {
  startDate: Date;
  endDate: Date;
} {
  const now = new Date();
  const endDate = new Date(now);
  let startDate: Date;

  switch (period) {
    case 'day':
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
  }

  return { startDate, endDate };
}

// ============================================================================
// AGGREGATION HELPERS
// ============================================================================

/**
 * Calculate progress from milestone statuses
 */
export function calculateProgress(
  milestones: Array<{ status: string }>
): number {
  if (milestones.length === 0) return 0;
  const completed = milestones.filter((m) => m.status === 'COMPLETED').length;
  return Math.round((completed / milestones.length) * 100);
}

/**
 * Add progress to project list
 */
export function addProgressToProjects<
  T extends { milestones?: Array<{ status: string }> }
>(projects: T[]): Array<T & { progress: number }> {
  return projects.map((project) => ({
    ...project,
    progress: calculateProgress(project.milestones || []),
  }));
}

// ============================================================================
// QUERY PERFORMANCE TRACKING
// ============================================================================

interface QueryMetrics {
  count: number;
  totalDuration: number;
  avgDuration: number;
  slowQueries: number;
}

const queryMetrics = new Map<string, QueryMetrics>();
const SLOW_QUERY_THRESHOLD_MS = 1000;

/**
 * Track query performance
 */
export function trackQuery(queryName: string, durationMs: number): void {
  const existing = queryMetrics.get(queryName) || {
    count: 0,
    totalDuration: 0,
    avgDuration: 0,
    slowQueries: 0,
  };

  existing.count++;
  existing.totalDuration += durationMs;
  existing.avgDuration = existing.totalDuration / existing.count;
  if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
    existing.slowQueries++;
    logger.warn('Slow query detected', { queryName, durationMs });
  }

  queryMetrics.set(queryName, existing);
}

/**
 * Get query metrics
 */
export function getQueryMetrics(): Map<string, QueryMetrics> {
  return new Map(queryMetrics);
}

/**
 * Clear query metrics
 */
export function clearQueryMetrics(): void {
  queryMetrics.clear();
}

/**
 * Measure query execution time
 */
export async function measureQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await queryFn();
    trackQuery(queryName, Date.now() - start);
    return result;
  } catch (error) {
    trackQuery(queryName, Date.now() - start);
    throw error;
  }
}

// ============================================================================
// QUERY BUILDERS
// ============================================================================

/**
 * Build a complete Prisma findMany query with all optimizations
 */
export function buildFindManyArgs(options: QueryOptions, allowedSortFields: string[] = []) {
  const { skip, take, page } = parsePagination(options);

  return {
    skip,
    take,
    select: buildSelect(options.fields),
    include: buildInclude(options.include),
    orderBy: buildOrderBy(options, allowedSortFields),
    _meta: { page, limit: take }, // For pagination meta
  };
}
