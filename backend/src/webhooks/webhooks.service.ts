import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { RedisService } from '../redis/redis.service';
import Stripe from 'stripe';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async processWebhook(payload: string | Buffer, signature: string): Promise<void> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (error: any) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      throw error;
    }

    // Store event
    await this.prisma.webhookEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        data: event.data as any,
      },
    });

    // Acquire lock to prevent duplicate processing
    const lockAcquired = await this.redisService.acquireWebhookLock(event.id);
    if (!lockAcquired) {
      this.logger.warn(`Webhook ${event.id} already being processed`);
      return;
    }

    try {
      await this.handleEvent(event);

      // Mark as processed
      await this.prisma.webhookEvent.update({
        where: { stripeEventId: event.id },
        data: { processed: true, processedAt: new Date() },
      });
    } catch (error: any) {
      this.logger.error(`Failed to process webhook ${event.id}: ${error.message}`);

      await this.prisma.webhookEvent.update({
        where: { stripeEventId: event.id },
        data: { error: error.message },
      });
    } finally {
      await this.redisService.releaseWebhookLock(event.id);
    }
  }

  private async handleEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Processing webhook: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'payment_intent.requires_action':
        await this.handlePaymentIntentRequiresAction(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'setup_intent.succeeded':
        await this.handleSetupIntentSucceeded(
          event.data.object as Stripe.SetupIntent,
        );
        break;

      case 'setup_intent.setup_failed':
        await this.handleSetupIntentFailed(
          event.data.object as Stripe.SetupIntent,
        );
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const record = await this.prisma.paymentRecord.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!record) {
      this.logger.warn(
        `Payment intent ${paymentIntent.id} not found in database`,
      );
      return;
    }

    await this.prisma.paymentRecord.update({
      where: { id: record.id },
      data: {
        status: 'SUCCEEDED',
        errorMessage: null,
      },
    });

    this.logger.log(`Payment ${paymentIntent.id} marked as succeeded`);
  }

  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const record = await this.prisma.paymentRecord.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!record) {
      this.logger.warn(
        `Payment intent ${paymentIntent.id} not found in database`,
      );
      return;
    }

    await this.prisma.paymentRecord.update({
      where: { id: record.id },
      data: {
        status: 'FAILED',
        errorMessage: paymentIntent.last_payment_error?.message,
      },
    });

    this.logger.log(`Payment ${paymentIntent.id} marked as failed`);
  }

  private async handlePaymentIntentRequiresAction(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const record = await this.prisma.paymentRecord.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!record) {
      this.logger.warn(
        `Payment intent ${paymentIntent.id} not found in database`,
      );
      return;
    }

    await this.prisma.paymentRecord.update({
      where: { id: record.id },
      data: {
        status: 'REQUIRES_ACTION',
      },
    });

    this.logger.log(`Payment ${paymentIntent.id} requires action`);
  }

  private async handleSetupIntentSucceeded(
    setupIntent: Stripe.SetupIntent,
  ): Promise<void> {
    // Payment method is now saved - webhook confirms it
    this.logger.log(
      `Setup intent ${setupIntent.id} succeeded for customer ${setupIntent.customer}`,
    );
  }

  private async handleSetupIntentFailed(
    setupIntent: Stripe.SetupIntent,
  ): Promise<void> {
    this.logger.error(
      `Setup intent ${setupIntent.id} failed: ${setupIntent.last_setup_error?.message}`,
    );
  }
}
