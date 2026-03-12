import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  // Rate limiting
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSeconds;

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zcard(key);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.expire(key, windowSeconds);

    const results = await pipeline.exec();
    const currentCount = results?.[1]?.[1] as number;

    if (currentCount >= limit) {
      // Remove the entry we just added since we're over limit
      await this.redis.zpopmax(key, 1);
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + windowSeconds,
      };
    }

    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      resetTime: now + windowSeconds,
    };
  }

  // Idempotency keys
  async checkIdempotency(
    key: string,
  ): Promise<{ exists: boolean; response?: any }> {
    const stored = await this.redis.get(`idempotency:${key}`);
    if (stored) {
      return { exists: true, response: JSON.parse(stored) };
    }
    return { exists: false };
  }

  async setIdempotency(
    key: string,
    response: any,
    ttlHours: number = 24,
  ): Promise<void> {
    await this.redis.setex(
      `idempotency:${key}`,
      ttlHours * 3600,
      JSON.stringify(response),
    );
  }

  // Session management
  async setSession(
    token: string,
    userId: string,
    ttlHours: number = 24,
  ): Promise<void> {
    await this.redis.setex(`session:${token}`, ttlHours * 3600, userId);
  }

  async getSession(token: string): Promise<string | null> {
    return this.redis.get(`session:${token}`);
  }

  async deleteSession(token: string): Promise<void> {
    await this.redis.del(`session:${token}`);
  }

  // Webhook processing lock
  async acquireWebhookLock(
    eventId: string,
    ttlSeconds: number = 300,
  ): Promise<boolean> {
    const key = `webhook_lock:${eventId}`;
    const result = await this.redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseWebhookLock(eventId: string): Promise<void> {
    await this.redis.del(`webhook_lock:${eventId}`);
  }

  // Payment intent cache
  async cachePaymentIntent(
    paymentIntentId: string,
    data: any,
    ttlMinutes: number = 5,
  ): Promise<void> {
    await this.redis.setex(
      `pi:${paymentIntentId}`,
      ttlMinutes * 60,
      JSON.stringify(data),
    );
  }

  async getCachedPaymentIntent(paymentIntentId: string): Promise<any | null> {
    const data = await this.redis.get(`pi:${paymentIntentId}`);
    return data ? JSON.parse(data) : null;
  }

  // Retry counter for failed payments
  async incrementRetryCounter(paymentIntentId: string): Promise<number> {
    const key = `retry:${paymentIntentId}`;
    const count = await this.redis.incr(key);
    await this.redis.expire(key, 24 * 3600); // 24 hour TTL
    return count;
  }

  async getRetryCount(paymentIntentId: string): Promise<number> {
    const count = await this.redis.get(`retry:${paymentIntentId}`);
    return count ? parseInt(count, 10) : 0;
  }

  // General cache operations
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  // Pattern deletion
  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
