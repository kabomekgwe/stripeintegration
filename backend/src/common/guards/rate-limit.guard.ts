import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../redis/redis.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';

/**
 * Default rate limit configuration.
 * 100 requests per minute for general endpoints.
 */
const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  limit: 100,
  windowMs: 60000,
};

/**
 * Guard that enforces rate limiting on routes.
 * Uses Redis to track request counts per IP address.
 *
 * Configuration can be customized per route using the @RateLimit decorator.
 * Auth endpoints: @RateLimit(5, 60000) - 5 requests per minute
 * Payment endpoints: @RateLimit(10, 60000) - 10 requests per minute
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = this.extractIp(request);

    // Get route-specific rate limit or use default
    const rateLimit = this.getRateLimit(context);

    // Build rate limit key: rate_limit:{route}:{ip}
    const route = `${request.method}:${request.route?.path || 'unknown'}`;
    const key = `rate_limit:${route}:${ip}`;

    const windowSeconds = Math.ceil(rateLimit.windowMs / 1000);
    const result = await this.redisService.checkRateLimit(
      key,
      rateLimit.limit,
      windowSeconds,
    );

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded. Please try again later.',
          error: 'Too Many Requests',
          retryAfter: Math.ceil((result.resetTime - Date.now() / 1000)),
        },
        HttpStatus.TOO_MANY_REQUESTS,
        {
          cause: new Error('Rate limit exceeded'),
          description: `Retry after ${result.resetTime}`,
        },
      );
    }

    return true;
  }

  /**
   * Extracts the client IP address from the request.
   * Handles various proxy configurations.
   */
  private extractIp(request: any): string {
    // Check for X-Forwarded-For header (common with proxies)
    const forwarded = request.headers?.['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    // Check for X-Real-IP header
    const realIp = request.headers?.['x-real-ip'];
    if (realIp) {
      return realIp;
    }

    // Fall back to connection remote address
    return request.ip || request.connection?.remoteAddress || 'unknown';
  }

  /**
   * Gets the rate limit configuration for the current route.
   * Uses decorator metadata if available, otherwise uses defaults.
   */
  private getRateLimit(context: ExecutionContext): RateLimitOptions {
    const rateLimit = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    return rateLimit ?? DEFAULT_RATE_LIMIT;
  }
}
