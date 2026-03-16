import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export const RATE_LIMIT_KEY = 'rate_limit';

/**
 * Decorator to apply rate limiting to a route or controller.
 *
 * @param limit - Maximum number of requests allowed in the time window
 * @param windowMs - Time window in milliseconds
 *
 * @example
 * ```typescript
 * @RateLimit(5, 60000) // 5 requests per minute
 * @Post('login')
 * async login() { ... }
 * ```
 */
export const RateLimit = (limit: number, windowMs: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowMs });
