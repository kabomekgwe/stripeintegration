import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

/**
 * Health check controller for monitoring endpoints.
 *
 * Provides endpoints for:
 * - Liveness probe: GET /health
 * - Readiness probe: GET /health/ready
 *
 * These endpoints are used by:
 * - Kubernetes for pod health monitoring
 * - Load balancers for traffic routing
 * - Monitoring systems for alerting
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Liveness probe endpoint.
   *
   * Returns 200 OK to indicate the service is alive.
   * This endpoint should be lightweight and always return success
   * unless the service is completely unresponsive.
   *
   * Response: { status: "ok", timestamp: "ISO-8601" }
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async checkLiveness() {
    return this.healthService.checkLiveness();
  }

  /**
   * Readiness probe endpoint.
   *
   * Returns 200 OK when all dependencies (DB, Redis) are accessible.
   * Returns 503 Service Unavailable when any dependency is down.
   *
   * This endpoint is used to determine if the service is ready
   * to receive traffic.
   *
   * Response (healthy): { status: "healthy", timestamp: "ISO-8601", checks: { database: "up", redis: "up" } }
   * Response (unhealthy): { status: "unhealthy", timestamp: "ISO-8601", checks: { database: "down", redis: "up" } }
   */
  @Get('ready')
  async checkReadiness() {
    const result = await this.healthService.checkReadiness();

    // Return 503 if unhealthy, 200 if healthy
    const statusCode = result.status === 'healthy'
      ? HttpStatus.OK
      : HttpStatus.SERVICE_UNAVAILABLE;

    return {
      ...result,
      statusCode,
    };
  }
}
