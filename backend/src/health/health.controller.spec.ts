import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HttpStatus } from '@nestjs/common';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: ReturnType<typeof vi.mocked<HealthService>>;

  const mockHealthService = {
    checkLiveness: vi.fn(),
    checkReadiness: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get(HealthService);

    vi.clearAllMocks();
  });

  describe('checkLiveness', () => {
    it('should return 200 with ok status', async () => {
      const mockResponse = {
        status: 'ok',
        timestamp: new Date().toISOString(),
      };
      healthService.checkLiveness.mockResolvedValue(mockResponse);

      const result = await controller.checkLiveness();

      expect(result).toEqual(mockResponse);
      expect(healthService.checkLiveness).toHaveBeenCalled();
    });

    it('should include timestamp in response', async () => {
      const mockResponse = {
        status: 'ok',
        timestamp: '2024-01-15T10:00:00.000Z',
      };
      healthService.checkLiveness.mockResolvedValue(mockResponse);

      const result = await controller.checkLiveness();

      expect(result.timestamp).toBeDefined();
    });
  });

  describe('checkReadiness', () => {
    it('should return 200 when healthy', async () => {
      const mockResponse = {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        checks: {
          database: 'up' as const,
          redis: 'up' as const,
        },
      };
      healthService.checkReadiness.mockResolvedValue(mockResponse);

      const result = await controller.checkReadiness();

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.status).toBe('healthy');
      expect(result.checks.database).toBe('up');
      expect(result.checks.redis).toBe('up');
    });

    it('should return 503 when unhealthy', async () => {
      const mockResponse = {
        status: 'unhealthy' as const,
        timestamp: new Date().toISOString(),
        checks: {
          database: 'down' as const,
          redis: 'up' as const,
        },
      };
      healthService.checkReadiness.mockResolvedValue(mockResponse);

      const result = await controller.checkReadiness();

      expect(result.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(result.status).toBe('unhealthy');
    });

    it('should include all dependency checks in response', async () => {
      const mockResponse = {
        status: 'healthy' as const,
        timestamp: '2024-01-15T10:00:00.000Z',
        checks: {
          database: 'up' as const,
          redis: 'up' as const,
        },
      };
      healthService.checkReadiness.mockResolvedValue(mockResponse);

      const result = await controller.checkReadiness();

      expect(result.checks).toBeDefined();
      expect(result.checks.database).toBeDefined();
      expect(result.checks.redis).toBeDefined();
    });

    it('should include timestamp in response', async () => {
      const mockResponse = {
        status: 'healthy' as const,
        timestamp: '2024-01-15T10:00:00.000Z',
        checks: {
          database: 'up' as const,
          redis: 'up' as const,
        },
      };
      healthService.checkReadiness.mockResolvedValue(mockResponse);

      const result = await controller.checkReadiness();

      expect(result.timestamp).toBe('2024-01-15T10:00:00.000Z');
    });
  });
});
