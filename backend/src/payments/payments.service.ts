import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { RedisService } from '../redis/redis.service';
import { PaymentEntity } from './entities/payment.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly redisService: RedisService,
  ) {}

  async createPaymentIntent(params: {
    userId: string;
    stripeCustomerId: string;
    amount: number;
    currency: string;
    paymentMethodId?: string;
    description?: string;
  }): Promise<{ clientSecret: string; paymentIntentId: string }> {
    // Determine payment method
    let paymentMethodStripeId: string | undefined;

    if (params.paymentMethodId) {
      // User specified a payment method
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
      // Use default
      const defaultPm = await this.paymentMethodsService.getDefaultForUser(
        params.userId,
      );
      if (!defaultPm) {
        throw new BadRequestException(
          'No default payment method found. Please add a payment method first.',
        );
      }
      paymentMethodStripeId = defaultPm.stripePmId;
    }

    // Check idempotency
    const idempotencyKey = uuidv4();
    const cached = await this.redisService.checkIdempotency(idempotencyKey);
    if (cached.exists) {
      return cached.response;
    }

    // Create payment intent in Stripe
    const stripePi = await this.stripeService.createPaymentIntent({
      amount: params.amount,
      currency: params.currency,
      customerId: params.stripeCustomerId,
      paymentMethodId: paymentMethodStripeId,
      description: params.description,
      metadata: {
        userId: params.userId,
        internalPaymentId: idempotencyKey,
      },
      idempotencyKey,
    });

    // Create record in database
    await this.prisma.paymentRecord.create({
      data: {
        userId: params.userId,
        stripePaymentIntentId: stripePi.id,
        amount: params.amount,
        currency: params.currency,
        status: stripePi.status.toUpperCase(),
        paymentMethodId: params.paymentMethodId,
        description: params.description,
        metadata: stripePi.metadata,
      },
    });

    const result = {
      clientSecret: stripePi.client_secret,
      paymentIntentId: stripePi.id,
    };

    // Cache for idempotency
    await this.redisService.setIdempotency(idempotencyKey, result);

    return result;
  }

  async confirmPayment(
    paymentIntentId: string,
    userId: string,
  ): Promise<PaymentEntity> {
    // Verify ownership
    const record = await this.prisma.paymentRecord.findFirst({
      where: { stripePaymentIntentId: paymentIntentId, userId },
    });

    if (!record) {
      throw new NotFoundException('Payment not found');
    }

    // Retrieve from Stripe to get latest status
    const stripePi = await this.stripeService.retrievePaymentIntent(
      paymentIntentId,
    );

    // Update database
    const updated = await this.prisma.paymentRecord.update({
      where: { id: record.id },
      data: {
        status: stripePi.status.toUpperCase(),
        errorMessage:
          stripePi.last_payment_error?.message ||
          stripePi.last_setup_error?.message,
      },
    });

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
    const payment = await this.prisma.paymentRecord.findFirst({
      where: { id, userId },
    });

    return payment ? this.toEntity(payment) : null;
  }

  async retryPayment(
    paymentId: string,
    userId: string,
  ): Promise<PaymentEntity> {
    const record = await this.prisma.paymentRecord.findFirst({
      where: { id: paymentId, userId },
    });

    if (!record) {
      throw new NotFoundException('Payment not found');
    }

    // Check retry count
    const retryCount = await this.redisService.getRetryCount(
      record.stripePaymentIntentId,
    );
    if (retryCount >= 3) {
      throw new BadRequestException(
        'Maximum retry attempts reached. Please create a new payment.',
      );
    }

    // Increment retry counter
    await this.redisService.incrementRetryCounter(
      record.stripePaymentIntentId,
    );

    // Try to confirm again
    try {
      await this.stripeService.confirmPaymentIntent(
        record.stripePaymentIntentId,
      );
    } catch (error) {
      // Update with error
      await this.prisma.paymentRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        },
      });
      throw error;
    }

    // Get updated status
    return this.confirmPayment(record.stripePaymentIntentId, userId);
  }

  private toEntity(payment: any): PaymentEntity {
    return {
      id: payment.id,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paymentMethodId: payment.paymentMethodId,
      description: payment.description,
      errorMessage: payment.errorMessage,
      createdAt: payment.createdAt,
    };
  }
}
