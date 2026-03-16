import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class CacheService {
  constructor(private readonly redisService: RedisService) {}

  /**
   * Retrieve a cached value by key
   * @param key - The cache key
   * @returns The cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    const data = await this.redisService.get(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  /**
   * Store a value in the cache with a TTL
   * @param key - The cache key
   * @param value - The value to cache
   * @param ttlSeconds - Time to live in seconds
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redisService.set(key, JSON.stringify(value), ttlSeconds);
  }

  /**
   * Delete a cached value by key
   * @param key - The cache key to delete
   */
  async delete(key: string): Promise<void> {
    await this.redisService.del(key);
  }

  /**
   * Delete all cached values matching a pattern
   * @param pattern - The pattern to match (e.g., "user:*")
   */
  async deletePattern(pattern: string): Promise<void> {
    await this.redisService.deletePattern(pattern);
  }

  /**
   * Generate a cache key for a user
   * @param userId - The user ID
   * @returns The cache key
   */
  userKey(userId: string): string {
    return `user:${userId}`;
  }

  /**
   * Generate a cache key for a payment
   * @param paymentId - The payment ID
   * @returns The cache key
   */
  paymentKey(paymentId: string): string {
    return `payment:${paymentId}`;
  }

  /**
   * Generate a cache key for a Stripe payment intent
   * @param paymentIntentId - The Stripe payment intent ID
   * @returns The cache key
   */
  paymentIntentKey(paymentIntentId: string): string {
    return `payment:stripe:${paymentIntentId}`;
  }

  /**
   * Generate a cache key for a subscription
   * @param subscriptionId - The subscription ID
   * @returns The cache key
   */
  subscriptionKey(subscriptionId: string): string {
    return `subscription:${subscriptionId}`;
  }

  /**
   * Generate a cache key for a Stripe subscription
   * @param stripeSubscriptionId - The Stripe subscription ID
   * @returns The cache key
   */
  stripeSubscriptionKey(stripeSubscriptionId: string): string {
    return `subscription:stripe:${stripeSubscriptionId}`;
  }

  /**
   * Generate a cache key for webhook statistics
   * @returns The cache key
   */
  webhookStatsKey(): string {
    return 'webhook:stats';
  }
}
