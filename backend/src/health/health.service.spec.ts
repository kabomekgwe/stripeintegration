import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { HealthService } from './health.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('HealthService', () => {
  let service: HealthService;
  let prismaService: ReturnType<typeof vi.mocked<PrismaService>>;
  let redisService: ReturnType<typeof vi.mocked<RedisService>>;

  const mockPrismaService = {
    $queryRaw: vi.fn(),
  };

  const mockRedisService = {
    get: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);

    vi.clearAllMocks();
  });

  describe('checkLiveness', () => {
    it('should return ok status with timestamp', async () => {
      const result = await service.checkLiveness();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });

  describe('checkReadiness', () => {
    it('should return healthy when all dependencies are up', async () => {
      prismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      redisService.get.mockResolvedValue(null);

      const result = await service.checkReadiness();

      expect(result.status).toBe('healthy');
      expect(result.checks.database).toBe('up');
      expect(result.checks.redis).toBe('up');
      expect(result.timestamp).toBeDefined();
    });

    it('should return unhealthy when database is down', async () => {
      prismaService.$queryRaw.mockRejectedValue(new Error('Connection failed'));
      redisService.get.mockResolvedValue(null);

      const result = await service.checkReadiness();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database).toBe('down');
      expect(result.checks.redis).toBe('up');
    });

    it('should return unhealthy when redis is down', async () => {
      prismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      redisService.get.mockRejectedValue(new Error('Connection failed'));

      const result = await service.checkReadiness();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database).toBe('up');
      expect(result.checks.redis).toBe('down');
    });

    it('should return unhealthy when both dependencies are down', async () => {
      prismaService.$queryRaw.mockRejectedValue(new Error('DB Connection failed'));
      redisService.get.mockRejectedValue(new Error('Redis Connection failed'));

      const result = await service.checkReadiness();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database).toBe('down');
      expect(result.checks.redis).toBe('down');
    });

    it('should include ISO timestamp in response', async () => {
      prismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      redisService.get.mockResolvedValue(null);

      const result = await service.checkReadiness();

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });
});
