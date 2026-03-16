import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * Health check service for monitoring application and dependencies.
 *
 * Provides:
 * - Liveness check: Simple ping to verify the service is running
 * - Readiness check: Verifies all dependencies (DB, Redis) are accessible
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Simple liveness check.
   * Returns ok status to indicate the service is alive.
   *
   * Used by: Kubernetes liveness probes, load balancers
   */
  async checkLiveness(): Promise<{
    status: string;
    timestamp: string;
  }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness check with dependency verification.
   * Verifies that all required dependencies are accessible.
   *
   * Checks:
   * - Database: Executes a simple SELECT 1 query
   * - Redis: Executes a PING command
   *
   * Returns:
   * - 200 status when all dependencies are healthy
   * - 503 status when any dependency is unhealthy
   *
   * Used by: Kubernetes readiness probes, deployment health checks
   */
  async checkReadiness(): Promise<{
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    checks: {
      database: 'up' | 'down';
      redis: 'up' | 'down';
    };
  }> {
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
    };

    const isHealthy = checks.database === 'up' && checks.redis === 'up';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  /**
   * Check database connectivity by executing a simple query.
   */
  private async checkDatabase(): Promise<'up' | 'down'> {
    try {
      // Execute a simple query to verify database connectivity
      await this.prismaService.$queryRaw`SELECT 1`;
      return 'up';
    } catch (error) {
      return 'down';
    }
  }

  /**
   * Check Redis connectivity by executing a PING command.
   */
  private async checkRedis(): Promise<'up' | 'down'> {
    try {
      // Try to get a value from Redis to verify connectivity
      await this.redisService.get('health_check');
      return 'up';
    } catch (error) {
      return 'down';
    }
  }
}
