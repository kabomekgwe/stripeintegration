import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { RedisService } from '../redis/redis.service';
import { SubscriptionService } from '../subscriptions/subscription.service';
import { DisputeService } from '../disputes/dispute.service';
import { ConnectService } from '../connect/connect.service';
import Stripe from 'stripe';
import {
  PaymentIntentData,
  SetupIntentData,
  SubscriptionData,
  DisputeData,
  AccountData,
  isPaymentIntentEvent,
  isSetupIntentEvent,
  isSubscriptionEvent,
  isDisputeEvent,
  isAccountEvent,
  PaymentIntentEvents,
  SetupIntentEvents,
  SubscriptionEvents,
  DisputeEvents,
  AccountEvents,
} from './dto/webhook-events.dto';

/**
 * Webhook event record from database
 */
interface WebhookEventRecord {
  id: string;
  stripeEventId: string;
  type: string;
  data: unknown;
  processed: boolean;
  processedAt: Date | null;
  error: string | null;
  createdAt: Date;
}

/**
 * Webhook statistics result
 */
interface WebhookStats {
  total: number;
  processed: number;
  failed: number;
  pending: number;
  byType: Record<string, number>;
}

/**
 * Webhook events query result
 */
interface WebhookEventsResult {
  events: WebhookEventRecord[];
  total: number;
}

/**
 * Query parameters for fetching webhook events
 */
interface GetWebhookEventsParams {
  limit?: number;
  offset?: number;
  processed?: boolean;
  failed?: boolean;
  type?: string;
}

/**
 * Prisma where clause for webhook events
 */
interface WebhookEventWhereClause {
  processed?: boolean;
  error?: { not: null };
  type?: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly subscriptionService: SubscriptionService,
    private readonly disputeService: DisputeService,
    private readonly connectService: ConnectService,
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook signature verification failed: ${errorMessage}`);
      throw error;
    }

    // Store event
    await this.prisma.webhookEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        data: event.data as unknown as import('@prisma/client').Prisma.InputJsonValue,
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process webhook ${event.id}: ${errorMessage}`);

      await this.prisma.webhookEvent.update({
        where: { stripeEventId: event.id },
        data: { error: errorMessage },
      });
    } finally {
      await this.redisService.releaseWebhookLock(event.id);
    }
  }

  private async handleEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Processing webhook: ${event.type}`);

    // Cast to our typed event for type guards
    const typedEvent = event as unknown as import('./dto/webhook-events.dto').StripeWebhookEvent;

    // Use type guards to route events to appropriate handlers
    if (isPaymentIntentEvent(typedEvent)) {
      await this.handlePaymentIntentEvent(typedEvent as PaymentIntentEvents);
      return;
    }

    if (isSetupIntentEvent(typedEvent)) {
      await this.handleSetupIntentEvent(typedEvent as SetupIntentEvents);
      return;
    }

    if (isSubscriptionEvent(typedEvent)) {
      await this.handleSubscriptionEvent(typedEvent as SubscriptionEvents);
      return;
    }

    if (isDisputeEvent(typedEvent)) {
      await this.handleDisputeEvent(typedEvent as DisputeEvents);
      return;
    }

    if (isAccountEvent(typedEvent)) {
      await this.handleAccountEvent(typedEvent as AccountEvents);
      return;
    }

    this.logger.log(`Unhandled event type: ${event.type}`);
  }

  // ===== PAYMENT INTENT HANDLERS =====

  private async handlePaymentIntentEvent(event: PaymentIntentEvents): Promise<void> {
    const paymentIntent = event.data.object as PaymentIntentData;

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(paymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(paymentIntent);
        break;
      case 'payment_intent.requires_action':
        await this.handlePaymentIntentRequiresAction(paymentIntent);
        break;
      default:
        this.logger.log(`Unhandled payment intent event: ${(event as unknown as { type: string }).type}`);
    }
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: PaymentIntentData,
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
    paymentIntent: PaymentIntentData,
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
        errorMessage: paymentIntent.last_payment_error?.message ?? null,
      },
    });

    this.logger.log(`Payment ${paymentIntent.id} marked as failed`);
  }

  private async handlePaymentIntentRequiresAction(
    paymentIntent: PaymentIntentData,
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

  // ===== SETUP INTENT HANDLERS =====

  private async handleSetupIntentEvent(event: SetupIntentEvents): Promise<void> {
    const setupIntent = event.data.object as SetupIntentData;

    switch (event.type) {
      case 'setup_intent.succeeded':
        await this.handleSetupIntentSucceeded(setupIntent);
        break;
      case 'setup_intent.setup_failed':
        await this.handleSetupIntentFailed(setupIntent);
        break;
      default:
        this.logger.log(`Unhandled setup intent event: ${(event as unknown as { type: string }).type}`);
    }
  }

  private async handleSetupIntentSucceeded(
    setupIntent: SetupIntentData,
  ): Promise<void> {
    this.logger.log(
      `Setup intent ${setupIntent.id} succeeded for customer ${setupIntent.customer}`,
    );
  }

  private async handleSetupIntentFailed(
    setupIntent: SetupIntentData,
  ): Promise<void> {
    const errorMessage = setupIntent.last_setup_error?.message ?? 'Unknown error';
    this.logger.error(
      `Setup intent ${setupIntent.id} failed: ${errorMessage}`,
    );
  }

  // ===== SUBSCRIPTION HANDLERS =====

  private async handleSubscriptionEvent(event: SubscriptionEvents): Promise<void> {
    const subscription = event.data.object as SubscriptionData;

    switch (event.type) {
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(subscription);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(subscription);
        break;
      default:
        this.logger.log(`Unhandled subscription event: ${(event as unknown as { type: string }).type}`);
    }
  }

  private async handleSubscriptionCreated(
    subscription: SubscriptionData,
  ): Promise<void> {
    this.logger.log(`Subscription ${subscription.id} created`);
    // Subscription is created via API, webhook just confirms
  }

  private async handleSubscriptionUpdated(
    subscription: SubscriptionData,
  ): Promise<void> {
    this.logger.log(`Subscription ${subscription.id} updated`);
    await this.subscriptionService.handleStripeSubscriptionUpdated(subscription);
  }

  private async handleSubscriptionDeleted(
    subscription: SubscriptionData,
  ): Promise<void> {
    this.logger.log(`Subscription ${subscription.id} deleted`);
    await this.subscriptionService.handleStripeSubscriptionDeleted(subscription);
  }

  // ===== DISPUTE HANDLERS =====

  private async handleDisputeEvent(event: DisputeEvents): Promise<void> {
    const dispute = event.data.object as DisputeData;

    switch (event.type) {
      case 'charge.dispute.created':
        await this.handleDisputeCreated(dispute);
        break;
      case 'charge.dispute.updated':
        await this.handleDisputeUpdated(dispute);
        break;
      default:
        this.logger.log(`Unhandled dispute event: ${(event as unknown as { type: string }).type}`);
    }
  }

  private async handleDisputeCreated(
    dispute: DisputeData,
  ): Promise<void> {
    await this.disputeService.handleDisputeCreated(dispute as unknown as Stripe.Dispute);
  }

  private async handleDisputeUpdated(
    dispute: DisputeData,
  ): Promise<void> {
    await this.disputeService.handleDisputeUpdated(dispute as unknown as Stripe.Dispute);
  }

  // ===== CONNECT HANDLERS =====

  private async handleAccountEvent(event: AccountEvents): Promise<void> {
    const account = event.data.object as AccountData;

    switch (event.type) {
      case 'account.updated':
        await this.handleAccountUpdated(account);
        break;
      default:
        this.logger.log(`Unhandled account event: ${(event as unknown as { type: string }).type}`);
    }
  }

  private async handleAccountUpdated(
    account: AccountData,
  ): Promise<void> {
    await this.connectService.handleAccountUpdated(account as unknown as Stripe.Account);
  }

  // ===== DASHBOARD METHODS =====

  async getWebhookStats(): Promise<WebhookStats> {
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

  async getWebhookEvents(params: GetWebhookEventsParams): Promise<WebhookEventsResult> {
    const { limit = 50, offset = 0, processed, failed, type } = params;

    const where: WebhookEventWhereClause = {};

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
      }) as Promise<WebhookEventRecord[]>,
      this.prisma.webhookEvent.count({ where }),
    ]);

    return { events, total };
  }

  async getWebhookEvent(id: string): Promise<WebhookEventRecord | null> {
    return this.prisma.webhookEvent.findUnique({
      where: { id },
    }) as Promise<WebhookEventRecord | null>;
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

  async getRecentErrors(limit = 20): Promise<WebhookEventRecord[]> {
    return this.prisma.webhookEvent.findMany({
      where: { error: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }) as Promise<WebhookEventRecord[]>;
  }
}
