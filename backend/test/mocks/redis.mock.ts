import { vi } from 'vitest';
import { RedisService } from '../../src/redis/redis.service';

export type MockRedisService = {
  [K in keyof RedisService]: K extends 'redis' ? Redis : vi.Mock;
};

export function createMockRedisService(): MockRedisService {
  return {
    // Rate limiting
    checkRateLimit: vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 100,
      resetTime: Date.now() + 3600000,
    }),

    // Idempotency
    checkIdempotency: vi.fn().mockResolvedValue({ exists: false }),
    setIdempotency: vi.fn().mockResolvedValue(undefined),

    // Session management
    setSession: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockResolvedValue(null),
    deleteSession: vi.fn().mockResolvedValue(undefined),

    // Webhook locks
    acquireWebhookLock: vi.fn().mockResolvedValue(true),
    releaseWebhookLock: vi.fn().mockResolvedValue(undefined),

    // Payment intent cache
    cachePaymentIntent: vi.fn().mockResolvedValue(undefined),
    getCachedPaymentIntent: vi.fn().mockResolvedValue(null),

    // Retry counter
    incrementRetryCounter: vi.fn().mockResolvedValue(1),
    getRetryCount: vi.fn().mockResolvedValue(0),

    // General cache operations
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    deletePattern: vi.fn().mockResolvedValue(undefined),
  } as MockRedisService;
}

// Pre-created mock for simple imports
export const mockRedisService = createMockRedisService();
