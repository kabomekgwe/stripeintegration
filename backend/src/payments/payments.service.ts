import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { PaymentEntity } from './entities/payment.entity';
import { CreateRefundDto } from './dto/create-refund.dto';
import { PaymentStatus, RefundStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
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
        status: stripePi.status.toUpperCase() as any,
        paymentMethodId: params.paymentMethodId,
        description: params.description,
        metadata: stripePi.metadata,
      },
    });

    if (!stripePi.client_secret) {
      throw new Error('Failed to create payment intent');
    }

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
      include: { user: true },
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
        status: stripePi.status.toUpperCase() as PaymentStatus,
        errorMessage: stripePi.last_payment_error?.message,
      },
    });

    // Send email notification based on status
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

  // ==================== REFUNDS ====================

  async createRefund(
    paymentId: string,
    userId: string,
    refundDto: { amount?: number; reason?: string; description?: string },
  ): Promise<any> {
    // Get the payment record
    const record = await this.prisma.paymentRecord.findFirst({
      where: { id: paymentId, userId },
      include: { user: true, refunds: true },
    });

    if (!record) {
      throw new NotFoundException('Payment not found');
    }

    // Only allow refunds on succeeded payments
    if (record.status !== 'SUCCEEDED') {
      throw new BadRequestException(
        'Cannot refund a payment that has not succeeded',
      );
    }

    // Calculate refundable amount
    const totalRefunded = record.refunds.reduce(
      (sum, refund) => sum + refund.amount,
      0,
    );
    const remainingAmount = record.amount - totalRefunded;

    if (remainingAmount <= 0) {
      throw new BadRequestException('Payment has already been fully refunded');
    }

    // Determine refund amount
    let refundAmount = remainingAmount;
    if (refundDto.amount) {
      refundAmount = Math.round(refundDto.amount * 100); // Convert to cents
      if (refundAmount > remainingAmount) {
        throw new BadRequestException(
          `Refund amount exceeds remaining refundable amount of $${(remainingAmount / 100).toFixed(2)}`,
        );
      }
    }

    // Create refund in Stripe
    const stripeRefund = await this.stripeService.createRefund({
      paymentIntentId: record.stripePaymentIntentId,
      amount: refundAmount,
      reason: refundDto.reason as any,
    });

    // Create refund record in database
    const refund = await this.prisma.refund.create({
      data: {
        paymentId: record.id,
        stripeRefundId: stripeRefund.id,
        amount: refundAmount,
        currency: record.currency,
        status: (stripeRefund.status?.toUpperCase() || 'PENDING') as any,
        reason: refundDto.reason,
        description: refundDto.description,
      },
    });

    // Send refund confirmation email
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

    return {
      refund: {
        id: refund.id,
        amount: refundAmount,
        currency: record.currency,
        status: stripeRefund.status,
        createdAt: new Date(),
      },
      remainingRefundable: remainingAmount - refundAmount,
    };
  }

  async getRefundsForPayment(
    paymentId: string,
    userId: string,
  ): Promise<any[]> {
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
      where: {
        payment: {
          userId,
        },
      },
      include: {
        payment: true,
      },
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
