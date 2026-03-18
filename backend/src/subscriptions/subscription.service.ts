import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { CacheService } from '../cache/cache.service';
import { MailService } from '../mail/mail.service';
import { SubscriptionStatus, PlanInterval, SubscriptionEntity, PlanEntity } from './entities/subscription.entity';
import { CreateSubscriptionDto, UpdateSubscriptionDto, CancelSubscriptionDto } from './dto/create-subscription.dto';
import Stripe from 'stripe';

export interface PlanWithPrices {
  id: string;
  name: string;
  description?: string;
  stripeProductId: string;
  isActive: boolean;
  features: string[];
  createdAt: Date;
  prices: Array<{
    id: string;
    planId: string;
    stripePriceId: string;
    amount: number;
    currency: string;
    interval: PlanInterval;
    intervalCount: number;
    isActive: boolean;
  }>;
}

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly mailService: MailService,
    private readonly cacheService: CacheService,
  ) {}

  // ===== PLANS =====

  async getActivePlans(): Promise<PlanWithPrices[]> {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      include: {
        prices: {
          where: { isActive: true },
          orderBy: { amount: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return plans as PlanWithPrices[];
  }

  async getPlanById(planId: string): Promise<PlanWithPrices | null> {
    // Try cache first
    const cacheKey = `plan:${planId}`;
    const cached = await this.cacheService.get<PlanWithPrices>(cacheKey);
    if (cached) return cached;

    const plan = await this.prisma.plan.findUnique({
      where: { id: planId, isActive: true },
      include: {
        prices: {
          where: { isActive: true },
        },
      },
    });

    if (plan) {
      const result = plan as PlanWithPrices;
      // Cache for 5 minutes (300 seconds) - plans don't change often
      await this.cacheService.set(cacheKey, result, { ttlSeconds: 300 });
      return result;
    }

    return null;
  }

  // ===== SUBSCRIPTIONS =====

  async createSubscription(
    userId: string,
    stripeCustomerId: string,
    dto: CreateSubscriptionDto,
  ): Promise<{ clientSecret: string; subscriptionId: string }> {
    // Find the price
    const price = await this.prisma.price.findUnique({
      where: { id: dto.priceId, isActive: true },
      include: { plan: true },
    });

    if (!price) {
      throw new NotFoundException('Plan price not found');
    }

    // Check for existing active subscription
    const existingSub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING', 'INCOMPLETE'] },
      },
    });

    if (existingSub) {
      throw new BadRequestException(
        'User already has an active subscription. Cancel it first.',
      );
    }

    // Get payment method
    let defaultPaymentMethodId: string | undefined;

    if (dto.paymentMethodId) {
      const pm = await this.prisma.paymentMethod.findFirst({
        where: { id: dto.paymentMethodId, userId, isActive: true },
      });
      if (!pm) {
        throw new NotFoundException('Payment method not found');
      }
      defaultPaymentMethodId = pm.stripePmId;
    } else {
      // Get default payment method
      const defaultPm = await this.prisma.paymentMethod.findFirst({
        where: { userId, isDefault: true, isActive: true },
      });
      if (defaultPm) {
        defaultPaymentMethodId = defaultPm.stripePmId;
      }
    }

    // Create Stripe subscription
    const stripeSub = await this.stripeService.getStripe().subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: price.stripePriceId }],
      default_payment_method: defaultPaymentMethodId,
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId,
        planId: price.planId,
        priceId: price.id,
      },
    });

    // Get client secret for initial payment (Stripe creates internal invoice for subscription)
    // Note: This is for payment processing only - actual invoices are sent from our internal system
    const latestInvoice = stripeSub.latest_invoice as Stripe.Invoice | null;
    const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | null | undefined;
    const clientSecret = paymentIntent?.client_secret;

    if (!clientSecret) {
      throw new BadRequestException('Failed to create subscription payment');
    }

    // Create subscription in database
    await this.prisma.subscription.create({
      data: {
        userId,
        stripeSubscriptionId: stripeSub.id,
        stripeCustomerId,
        planId: price.planId,
        priceId: price.id,
        status: this.mapStripeStatus(stripeSub.status),
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        trialStart: stripeSub.trial_start
          ? new Date(stripeSub.trial_start * 1000)
          : undefined,
        trialEnd: stripeSub.trial_end
          ? new Date(stripeSub.trial_end * 1000)
          : undefined,
        metadata: dto.metadata || {},
      },
    });

    return { clientSecret, subscriptionId: stripeSub.id };
  }

  async getUserSubscription(userId: string) {
    // Try cache first
    const cacheKey = `subscription:user:${userId}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { notIn: ['CANCELED'] },
      },
      include: {
        plan: true,
        price: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (subscription) {
      // Cache for 1 minute (60 seconds) - subscription data changes frequently
      await this.cacheService.set(cacheKey, subscription, { ttlSeconds: 60 });
    }

    return subscription;
  }

  async getUserSubscriptions(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true, price: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateSubscription(
    subscriptionId: string,
    userId: string,
    dto: UpdateSubscriptionDto,
  ) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Update price (upgrade/downgrade)
    if (dto.priceId && dto.priceId !== subscription.priceId) {
      const newPrice = await this.prisma.price.findUnique({
        where: { id: dto.priceId, isActive: true },
      });

      if (!newPrice) {
        throw new NotFoundException('New plan price not found');
      }

      // Update Stripe subscription
      const stripeSub = await this.stripeService.getStripe().subscriptions.retrieve(
        subscription.stripeSubscriptionId,
      );

      await this.stripeService.getStripe().subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          items: [{
            id: stripeSub.items.data[0].id,
            price: newPrice.stripePriceId,
          }],
          proration_behavior: 'always_invoice',
        },
      );

      // Update database
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          priceId: newPrice.id,
        },
      });
    }

    // Update cancellation status
    if (dto.cancelAtPeriodEnd !== undefined) {
      await this.stripeService.getStripe().subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: dto.cancelAtPeriodEnd,
        },
      );

      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          cancelAtPeriodEnd: dto.cancelAtPeriodEnd,
        },
      });
    }

    return { message: 'Subscription updated' };
  }

  async cancelSubscription(
    subscriptionId: string,
    userId: string,
    dto: CancelSubscriptionDto,
  ) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
      include: { plan: true, price: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (dto.cancelMode === 'immediately') {
      // Cancel immediately
      await this.stripeService.getStripe().subscriptions.cancel(
        subscription.stripeSubscriptionId,
      );

      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.CANCELED,
          canceledAt: new Date(),
        },
      });

      // Send cancellation email
      await this.mailService.sendBillingEmail(
        subscription.userId,
        'SUBSCRIPTION_CANCELED',
        {
          planName: subscription.plan.name,
          cancelDate: new Date().toLocaleDateString(),
        },
      );
    } else {
      // Cancel at period end (default)
      await this.stripeService.getStripe().subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: true,
        },
      );

      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          cancelAtPeriodEnd: true,
        },
      });
    }

    return {
      message: `Subscription will cancel ${dto.cancelMode === 'immediately' ? 'immediately' : 'at period end'}`,
    };
  }

  // ===== WEBHOOK HANDLERS =====

  async handleStripeSubscriptionUpdated(stripeSub: Stripe.Subscription) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSub.id },
      include: { user: true, plan: true, price: true },
    });

    if (!subscription) {
      console.warn(`Subscription ${stripeSub.id} not found in database`);
      return;
    }

    const newStatus = this.mapStripeStatus(stripeSub.status);

    // Check for status changes
    const wasTrialing = subscription.status === SubscriptionStatus.TRIALING;
    const isNowActive = newStatus === SubscriptionStatus.ACTIVE;
    const wasActive = subscription.status === SubscriptionStatus.ACTIVE;
    const isNowPastDue = newStatus === SubscriptionStatus.PAST_DUE;

    // Update database
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: newStatus,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        canceledAt: stripeSub.canceled_at
          ? new Date(stripeSub.canceled_at * 1000)
          : undefined,
        trialEnd: stripeSub.trial_end
          ? new Date(stripeSub.trial_end * 1000)
          : undefined,
      },
    });

    // Send relevant emails
    if (wasTrialing && isNowActive) {
      // Trial ended, subscription is now active
      await this.mailService.sendBillingEmail(
        subscription.userId,
        'TRIAL_ENDED',
        {
          planName: subscription.plan.name,
          amount: (subscription.price.amount / 100).toFixed(2),
          currency: subscription.price.currency.toUpperCase(),
          nextBillingDate: new Date(
            stripeSub.current_period_end * 1000,
          ).toLocaleDateString(),
        },
      );
    }

    if (wasActive && isNowPastDue) {
      // Payment failed
      await this.mailService.sendBillingEmail(
        subscription.userId,
        'SUBSCRIPTION_PAST_DUE',
        {
          planName: subscription.plan.name,
          retryUrl: `${process.env.FRONTEND_URL}/dashboard`,
        },
      );
    }

    // Note: Invoices are handled internally, not via Stripe invoicing
  }

  async handleStripeSubscriptionDeleted(stripeSub: Stripe.Subscription) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSub.id },
    });

    if (!subscription) {
      return;
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date(),
      },
    });
  }

  // ===== HELPER METHODS =====

  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
      trialing: SubscriptionStatus.TRIALING,
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.UNPAID,
      paused: SubscriptionStatus.PAUSED,
    };

    return statusMap[stripeStatus] || SubscriptionStatus.INCOMPLETE;
  }
}
