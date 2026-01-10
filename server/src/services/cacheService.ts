/**
 * Cache Service
 * Redis-based caching for API responses and frequently accessed data.
 * Provides caching with Redis (production) or in-memory (development) backends.
 */

import { createClient, RedisClientType } from 'redis';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

// ============================================================================
// TYPES
// ============================================================================

export interface CacheConfig {
  provider: 'redis' | 'memory';
  redisUrl?: string;
  defaultTTL: number; // seconds
  keyPrefix: string;
  enabled: boolean;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for cache invalidation
}

export interface CachedItem<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
  tags?: string[];
}

export interface CacheStats {
  connected: boolean;
  keys: number;
  memory: string;
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

export interface CacheMiddlewareOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
}

type CacheValue = string | number | boolean | object | null;
type RedisClient = RedisClientType;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CACHE_PREFIX = 'sage:';
const DEFAULT_TTL = 300; // 5 minutes
const TAG_PREFIX = 'tag:';

// TTL presets in seconds
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  DAY: 86400, // 24 hours
  WEEK: 604800, // 7 days
} as const;

// Cache keys for common entities
export const CACHE_KEYS = {
  // User data
  user: (id: string) => `user:${id}`,
  userProfile: (id: string) => `user:${id}:profile`,

  // Project data
  project: (id: string) => `project:${id}`,
  projectList: (userId: string) => `projects:user:${userId}`,
  projectDetail: (id: string) => `project:${id}:detail`,
  projectMilestones: (projectId: string) => `project:${projectId}:milestones`,

  // Dashboard data
  adminDashboard: () => 'admin:dashboard',
  adminStats: (period: string) => `admin:stats:${period}`,
  analyticsData: (type: string, period: string) => `analytics:${type}:${period}`,

  // Tier data
  tiers: () => 'tiers:all',
  tier: (id: number) => `tier:${id}`,
  pricing: () => 'pricing:tiers',

  // Lead cache
  lead: (id: string) => `lead:${id}`,
  leadList: (page: number, limit: number) => `leads:list:${page}:${limit}`,

  // Notification counts
  unreadCount: (userId: string) => `notifications:unread:${userId}`,

  // Session cache
  session: (token: string) => `session:${token}`,
} as const;

// Cache tags
export const CacheTags = {
  USER: 'tag:user',
  PROJECT: 'tag:project',
  LEAD: 'tag:lead',
  PRICING: 'tag:pricing',
  ADMIN: 'tag:admin',
};

// ============================================================================
// IN-MEMORY CACHE IMPLEMENTATION
// ============================================================================

interface MemoryCacheEntry {
  value: string;
  expiresAt: number;
  tags: string[];
}

class MemoryCache {
  private cache: Map<string, MemoryCacheEntry> = new Map();
  private stats: CacheStats = {
    connected: true,
    keys: 0,
    memory: '0 KB',
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
  };

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    this.stats.hits++;
    this.updateHitRate();
    return entry.value;
  }

  async set(key: string, value: string, ttl: number, tags: string[] = []): Promise<void> {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
      tags,
    });
    this.stats.sets++;
    this.stats.keys = this.cache.size;
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
    this.stats.deletes++;
    this.stats.keys = this.cache.size;
  }

  async invalidateByTag(tag: string): Promise<number> {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.keys = this.cache.size;
    return count;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.keys = 0;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.cache.keys()).filter((key) => regex.test(key));
  }

  isConnected(): boolean {
    return true;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

// ============================================================================
// REDIS CACHE IMPLEMENTATION
// ============================================================================

class RedisCache {
  private client: RedisClient | null = null;
  private connected = false;
  private stats: CacheStats = {
    connected: false,
    keys: 0,
    memory: '0 KB',
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
  };

  async connect(redisUrl: string): Promise<void> {
    try {
      this.client = createClient({ url: redisUrl });

      this.client.on('error', (err) => {
        logger.error('[Cache] Redis error:', err);
        this.connected = false;
        this.stats.connected = false;
      });

      this.client.on('connect', () => {
        logger.info('[Cache] Connected to Redis');
        this.connected = true;
        this.stats.connected = true;
      });

      this.client.on('disconnect', () => {
        logger.warn('[Cache] Disconnected from Redis');
        this.connected = false;
        this.stats.connected = false;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('[Cache] Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.connected = false;
      this.stats.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;

    const value = await this.client.get(key);

    if (value === null) {
      this.stats.misses++;
    } else {
      this.stats.hits++;
    }
    this.updateHitRate();

    return value;
  }

  async set(key: string, value: string, ttl: number, tags: string[] = []): Promise<void> {
    if (!this.client) return;

    await this.client.setEx(key, ttl, value);
    this.stats.sets++;

    // Store tags for invalidation
    if (tags.length > 0) {
      await Promise.all(
        tags.map((tag) => this.client!.sAdd(`${CACHE_PREFIX}${TAG_PREFIX}${tag}`, key))
      );
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
    this.stats.deletes++;
  }

  async invalidateByTag(tag: string): Promise<number> {
    if (!this.client) return 0;

    const tagKey = `${CACHE_PREFIX}${TAG_PREFIX}${tag}`;
    const keys = await this.client.sMembers(tagKey);

    if (keys.length === 0) return 0;

    await this.client.del(keys);
    await this.client.del(tagKey);

    return keys.length;
  }

  async clear(): Promise<void> {
    if (!this.client) return;
    const keys = await this.client.keys(`${CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client) return [];
    return this.client.keys(pattern);
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  async getExtendedStats(): Promise<CacheStats | null> {
    if (!this.client || !this.isConnected()) return null;

    try {
      const info = await this.client.info('stats');
      const memory = await this.client.info('memory');
      const keyCount = await this.client.dbSize();

      const hitsMatch = info.match(/keyspace_hits:(\d+)/);
      const missesMatch = info.match(/keyspace_misses:(\d+)/);
      const memoryMatch = memory.match(/used_memory_human:([^\r\n]+)/);

      return {
        connected: true,
        keys: keyCount,
        memory: memoryMatch?.[1] || 'unknown',
        hits: parseInt(hitsMatch?.[1] || '0', 10),
        misses: parseInt(missesMatch?.[1] || '0', 10),
        sets: this.stats.sets,
        deletes: this.stats.deletes,
        hitRate: this.stats.hitRate,
      };
    } catch (error) {
      logger.error('[Cache] Stats error:', error);
      return null;
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

// ============================================================================
// CACHE SERVICE STATE
// ============================================================================

let config: CacheConfig = {
  provider: 'memory',
  defaultTTL: DEFAULT_TTL,
  keyPrefix: CACHE_PREFIX,
  enabled: true,
};

let memoryCache: MemoryCache | null = null;
let redisCache: RedisCache | null = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the cache service
 */
export async function initializeCache(overrides: Partial<CacheConfig> = {}): Promise<void> {
  config = { ...config, ...overrides };

  if (!config.enabled) {
    logger.info('[Cache] Cache service disabled');
    return;
  }

  if (config.provider === 'redis' && config.redisUrl) {
    try {
      redisCache = new RedisCache();
      await redisCache.connect(config.redisUrl);
      logger.info('[Cache] Cache service initialized with Redis');
    } catch (error) {
      logger.warn('[Cache] Redis connection failed, falling back to memory cache');
      memoryCache = new MemoryCache();
    }
  } else {
    memoryCache = new MemoryCache();
    logger.info('[Cache] Cache service initialized with memory cache');
  }
}

/**
 * Initialize cache service (alias for compatibility)
 */
export async function initCacheService(overrides: Partial<CacheConfig> = {}): Promise<void> {
  return initializeCache(overrides);
}

/**
 * Close cache connection
 */
export async function closeCache(): Promise<void> {
  if (redisCache) {
    await redisCache.disconnect();
    redisCache = null;
  }
  if (memoryCache) {
    await memoryCache.clear();
    memoryCache = null;
  }
}

/**
 * Get the active cache backend
 */
function getCache(): MemoryCache | RedisCache | null {
  if (!config.enabled) return null;
  return redisCache?.isConnected() ? redisCache : memoryCache;
}

/**
 * Build cache key with prefix
 */
function buildKey(key: string): string {
  return `${config.keyPrefix}${key}`;
}

/**
 * Check if cache is available
 */
export function isCacheAvailable(): boolean {
  return getCache() !== null;
}

// ============================================================================
// CORE CACHE OPERATIONS
// ============================================================================

/**
 * Get item from cache
 */
export async function get<T>(key: string): Promise<T | null> {
  const cache = getCache();
  if (!cache) return null;

  try {
    const fullKey = buildKey(key);
    const data = await cache.get(fullKey);

    if (!data) return null;

    const item: CachedItem<T> = JSON.parse(data);

    // Check if expired (shouldn't happen with TTL, but just in case)
    if (Date.now() > item.expiresAt) {
      await del(key);
      return null;
    }

    return item.data;
  } catch (error) {
    logger.error('[Cache] Get error:', error);
    return null;
  }
}

/**
 * Get item from cache (alias)
 */
export async function cacheGet<T = CacheValue>(key: string): Promise<T | null> {
  return get<T>(key);
}

/**
 * Set item in cache
 */
export async function set<T>(key: string, data: T, options: CacheOptions = {}): Promise<boolean> {
  const cache = getCache();
  if (!cache) return false;

  try {
    const ttl = options.ttl || config.defaultTTL;
    const fullKey = buildKey(key);

    const item: CachedItem<T> = {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl * 1000,
      tags: options.tags,
    };

    await cache.set(fullKey, JSON.stringify(item), ttl, options.tags);

    return true;
  } catch (error) {
    logger.error('[Cache] Set error:', error);
    return false;
  }
}

/**
 * Set item in cache (alias)
 */
export async function cacheSet(
  key: string,
  value: CacheValue,
  options: CacheOptions = {}
): Promise<void> {
  await set(key, value, options);
}

/**
 * Delete item from cache
 */
export async function del(key: string): Promise<boolean> {
  const cache = getCache();
  if (!cache) return false;

  try {
    const fullKey = buildKey(key);
    await cache.del(fullKey);
    return true;
  } catch (error) {
    logger.error('[Cache] Delete error:', error);
    return false;
  }
}

/**
 * Delete item from cache (alias)
 */
export async function cacheDel(key: string): Promise<void> {
  await del(key);
}

/**
 * Delete multiple items from cache
 */
export async function delMany(keys: string[]): Promise<boolean> {
  if (!isCacheAvailable() || keys.length === 0) return false;

  try {
    await Promise.all(keys.map((k) => del(k)));
    return true;
  } catch (error) {
    logger.error('[Cache] Delete many error:', error);
    return false;
  }
}

/**
 * Delete all items with a specific tag
 */
export async function invalidateTag(tag: string): Promise<boolean> {
  const cache = getCache();
  if (!cache) return false;

  try {
    await cache.invalidateByTag(tag);
    return true;
  } catch (error) {
    logger.error('[Cache] Invalidate tag error:', error);
    return false;
  }
}

/**
 * Delete all items with a specific tag (alias)
 */
export async function cacheInvalidateTag(tag: string): Promise<number> {
  const cache = getCache();
  if (!cache) return 0;

  return cache.invalidateByTag(tag);
}

/**
 * Invalidate multiple tags
 */
export async function invalidateTags(tags: string[]): Promise<boolean> {
  if (!isCacheAvailable() || tags.length === 0) return false;

  try {
    await Promise.all(tags.map(invalidateTag));
    return true;
  } catch (error) {
    logger.error('[Cache] Invalidate tags error:', error);
    return false;
  }
}

/**
 * Clear all cache
 */
export async function clear(): Promise<boolean> {
  const cache = getCache();
  if (!cache) return false;

  try {
    await cache.clear();
    return true;
  } catch (error) {
    logger.error('[Cache] Clear error:', error);
    return false;
  }
}

/**
 * Clear all cache (alias)
 */
export async function cacheClear(): Promise<void> {
  await clear();
}

// ============================================================================
// CACHE-ASIDE PATTERN
// ============================================================================

/**
 * Get or set pattern - tries cache first, falls back to fetcher
 */
export async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try to get from cache
  const cached = await get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();

  // Store in cache (don't await, fire and forget)
  set(key, data, options).catch((err) => logger.error('[Cache] Background set error:', err));

  return data;
}

/**
 * Memoize a function with caching
 */
export function memoize<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyGenerator: (...args: TArgs) => string,
  options: CacheOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const key = keyGenerator(...args);
    return getOrSet(key, () => fn(...args), options);
  };
}

/**
 * Wrap a function with caching
 */
export function withCache<T>(
  keyFn: (...args: unknown[]) => string,
  fn: (...args: unknown[]) => Promise<T>,
  options: CacheOptions = {}
): (...args: unknown[]) => Promise<T> {
  return async (...args: unknown[]): Promise<T> => {
    const key = keyFn(...args);

    // Try to get from cache
    const cached = await get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn(...args);
    await set(key, result, options);

    return result;
  };
}

// ============================================================================
// CACHE WARMING
// ============================================================================

interface WarmupTask {
  key: string;
  fetcher: () => Promise<unknown>;
  options?: CacheOptions;
}

/**
 * Warm up cache with frequently accessed data
 */
export async function warmCache(tasks: WarmupTask[]): Promise<void> {
  if (!isCacheAvailable()) return;

  logger.info(`[Cache] Warming ${tasks.length} items...`);

  await Promise.all(
    tasks.map(async (task) => {
      try {
        const data = await task.fetcher();
        await set(task.key, data, task.options);
      } catch (error) {
        logger.error(`[Cache] Warmup failed for ${task.key}:`, error);
      }
    })
  );

  logger.info('[Cache] Warmup complete');
}

// ============================================================================
// CACHE STATS
// ============================================================================

/**
 * Get cache statistics
 */
export async function getStats(): Promise<CacheStats | null> {
  const cache = getCache();
  if (!cache) return null;

  if (cache instanceof RedisCache) {
    return cache.getExtendedStats();
  }

  return cache.getStats();
}

/**
 * Get cache statistics (alias)
 */
export function cacheStats(): CacheStats | null {
  const cache = getCache();
  if (!cache) return null;

  return cache.getStats();
}

// ============================================================================
// ENTITY-SPECIFIC CACHE HELPERS
// ============================================================================

/**
 * Invalidate all project-related cache for a user
 */
export async function invalidateUserProjects(userId: string): Promise<void> {
  await del(CACHE_KEYS.projectList(userId));
}

/**
 * Invalidate project detail cache
 */
export async function invalidateProject(projectId: string): Promise<void> {
  await delMany([
    CACHE_KEYS.project(projectId),
    CACHE_KEYS.projectDetail(projectId),
    CACHE_KEYS.projectMilestones(projectId),
  ]);
}

/**
 * Invalidate admin dashboard cache
 */
export async function invalidateAdminDashboard(): Promise<void> {
  await delMany([
    CACHE_KEYS.adminDashboard(),
    CACHE_KEYS.adminStats('week'),
    CACHE_KEYS.adminStats('month'),
    CACHE_KEYS.adminStats('quarter'),
    CACHE_KEYS.adminStats('year'),
    CACHE_KEYS.adminStats('all'),
  ]);
}

/**
 * Invalidate user notification count
 */
export async function invalidateNotificationCount(userId: string): Promise<void> {
  await del(CACHE_KEYS.unreadCount(userId));
}

// ============================================================================
// EXPRESS MIDDLEWARE
// ============================================================================

/**
 * Express middleware for response caching
 */
export function cacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const {
    ttl = DEFAULT_TTL,
    keyGenerator = (req) => `route:${req.method}:${req.originalUrl}`,
    condition = () => true,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if caching disabled or condition not met
    if (!isCacheAvailable() || !condition(req)) {
      return next();
    }

    const key = keyGenerator(req);

    // Try to get cached response
    const cached = await get<{ body: unknown; contentType: string }>(key);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Content-Type', cached.contentType);
      return res.json(cached.body);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json to cache the response
    res.json = (body: unknown) => {
      // Cache the response
      set(
        key,
        {
          body,
          contentType: res.getHeader('Content-Type') || 'application/json',
        },
        { ttl }
      ).catch((err) => logger.error('[Cache] Middleware set error:', err));

      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types are exported at the top of the file

export default {
  initializeCache,
  initCacheService,
  closeCache,
  isCacheAvailable,
  get,
  set,
  del,
  delMany,
  invalidateTag,
  invalidateTags,
  clear,
  getOrSet,
  memoize,
  withCache,
  warmCache,
  getStats,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheInvalidateTag,
  cacheClear,
  cacheStats,
  cacheMiddleware,
  invalidateUserProjects,
  invalidateProject,
  invalidateAdminDashboard,
  invalidateNotificationCount,
  CACHE_TTL,
  CACHE_KEYS,
  CacheTags,
};
