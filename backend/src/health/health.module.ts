import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '../database/prisma.service';

/**
 * Health check module for monitoring and observability.
 *
 * Exports:
 * - HealthController: HTTP endpoints for health checks
 * - HealthService: Health check business logic
 *
 * Endpoints:
 * - GET /health: Liveness probe
 * - GET /health/ready: Readiness probe with dependency checks
 */
@Module({
  controllers: [HealthController],
  providers: [HealthService, PrismaService],
  exports: [HealthService],
})
export class HealthModule {}
