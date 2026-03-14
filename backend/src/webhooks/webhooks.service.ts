import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { RedisService } from '../redis/redis.service';
import { SubscriptionService } from '../subscriptions/subscription.service';
import Stripe from 'stripe';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async processWebhook(payload: string | Buffer, signature: string): Promise<void> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET is not defined');
      throw new Error('STRIPE_WEBHOOK_SECRET is not defined');
    }

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

      // Subscription events
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice,
        );
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
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

  // ===== SUBSCRIPTION HANDLERS =====

  private async handleSubscriptionCreated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    this.logger.log(`Subscription ${subscription.id} created`);
    // Subscription is created via API, webhook just confirms
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    this.logger.log(`Subscription ${subscription.id} updated`);
    await this.subscriptionService.handleStripeSubscriptionUpdated(subscription);
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    this.logger.log(`Subscription ${subscription.id} deleted`);
    await this.subscriptionService.handleStripeSubscriptionDeleted(subscription);
  }

  private async handleInvoicePaymentSucceeded(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    this.logger.log(`Invoice ${invoice.id} payment succeeded`);
    // Additional invoice handling if needed
  }

  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    this.logger.error(`Invoice ${invoice.id} payment failed`);
    // Retry logic or notification could go here
  }

  // ===== DASHBOARD METHODS =====

  async getWebhookStats(): Promise<{
    total: number;
    processed: number;
    failed: number;
    pending: number;
    byType: Record<string, number>;
  }> {
    const [
      total,
      processed,
      failed,
      byType,
    ] = await Promise.all([
      this.prisma.webhookEvent.count(),
      this.prisma.webhookEvent.count({ where: { processed: true } }),
      this.prisma.webhookEvent.count({ where: { error: { not: null } } }),
      this.prisma.webhookEvent.groupBy({
        by: ['type'],
        _count: { type: true },
      }),
    ]);

    const byTypeMap: Record<string, number> = {};
    byType.forEach((item) => {
      byTypeMap[item.type] = item._count.type;
    });

    return {
      total,
      processed,
      failed,
      pending: total - processed,
      byType: byTypeMap,
    };
  }

  async getWebhookEvents(params: {
    limit?: number;
    offset?: number;
    processed?: boolean;
    failed?: boolean;
    type?: string;
  }): Promise<{
    events: any[];
    total: number;
  }> {
    const { limit = 50, offset = 0, processed, failed, type } = params;

    const where: any = {};
    
    if (processed !== undefined) {
      where.processed = processed;
    }
    
    if (failed) {
      where.error = { not: null };
    }
    
    if (type) {
      where.type = type;
    }

    const [events, total] = await Promise.all([
      this.prisma.webhookEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.webhookEvent.count({ where }),
    ]);

    return { events, total };
  }

  async getWebhookEvent(id: string): Promise<any | null> {
    return this.prisma.webhookEvent.findUnique({
      where: { id },
    });
  }

  async retryWebhookEvent(id: string): Promise<void> {
    const event = await this.prisma.webhookEvent.findUnique({
      where: { id },
    });

    if (!event) {
      throw new Error('Webhook event not found');
    }

    if (event.processed) {
      throw new Error('Webhook event already processed');
    }

    // Reset error and processed status
    await this.prisma.webhookEvent.update({
      where: { id },
      data: {
        error: null,
        processed: false,
        processedAt: null,
      },
    });

    // Re-process the event
    const stripeEvent = event.data as unknown as Stripe.Event;
    await this.handleEvent(stripeEvent);

    // Mark as processed
    await this.prisma.webhookEvent.update({
      where: { id },
      data: { processed: true, processedAt: new Date() },
    });
  }

  async getRecentErrors(limit: number = 20): Promise<any[]> {
    return this.prisma.webhookEvent.findMany({
      where: { error: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
