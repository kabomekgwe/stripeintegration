import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { RedisService } from '../redis/redis.service';
import Stripe from 'stripe';

export interface CreateUsageSubscriptionDto {
  priceId: string;
  paymentMethodId?: string;
}

export interface RecordUsageDto {
  subscriptionId: string;
  quantity: number;
  timestamp?: Date;
}

@Injectable()
export class UsageSubscriptionService {
  private readonly logger = new Logger(UsageSubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly redisService: RedisService,
  ) {}

  async createUsageSubscription(
    userId: string,
    stripeCustomerId: string,
    dto: CreateUsageSubscriptionDto,
  ): Promise<{ subscriptionId: string; clientSecret?: string }> {
    // Get the price to verify it's a metered price
    const price = await this.prisma.price.findUnique({
      where: { id: dto.priceId },
      include: { plan: true },
    });

    if (!price) {
      throw new NotFoundException('Price not found');
    }

    // Verify this is a metered price in Stripe
    const stripePrice = await this.stripeService.getStripe().prices.retrieve(price.stripePriceId);
    if (stripePrice.recurring?.usage_type !== 'metered') {
      throw new BadRequestException('This price is not configured for metered billing');
    }

    // Get or create payment method
    let defaultPaymentMethod: string | undefined;
    
    if (dto.paymentMethodId) {
      const pm = await this.prisma.paymentMethod.findFirst({
        where: { id: dto.paymentMethodId, userId, isActive: true },
      });
      if (!pm) {
        throw new NotFoundException('Payment method not found');
      }
      defaultPaymentMethod = pm.stripePmId;
    } else {
      // Use customer's default payment method
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user?.defaultPaymentMethodId) {
        const pm = await this.prisma.paymentMethod.findUnique({
          where: { id: user.defaultPaymentMethodId },
        });
        if (pm) {
          defaultPaymentMethod = pm.stripePmId;
        }
      }
    }

    if (!defaultPaymentMethod) {
      throw new BadRequestException('No payment method available. Please add a payment method first.');
    }

    // Create subscription in Stripe
    const subscriptionData: Stripe.SubscriptionCreateParams = {
      customer: stripeCustomerId,
      items: [{ price: price.stripePriceId }],
      default_payment_method: defaultPaymentMethod,
      collection_method: 'charge_automatically',
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    };

    const stripeSubscription = await this.stripeService.getStripe().subscriptions.create(subscriptionData);

    // Save to database
    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId,
        planId: price.planId,
        priceId: price.id,
        status: this.mapStripeStatus(stripeSubscription.status),
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        metadata: { usageType: 'metered' },
      },
    });

    // Get client secret if payment is required
    const latestInvoice = stripeSubscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent;
    const clientSecret = paymentIntent?.client_secret || undefined;

    this.logger.log(`Created metered subscription ${subscription.id} for user ${userId}`);

    return { subscriptionId: subscription.id, clientSecret };
  }

  async recordUsage(dto: RecordUsageDto): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: dto.subscriptionId },
      include: { price: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestException('Subscription is not active');
    }

    // Record usage in Stripe
    await this.stripeService.getStripe().subscriptionItems.createUsageRecord(
      subscription.stripeSubscriptionId,
      {
        quantity: dto.quantity,
        timestamp: dto.timestamp ? Math.floor(dto.timestamp.getTime() / 1000) : 'now',
        action: 'increment',
      },
    );

    // Also record in our database for tracking
    await this.prisma.usageRecord.create({
      data: {
        userId: subscription.userId,
        period: this.getCurrentPeriod(),
        usageCount: dto.quantity,
        amount: 0, // Will be calculated by Stripe
        description: `Metered usage for subscription ${subscription.id}`,
        billed: false,
      },
    });

    this.logger.log(`Recorded ${dto.quantity} units for subscription ${dto.subscriptionId}`);
  }

  async getUsageSummary(subscriptionId: string): Promise<{
    totalUsage: number;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Get usage from Stripe
    const stripeSubscription = await this.stripeService.getStripe().subscriptions.retrieve(
      subscription.stripeSubscriptionId,
      { expand: ['items.data.price'] },
    );

    const item = stripeSubscription.items.data[0];
    if (!item) {
      return {
        totalUsage: 0,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
      };
    }

    // Get usage records for current period
    // Note: Stripe doesn't filter by date range, we get all and filter manually
    const usageRecords = await this.stripeService.getStripe().subscriptionItems.listUsageRecordSummaries(
      item.id,
      { limit: 100 },
    );

    const periodStart = subscription.currentPeriodStart.getTime() / 1000;
    const periodEnd = subscription.currentPeriodEnd.getTime() / 1000;
    
    const totalUsage = usageRecords.data
      .filter(record => {
        const recordTime = record.period?.start;
        if (!recordTime) return false;
        return recordTime >= periodStart && recordTime <= periodEnd;
      })
      .reduce((sum, record) => sum + record.total_usage, 0);

    return {
      totalUsage,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }

  private mapStripeStatus(status: string): any {
    const statusMap: Record<string, string> = {
      'incomplete': 'INCOMPLETE',
      'incomplete_expired': 'INCOMPLETE_EXPIRED',
      'trialing': 'TRIALING',
      'active': 'ACTIVE',
      'past_due': 'PAST_DUE',
      'canceled': 'CANCELED',
      'unpaid': 'UNPAID',
      'paused': 'PAUSED',
    };
    return statusMap[status] || 'INCOMPLETE';
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
