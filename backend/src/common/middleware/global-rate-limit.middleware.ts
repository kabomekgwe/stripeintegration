import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../redis/redis.service';

/**
 * Global rate limiting middleware.
 * Applies a default rate limit of 100 requests per minute per IP address
 * to all routes except health check endpoints.
 *
 * This middleware runs before guards and provides a first line of defense
 * against abuse and DDoS attacks.
 */
@Injectable()
export class GlobalRateLimitMiddleware implements NestMiddleware {
  /**
   * Default rate limit: 100 requests per minute per IP
   */
  private readonly DEFAULT_LIMIT = 100;
  private readonly WINDOW_SECONDS = 60;

  constructor(private readonly redisService: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Skip rate limiting for health check endpoints
    if (this.isHealthEndpoint(req)) {
      return next();
    }

    const ip = this.extractIp(req);
    const key = `rate_limit:global:${ip}`;

    const result = await this.redisService.checkRateLimit(
      key,
      this.DEFAULT_LIMIT,
      this.WINDOW_SECONDS,
    );

    // Add rate limit headers to response
    res.setHeader('X-RateLimit-Limit', this.DEFAULT_LIMIT);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    res.setHeader('X-RateLimit-Reset', result.resetTime);

    if (!result.allowed) {
      // Calculate retry after in seconds
      const retryAfter = Math.ceil(result.resetTime - Date.now() / 1000);
      res.setHeader('Retry-After', retryAfter);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded. Please try again later.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
        {
          cause: new Error(`Global rate limit exceeded for IP: ${ip}`),
          description: `Retry after ${retryAfter} seconds`,
        },
      );
    }

    next();
  }

  /**
   * Checks if the request is for a health check endpoint.
   * Health endpoints are excluded from rate limiting.
   */
  private isHealthEndpoint(req: Request): boolean {
    const path = req.path;
    return path === '/health' || path === '/health/ready' || path.startsWith('/health/');
  }

  /**
   * Extracts the client IP address from the request.
   * Handles various proxy configurations.
   */
  private extractIp(req: Request): string {
    // Check for X-Forwarded-For header (common with proxies/load balancers)
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded) {
      return forwarded.split(',')[0].trim();
    }

    // Check for X-Real-IP header (common with nginx)
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp) {
      return realIp;
    }

    // Fall back to connection remote address
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }
}
