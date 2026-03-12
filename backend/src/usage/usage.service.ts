import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { RedisService } from '../redis/redis.service';
import { UsageEntity } from './entities/usage.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly redisService: RedisService,
  ) {}

  async recordUsage(params: {
    userId: string;
    amount: number;
    usageCount: number;
    description?: string;
  }): Promise<UsageEntity> {
    const period = this.getCurrentPeriod();

    const usage = await this.prisma.usageRecord.upsert({
      where: {
        userId_period: {
          userId: params.userId,
          period,
        },
      },
      update: {
        amount: { increment: params.amount },
        usageCount: { increment: params.usageCount },
        description: params.description,
      },
      create: {
        userId: params.userId,
        period,
        amount: params.amount,
        usageCount: params.usageCount,
        description: params.description,
      },
    });

    return this.toEntity(usage);
  }

  async findByUser(userId: string): Promise<UsageEntity[]> {
    const records = await this.prisma.usageRecord.findMany({
      where: { userId },
      orderBy: { period: 'desc' },
    });

    return records.map((r) => this.toEntity(r));
  }

  async previewNextBill(userId: string): Promise<{
    period: string;
    totalAmount: number;
    usageCount: number;
    description: string;
  } | null> {
    const period = this.getCurrentPeriod();

    const record = await this.prisma.usageRecord.findUnique({
      where: {
        userId_period: {
          userId,
          period,
        },
      },
    });

    if (!record) {
      return null;
    }

    return {
      period: record.period,
      totalAmount: record.amount,
      usageCount: record.usageCount,
      description: record.description || `Usage for ${record.period}`,
    };
  }

  async generateMonthlyBilling(params: {
    userId: string;
    stripeCustomerId: string;
    period?: string;
  }): Promise<{ success: boolean; paymentId?: string; error?: string }> {
    const period = params.period || this.getPreviousPeriod();

    // Get unbilled usage
    const usage = await this.prisma.usageRecord.findUnique({
      where: {
        userId_period: {
          userId: params.userId,
          period,
        },
      },
    });

    if (!usage || usage.billed || usage.amount === 0) {
      return { success: true }; // Nothing to bill
    }

    // Get default payment method
    const defaultPm = await this.paymentMethodsService.getDefaultForUser(
      params.userId,
    );

    if (!defaultPm) {
      this.logger.warn(`No default payment method for user ${params.userId}`);
      return {
        success: false,
        error: 'No default payment method found',
      };
    }

    // Create idempotency key
    const idempotencyKey = `billing:${params.userId}:${period}:${uuidv4()}`;

    try {
      // Create off-session payment intent
      const stripePi = await this.stripeService.createPaymentIntent({
        amount: usage.amount,
        currency: 'usd',
        customerId: params.stripeCustomerId,
        paymentMethodId: defaultPm.stripePmId,
        offSession: true,
        confirm: true,
        description: `Monthly usage billing for ${period}`,
        metadata: {
          userId: params.userId,
          period,
          usageId: usage.id,
          usageCount: usage.usageCount.toString(),
        },
        idempotencyKey,
      });

      // Create payment record
      const payment = await this.prisma.paymentRecord.create({
        data: {
          userId: params.userId,
          stripePaymentIntentId: stripePi.id,
          amount: usage.amount,
          currency: 'usd',
          status: stripePi.status.toUpperCase(),
          paymentMethodId: defaultPm.id,
          description: `Monthly usage billing for ${period}`,
          metadata: stripePi.metadata,
        },
      });

      // Mark usage as billed
      await this.prisma.usageRecord.update({
        where: { id: usage.id },
        data: {
          billed: true,
          paymentId: payment.id,
        },
      });

      this.logger.log(
        `Billed user ${params.userId} $${usage.amount / 100} for ${period}`,
      );

      return {
        success: stripePi.status === 'succeeded',
        paymentId: payment.id,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to bill user ${params.userId} for ${period}: ${error.message}`,
      );

      // Create failed payment record
      await this.prisma.paymentRecord.create({
        data: {
          userId: params.userId,
          stripePaymentIntentId: `failed_${uuidv4()}`,
          amount: usage.amount,
          currency: 'usd',
          status: 'FAILED',
          paymentMethodId: defaultPm.id,
          description: `Monthly usage billing for ${period}`,
          errorMessage: error.message,
        },
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  async generateAllMonthlyBilling(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const period = this.getPreviousPeriod();

    // Get all users with unbilled usage
    const unbilledRecords = await this.prisma.usageRecord.findMany({
      where: {
        period,
        billed: false,
        amount: { gt: 0 },
      },
      include: {
        user: true,
      },
    });

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const record of unbilledRecords) {
      processed++;

      if (!record.user.stripeCustomerId) {
        failed++;
        continue;
      }

      const result = await this.generateMonthlyBilling({
        userId: record.userId,
        stripeCustomerId: record.user.stripeCustomerId,
        period,
      });

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    this.logger.log(
      `Monthly billing complete: ${processed} processed, ${succeeded} succeeded, ${failed} failed`,
    );

    return { processed, succeeded, failed };
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private getPreviousPeriod(): string {
    const now = new Date();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = now.getMonth() === 0 ? 12 : now.getMonth();
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  private toEntity(record: any): UsageEntity {
    return {
      id: record.id,
      period: record.period,
      amount: record.amount,
      usageCount: record.usageCount,
      description: record.description,
      billed: record.billed,
      paymentId: record.paymentId,
      createdAt: record.createdAt,
    };
  }
}
