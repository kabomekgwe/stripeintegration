import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { RedisService } from '../redis/redis.service';
import { CacheService } from '../cache/cache.service';
import { MailService } from '../mail/mail.service';
import { TaxService } from '../tax/tax.service';
import { CurrencyService } from '../currency/currency.service';
import { ConfigService } from '@nestjs/config';
import { PaymentEntity } from './entities/payment.entity';
import { CreateRefundDto } from './dto/create-refund.dto';
import { PaymentStatus, RefundStatus, Prisma } from '@prisma/client';
import Stripe from 'stripe';

export interface RefundResult {
  refund: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: Date;
  };
  remainingRefundable: number;
}

interface RefundItem {
  id: string;
  amount: number;
  currency: string;
  status: RefundStatus;
  reason: string | null;
  description: string | null;
  createdAt: Date;
}

type StripeRefundReason = 'duplicate' | 'fraudulent' | 'requested_by_customer' | null;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly redisService: RedisService,
    private readonly cacheService: CacheService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly taxService: TaxService,
    private readonly currencyService: CurrencyService,
  ) {}

  async createPaymentIntent(params: {
    userId: string;
    stripeCustomerId: string;
    amount: number;
    currency: string;
    paymentMethodId?: string;
    description?: string;
    customerDetails?: {
      address: {
        line1: string;
        city?: string;
        state?: string;
        postal_code: string;
        country: string;
      };
    };
    countryCode?: string;
    idempotencyKey: string; // Required - comes from frontend
  }): Promise<{ clientSecret: string; paymentIntentId: string; taxAmount: number }> {
    const { idempotencyKey } = params;
    const amount = params.amount;

    // Determine payment method
    let paymentMethodStripeId: string | undefined;

    if (params.paymentMethodId) {
      const pm = await this.prisma.paymentMethod.findFirst({
        where: {
          id: params.paymentMethodId,
          userId: params.userId,
          isActive: true,
        },
      });
      if (!pm) {
        throw new NotFoundException('Payment method not found');
      }
      paymentMethodStripeId = pm.stripePmId;
    } else {
      const defaultPm = await this.paymentMethodsService.getDefaultForUser(params.userId);
      if (!defaultPm) {
        throw new BadRequestException(
          'No default payment method found. Please add a payment method first.',
        );
      }
      paymentMethodStripeId = defaultPm.stripePmId;
    }

    // Check Redis cache first (fast path)
    const cached = await this.redisService.checkIdempotency(idempotencyKey);
    if (cached.exists && cached.response) {
      return cached.response;
    }

    // Check DB for existing payment with this idempotency key (fallback safety net)
    const existingDbPayment = await this.prisma.paymentRecord.findUnique({
      where: { idempotencyKey },
    });
    if (existingDbPayment) {
      const response = {
        clientSecret: '',
        paymentIntentId: existingDbPayment.stripePaymentIntentId,
        taxAmount: existingDbPayment.taxAmount || 0,
      };
      await this.redisService.setIdempotency(idempotencyKey, response);
      return response;
    }

    // Calculate tax if enabled
    let taxAmount = 0;
    let taxRate = 0;
    let taxDisplayName: string | undefined;

    if (this.taxService.isTaxEnabled()) {
      try {
        const taxResult = await this.taxService.calculateTax({
          amount: amount,
          currency: params.currency,
          customerDetails: params.customerDetails,
        });
        taxAmount = taxResult.taxAmount;
        taxRate = taxResult.taxRate;
        taxDisplayName = taxResult.taxDisplayName;
      } catch (error) {
        if (this.configService.get('NODE_ENV') === 'development') {
          console.log('Tax calculation failed:', error);
        }
      }
    }

    const totalAmount = amount + taxAmount;

    // Create payment intent in Stripe
    const stripePi = await this.stripeService.createPaymentIntent({
      amount: totalAmount,
      currency: params.currency,
      customerId: params.stripeCustomerId,
      paymentMethodId: paymentMethodStripeId,
      description: params.description,
      metadata: {
        userId: params.userId,
        internalPaymentId: idempotencyKey,
        taxAmount: taxAmount.toString(),
        taxRate: taxRate.toString(),
        amount: amount.toString(),
        currency: params.currency,
      },
      idempotencyKey,
    });

    // Create record in database with unique constraint handling
    try {
      await this.prisma.paymentRecord.create({
        data: {
          userId: params.userId,
          stripePaymentIntentId: stripePi.id,
          amount: amount,
          taxAmount: taxAmount || null,
          taxRate: taxRate || null,
          taxDisplayName,
          currency: params.currency,
          status: this.mapStripeStatus(stripePi.status),
          paymentMethodId: params.paymentMethodId,
          description: params.description,
          metadata: stripePi.metadata,
          idempotencyKey,
        },
      });
    } catch (error) {
      // Handle unique constraint violation
      if (error.code === 'P2002') {
        const existing = await this.prisma.paymentRecord.findUnique({
          where: { idempotencyKey },
        });
        if (existing) {
          return {
            clientSecret: '',
            paymentIntentId: existing.stripePaymentIntentId,
            taxAmount: existing.taxAmount || 0,
          };
        }
      }
      throw error;
    }

    if (!stripePi.client_secret) {
      throw new Error('Failed to create payment intent');
    }

    const result = {
      clientSecret: stripePi.client_secret,
      paymentIntentId: stripePi.id,
      taxAmount,
    };

    await this.redisService.setIdempotency(idempotencyKey, result);

    return result;
  }

  async createCheckoutSession(params: {
    userId: string;
    stripeCustomerId: string;
    amount: number;
    currency: string;
    description?: string;
    returnUrl: string;
    idempotencyKey: string; // Required - comes from frontend
  }): Promise<{ clientSecret: string; sessionId: string }> {
    const { idempotencyKey } = params;

    // Check Redis cache
    const cached = await this.redisService.checkIdempotency(idempotencyKey);
    if (cached.exists && cached.response) {
      return cached.response;
    }

    // Check DB
    const existingDbSession = await this.prisma.paymentRecord.findUnique({
      where: { idempotencyKey },
    });
    if (existingDbSession) {
      const result = {
        clientSecret: '',
        sessionId: existingDbSession.stripePaymentIntentId,
      };
      await this.redisService.setIdempotency(idempotencyKey, result);
      return result;
    }

    const session = await this.stripeService.createCheckoutSession({
      amount: params.amount,
      currency: params.currency,
      customerId: params.stripeCustomerId,
      description: params.description,
      returnUrl: params.returnUrl,
      metadata: {
        userId: params.userId,
        internalPaymentId: idempotencyKey,
        amount: params.amount.toString(),
        currency: params.currency,
      },
      idempotencyKey,
    });

    try {
      await this.prisma.paymentRecord.create({
        data: {
          userId: params.userId,
          stripePaymentIntentId: session.id,
          amount: params.amount,
          currency: params.currency,
          status: PaymentStatus.PENDING,
          description: params.description,
          metadata: session.metadata as Prisma.InputJsonValue,
          idempotencyKey,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        const existing = await this.prisma.paymentRecord.findUnique({
          where: { idempotencyKey },
        });
        if (existing) {
          return { clientSecret: '', sessionId: existing.stripePaymentIntentId };
        }
      }
      throw error;
    }

    if (!session.client_secret) {
      throw new Error('Checkout Session did not return a client_secret');
    }

    const result = { clientSecret: session.client_secret, sessionId: session.id };
    await this.redisService.setIdempotency(idempotencyKey, result);
    return result;
  }

  async confirmPayment(paymentIntentId: string, userId: string): Promise<PaymentEntity> {
    const record = await this.prisma.paymentRecord.findFirst({
      where: { stripePaymentIntentId: paymentIntentId, userId },
      include: { user: true },
    });

    if (!record) {
      throw new NotFoundException('Payment not found');
    }

    const stripePi = await this.stripeService.retrievePaymentIntent(paymentIntentId);

    const updated = await this.prisma.paymentRecord.update({
      where: { id: record.id },
      data: {
        status: this.mapStripeStatus(stripePi.status),
        errorMessage: stripePi.last_payment_error?.message,
      },
    });

    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';

    if (stripePi.status === 'succeeded') {
      await this.mailService.sendPaymentReceipt(
        record.user.email,
        {
          amount: record.amount,
          currency: record.currency,
          description: record.description,
          createdAt: new Date(),
          stripePaymentIntentId: record.stripePaymentIntentId,
        },
        record.user.name || record.user.email,
      );
    } else if (stripePi.status === 'requires_payment_method' || stripePi.status === 'canceled') {
      await this.mailService.sendPaymentFailed(
        record.user.email,
        {
          amount: record.amount,
          currency: record.currency,
          errorMessage: stripePi.last_payment_error?.message,
        },
        record.user.name || record.user.email,
        `${frontendUrl}/payments/make`,
      );
    }

    return this.toEntity(updated);
  }

  async findByUser(userId: string): Promise<PaymentEntity[]> {
    const payments = await this.prisma.paymentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map((p) => this.toEntity(p));
  }

  async findById(id: string, userId: string): Promise<PaymentEntity | null> {
    const cacheKey = this.cacheService.paymentKey(id);
    const cached = await this.cacheService.get<PaymentEntity>(cacheKey);
    if (cached) return cached;

    const payment = await this.prisma.paymentRecord.findFirst({
      where: { id, userId },
    });

    if (payment) {
      const entity = this.toEntity(payment);
      await this.cacheService.set(cacheKey, entity, { ttlSeconds: 120 });
      return entity;
    }

    return null;
  }

  async retryPayment(paymentId: string, userId: string): Promise<PaymentEntity> {
    const record = await this.prisma.paymentRecord.findFirst({
      where: { id: paymentId, userId },
    });

    if (!record) {
      throw new NotFoundException('Payment not found');
    }

    const retryCount = await this.redisService.getRetryCount(record.stripePaymentIntentId);
    if (retryCount >= 3) {
      throw new BadRequestException(
        'Maximum retry attempts reached. Please create a new payment.',
      );
    }

    await this.redisService.incrementRetryCounter(record.stripePaymentIntentId);

    try {
      await this.stripeService.confirmPaymentIntent(record.stripePaymentIntentId);
    } catch (error) {
      await this.prisma.paymentRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        },
      });
      throw error;
    }

    return this.confirmPayment(record.stripePaymentIntentId, userId);
  }

  // ==================== REFUNDS ====================

  async createRefund(
    paymentId: string,
    userId: string,
    refundDto: { amount?: number; reason?: string; description?: string; idempotencyKey: string },
  ): Promise<RefundResult> {
    const { idempotencyKey } = refundDto;

    const record = await this.prisma.paymentRecord.findFirst({
      where: { id: paymentId, userId },
      include: { user: true, refunds: true },
    });

    if (!record) {
      throw new NotFoundException('Payment not found');
    }

    if (record.status !== 'SUCCEEDED') {
      throw new BadRequestException('Cannot refund a payment that has not succeeded');
    }

    // Check Redis cache
    const redisKey = `refund:${idempotencyKey}`;
    const cached = await this.redisService.checkIdempotency(redisKey);
    if (cached.exists && cached.response) {
      return cached.response;
    }

    // Check DB for existing refund
    const existingDbRefund = await this.prisma.refund.findUnique({
      where: { idempotencyKey },
    });
    if (existingDbRefund) {
      const remainingAmount = record.amount - record.refunds.reduce((sum, r) => sum + r.amount, 0);
      const result = {
        refund: {
          id: existingDbRefund.id,
          amount: existingDbRefund.amount,
          currency: existingDbRefund.currency,
          status: existingDbRefund.status,
          createdAt: existingDbRefund.createdAt,
        },
        remainingRefundable: remainingAmount - existingDbRefund.amount,
      };
      await this.redisService.setIdempotency(redisKey, result);
      return result;
    }

    // Calculate refundable amount
    const totalRefunded = record.refunds.reduce((sum, refund) => sum + refund.amount, 0);
    const remainingAmount = record.amount - totalRefunded;

    if (remainingAmount <= 0) {
      throw new BadRequestException('Payment has already been fully refunded');
    }

    let refundAmount = remainingAmount;
    if (refundDto.amount) {
      refundAmount = Math.round(refundDto.amount * 100);
      if (refundAmount > remainingAmount) {
        throw new BadRequestException(
          `Refund amount exceeds remaining refundable amount of $${(remainingAmount / 100).toFixed(2)}`,
        );
      }
    }

    const stripeRefund = await this.stripeService.createRefund({
      paymentIntentId: record.stripePaymentIntentId,
      amount: refundAmount,
      reason: (refundDto.reason as StripeRefundReason) || undefined,
    });

    try {
      const refund = await this.prisma.refund.create({
        data: {
          paymentId: record.id,
          stripeRefundId: stripeRefund.id,
          amount: refundAmount,
          currency: record.currency,
          status: (stripeRefund.status?.toUpperCase() || 'PENDING') as RefundStatus,
          reason: refundDto.reason,
          description: refundDto.description,
          idempotencyKey,
        },
      });

      await this.mailService.sendRefundConfirmation(
        record.user.email,
        {
          amount: refundAmount,
          currency: record.currency,
          originalAmount: record.amount,
          paymentDescription: record.description,
          refundId: stripeRefund.id,
        },
        record.user.name || record.user.email,
      );

      const result = {
        refund: {
          id: refund.id,
          amount: refundAmount,
          currency: record.currency,
          status: stripeRefund.status ?? 'pending',
          createdAt: new Date(),
        },
        remainingRefundable: remainingAmount - refundAmount,
      };

      await this.redisService.setIdempotency(redisKey, result);
      return result;
    } catch (error) {
      if (error.code === 'P2002') {
        const existing = await this.prisma.refund.findUnique({
          where: { idempotencyKey },
        });
        if (existing) {
          return {
            refund: {
              id: existing.id,
              amount: existing.amount,
              currency: existing.currency,
              status: existing.status,
              createdAt: existing.createdAt,
            },
            remainingRefundable: remainingAmount - existing.amount,
          };
        }
      }
      throw error;
    }
  }

  async getRefundsForPayment(paymentId: string, userId: string): Promise<any[]> {
    const record = await this.prisma.paymentRecord.findFirst({
      where: { id: paymentId, userId },
      include: { refunds: true },
    });

    if (!record) {
      throw new NotFoundException('Payment not found');
    }

    return record.refunds.map((refund) => ({
      id: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
      reason: refund.reason,
      description: refund.description,
      createdAt: refund.createdAt,
    }));
  }

  async getUserRefunds(userId: string): Promise<any[]> {
    const refunds = await this.prisma.refund.findMany({
      where: { payment: { userId } },
      include: { payment: true },
      orderBy: { createdAt: 'desc' },
    });

    return refunds.map((refund) => ({
      id: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
      reason: refund.reason,
      description: refund.description,
      paymentId: refund.paymentId,
      createdAt: refund.createdAt,
    }));
  }

  private mapStripeStatus(stripeStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      requires_payment_method: PaymentStatus.PENDING,
      requires_confirmation: PaymentStatus.REQUIRES_ACTION,
      requires_action: PaymentStatus.REQUIRES_ACTION,
      processing: PaymentStatus.PROCESSING,
      succeeded: PaymentStatus.SUCCEEDED,
      canceled: PaymentStatus.CANCELED,
    };
    return statusMap[stripeStatus] || PaymentStatus.PENDING;
  }

  private toEntity(payment: Prisma.PaymentRecordGetPayload<{
    select: {
      id: true;
      stripePaymentIntentId: true;
      amount: true;
      currency: true;
      status: true;
      paymentMethodId: true;
      description: true;
      errorMessage: true;
      createdAt: true;
    };
  }>): PaymentEntity {
    return {
      id: payment.id,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paymentMethodId: payment.paymentMethodId ?? undefined,
      description: payment.description ?? undefined,
      errorMessage: payment.errorMessage ?? undefined,
      createdAt: payment.createdAt,
    };
  }
}
