import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * TTL presets for different cache strategies
 */
export const CacheTTL = {
  SHORT: 60, // 1 minute - for frequently changing data
  MEDIUM: 300, // 5 minutes - for moderately changing data
  LONG: 3600, // 1 hour - for stable data
  VERY_LONG: 86400, // 24 hours - for rarely changing data
} as const;

/**
 * Cache key prefixes for namespacing
 */
export const CachePrefix = {
  USER: 'user',
  PAYMENT: 'payment',
  SUBSCRIPTION: 'subscription',
  STRIPE: 'stripe',
  CURRENCY: 'currency',
  RATE: 'rate',
  SESSION: 'session',
  IDEMPOTENCY: 'idempotency',
  WEBHOOK: 'webhook',
} as const;

/**
 * Options for cache operations
 */
export interface CacheOptions {
  ttlSeconds?: number;
  prefix?: string;
  suppressErrors?: boolean;
}

/**
 * Options for get-or-set pattern
 */
export interface GetOrSetOptions<T> extends CacheOptions {
  refreshOnError?: boolean;
}

/**
 * Result of cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * Reusable cache service with type-safe operations
 * and common caching patterns
 */
@Injectable()
export class CacheService {
  private readonly defaultTTL = CacheTTL.MEDIUM;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  // ==================== Core Operations ====================

  /**
   * Get a cached value with type safety
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const data = await this.redis.get(fullKey);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as T;
    } catch (error) {
      if (options?.suppressErrors !== false) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Set a cached value with automatic serialization
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.buildKey(key, options?.prefix);
    const ttl = options?.ttlSeconds ?? this.defaultTTL;

    await this.redis.setex(fullKey, ttl, JSON.stringify(value));
  }

  /**
   * Delete a cached value
   */
  async delete(key: string, prefix?: string): Promise<void> {
    const fullKey = this.buildKey(key, prefix);
    await this.redis.del(fullKey);
  }

  /**
   * Check if a key exists
   */
  async exists(key: string, prefix?: string): Promise<boolean> {
    const fullKey = this.buildKey(key, prefix);
    const result = await this.redis.exists(fullKey);
    return result === 1;
  }

  /**
   * Get remaining TTL of a key
   */
  async getTTL(key: string, prefix?: string): Promise<number> {
    const fullKey = this.buildKey(key, prefix);
    return this.redis.ttl(fullKey);
  }

  /**
   * Extend TTL of an existing key
   */
  async extendTTL(key: string, ttlSeconds: number, prefix?: string): Promise<boolean> {
    const fullKey = this.buildKey(key, prefix);
    const result = await this.redis.expire(fullKey, ttlSeconds);
    return result === 1;
  }

  // ==================== Get-Or-Set Pattern ====================

  /**
   * Get from cache or fetch and cache the result
   * Implements the cache-aside pattern
   */
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, options?: GetOrSetOptions<T>): Promise<T> {
    const cached = await this.get<T>(key, { ...options, suppressErrors: true });

    if (cached !== null) {
      return cached;
    }

    try {
      const fresh = await fetcher();
      await this.set(key, fresh, options);
      return fresh;
    } catch (error) {
      if (!options?.refreshOnError) {
        const staleCache = await this.get<T>(key, options);
        if (staleCache !== null) {
          return staleCache;
        }
      }
      throw error;
    }
  }

  // ==================== Batch Operations ====================

  /**
   * Get multiple values at once
   */
  async getMany<T>(keys: string[], prefix?: string): Promise<Map<string, T | null>> {
    if (keys.length === 0) {
      return new Map();
    }

    const fullKeys = keys.map((k) => this.buildKey(k, prefix));
    const values = await this.redis.mget(...fullKeys);

    const result = new Map<string, T | null>();
    keys.forEach((key, index) => {
      const value = values[index];
      result.set(key, value ? JSON.parse(value) : null);
    });

    return result;
  }

  /**
   * Set multiple values at once
   */
  async setMany<T>(entries: Array<{ key: string; value: T }>, options?: CacheOptions): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const ttl = options?.ttlSeconds ?? this.defaultTTL;
    const pipeline = this.redis.pipeline();

    for (const { key, value } of entries) {
      const fullKey = this.buildKey(key, options?.prefix);
      pipeline.setex(fullKey, ttl, JSON.stringify(value));
    }

    await pipeline.exec();
  }

  /**
   * Delete multiple keys at once
   */
  async deleteMany(keys: string[], prefix?: string): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    const fullKeys = keys.map((k) => this.buildKey(k, prefix));
    const result = await this.redis.del(...fullKeys);
    return result;
  }

  // ==================== Pattern Operations ====================

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string, prefix?: string): Promise<number> {
    const fullPattern = prefix ? `${prefix}:${pattern}` : pattern;
    const keys = await this.scanKeys(fullPattern);

    if (keys.length === 0) {
      return 0;
    }

    await this.redis.del(...keys);
    return keys.length;
  }

  /**
   * Scan keys matching a pattern without blocking
   */
  async scanKeys(pattern: string, count = 100): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, scannedKeys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', count);
      cursor = nextCursor;
      keys.push(...scannedKeys);
    } while (cursor !== '0');

    return keys;
  }

  // ==================== Atomic Operations ====================

  /**
   * Increment a counter
   */
  async increment(key: string, by = 1, options?: CacheOptions): Promise<number> {
    const fullKey = this.buildKey(key, options?.prefix);

    if (options?.ttlSeconds) {
      const result = await this.redis.incrby(fullKey, by);
      await this.redis.expire(fullKey, options.ttlSeconds);
      return result;
    }

    return this.redis.incrby(fullKey, by);
  }

  /**
   * Decrement a counter
   */
  async decrement(key: string, by = 1, options?: CacheOptions): Promise<number> {
    return this.increment(key, -by, options);
  }

  // ==================== Lock Operations ====================

  /**
   * Acquire a distributed lock
   */
  async acquireLock(key: string, ttlSeconds: number, prefix?: string): Promise<boolean> {
    const fullKey = this.buildKey(key, prefix ?? 'lock');
    const result = await this.redis.set(fullKey, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Release a distributed lock
   */
  async releaseLock(key: string, prefix?: string): Promise<void> {
    await this.delete(key, prefix ?? 'lock');
  }

  /**
   * Execute a function with a lock
   */
  async withLock<T>(key: string, ttlSeconds: number, fn: () => Promise<T>, prefix?: string): Promise<T> {
    const acquired = await this.acquireLock(key, ttlSeconds, prefix);

    if (!acquired) {
      throw new Error(`Failed to acquire lock: ${key}`);
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(key, prefix);
    }
  }

  // ==================== Rate Limiting ====================

  /**
   * Check rate limit using sliding window
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
    prefix?: string,
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const fullKey = this.buildKey(key, prefix ?? 'ratelimit');
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSeconds;

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(fullKey, 0, windowStart);
    pipeline.zcard(fullKey);
    pipeline.zadd(fullKey, now, `${now}-${Math.random().toString(36).slice(2)}`);
    pipeline.expire(fullKey, windowSeconds);

    const results = await pipeline.exec();
    const currentCount = (results?.[1]?.[1] as number) ?? 0;

    if (currentCount >= limit) {
      await this.redis.zpopmin(fullKey, 1);
      return { allowed: false, remaining: 0, resetTime: now + windowSeconds };
    }

    return { allowed: true, remaining: limit - currentCount - 1, resetTime: now + windowSeconds };
  }

  // ==================== Cache Statistics ====================

  /**
   * Get cache statistics for monitoring
   */
  async getStats(): Promise<CacheStats> {
    const info = await this.redis.info('stats');
    const lines = info.split('\r\n');

    let hits = 0;
    let misses = 0;

    for (const line of lines) {
      if (line.startsWith('keyspace_hits:')) {
        hits = parseInt(line.split(':')[1], 10);
      } else if (line.startsWith('keyspace_misses:')) {
        misses = parseInt(line.split(':')[1], 10);
      }
    }

    const total = hits + misses;
    const hitRate = total > 0 ? hits / total : 0;

    return { hits, misses, hitRate };
  }

  // ==================== Key Building ====================

  private buildKey(key: string, prefix?: string): string {
    if (prefix) {
      return `${prefix}:${key}`;
    }
    return key;
  }

  static buildKey(...segments: (string | number)[]): string {
    return segments.join(':');
  }

  // ==================== Convenience Key Builders ====================

  userKey(userId: string, suffix?: string): string {
    return suffix ? `${CachePrefix.USER}:${userId}:${suffix}` : `${CachePrefix.USER}:${userId}`;
  }

  paymentKey(paymentId: string, suffix?: string): string {
    return suffix ? `${CachePrefix.PAYMENT}:${paymentId}:${suffix}` : `${CachePrefix.PAYMENT}:${paymentId}`;
  }

  stripeKey(entityType: string, stripeId: string): string {
    return `${CachePrefix.STRIPE}:${entityType}:${stripeId}`;
  }

  subscriptionKey(subscriptionId: string, suffix?: string): string {
    return suffix
      ? `${CachePrefix.SUBSCRIPTION}:${subscriptionId}:${suffix}`
      : `${CachePrefix.SUBSCRIPTION}:${subscriptionId}`;
  }

  currencyRateKey(from: string, to: string): string {
    return `${CachePrefix.CURRENCY}:${CachePrefix.RATE}:${from}:${to}`;
  }

  webhookKey(eventId: string, suffix?: string): string {
    return suffix ? `${CachePrefix.WEBHOOK}:${eventId}:${suffix}` : `${CachePrefix.WEBHOOK}:${eventId}`;
  }
}