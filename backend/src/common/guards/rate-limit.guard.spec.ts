import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { vi } from 'vitest';
import { RateLimitGuard } from './rate-limit.guard';
import { RedisService } from '../../redis/redis.service';
import { RATE_LIMIT_KEY } from '../decorators/rate-limit.decorator';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: Reflector;
  let redisService: ReturnType<typeof vi.mocked<RedisService>>;

  const mockRedisService = {
    checkRateLimit: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        Reflector,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
    reflector = module.get<Reflector>(Reflector);
    redisService = module.get(RedisService);

    vi.clearAllMocks();
  });

  describe('canActivate', () => {
    const createMockContext = (
      ip: string = '127.0.0.1',
      method: string = 'GET',
      path: string = '/test',
    ): ExecutionContext => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            ip,
            method,
            route: { path },
            headers: {},
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;
    };

    it('should allow requests under the rate limit', async () => {
      redisService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetTime: Date.now() / 1000 + 60,
      });

      const context = createMockContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redisService.checkRateLimit).toHaveBeenCalledWith(
        expect.stringContaining('rate_limit:'),
        100, // default limit
        60,
      );
    });

    it('should block requests over the rate limit', async () => {
      redisService.checkRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() / 1000 + 60,
      });

      const context = createMockContext();

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('should use custom rate limit from decorator metadata', async () => {
      redisService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetTime: Date.now() / 1000 + 60,
      });

      // Mock the reflector to return custom rate limit
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        limit: 5,
        windowMs: 60000,
      });

      const context = createMockContext();
      await guard.canActivate(context);

      expect(redisService.checkRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        5,
        60,
      );
    });

    it('should extract IP from x-forwarded-for header', async () => {
      redisService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetTime: Date.now() / 1000 + 60,
      });

      const context: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            ip: '127.0.0.1',
            method: 'GET',
            route: { path: '/test' },
            headers: {
              'x-forwarded-for': '10.0.0.1, 192.168.1.1',
            },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      await guard.canActivate(context);

      expect(redisService.checkRateLimit).toHaveBeenCalledWith(
        expect.stringContaining('10.0.0.1'),
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('should extract IP from x-real-ip header', async () => {
      redisService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetTime: Date.now() / 1000 + 60,
      });

      const context: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            ip: '127.0.0.1',
            method: 'GET',
            route: { path: '/test' },
            headers: {
              'x-real-ip': '10.0.0.2',
            },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      await guard.canActivate(context);

      expect(redisService.checkRateLimit).toHaveBeenCalledWith(
        expect.stringContaining('10.0.0.2'),
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('should use default rate limit when no decorator metadata', async () => {
      redisService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetTime: Date.now() / 1000 + 60,
      });

      // Mock the reflector to return undefined (no decorator)
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const context = createMockContext();
      await guard.canActivate(context);

      expect(redisService.checkRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        100, // default limit
        60,
      );
    });
  });
});
