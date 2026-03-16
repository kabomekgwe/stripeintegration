import { faker } from '@faker-js/faker';
import {
  SubscriptionEntity,
  SubscriptionStatus,
  PlanEntity,
  PriceEntity,
  PlanInterval,
} from '../../src/subscriptions/entities/subscription.entity';

export interface SubscriptionFactoryOptions {
  id?: string;
  userId?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  planId?: string;
  priceId?: string;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
  plan?: PlanEntity;
  price?: PriceEntity;
}

export interface PlanFactoryOptions {
  id?: string;
  name?: string;
  description?: string;
  stripeProductId?: string;
  isActive?: boolean;
  features?: string[];
  createdAt?: Date;
  prices?: PriceEntity[];
}

export interface PriceFactoryOptions {
  id?: string;
  planId?: string;
  stripePriceId?: string;
  amount?: number;
  currency?: string;
  interval?: PlanInterval;
  intervalCount?: number;
  isActive?: boolean;
  createdAt?: Date;
}

export function createPriceFactory(overrides: PriceFactoryOptions = {}): PriceEntity {
  const now = new Date();

  return {
    id: overrides.id ?? faker.string.uuid(),
    planId: overrides.planId ?? faker.string.uuid(),
    stripePriceId: overrides.stripePriceId ?? `price_${faker.string.alphanumeric(14)}`,
    amount: overrides.amount ?? faker.number.int({ min: 500, max: 50000 }),
    currency: overrides.currency ?? 'usd',
    interval: overrides.interval ?? PlanInterval.MONTH,
    intervalCount: overrides.intervalCount ?? 1,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? now,
  };
}

export function createPlanFactory(overrides: PlanFactoryOptions = {}): PlanEntity {
  const now = new Date();
  const planId = overrides.id ?? faker.string.uuid();

  return {
    id: planId,
    name: overrides.name ?? faker.commerce.productName(),
    description: overrides.description ?? faker.commerce.productDescription(),
    stripeProductId: overrides.stripeProductId ?? `prod_${faker.string.alphanumeric(14)}`,
    isActive: overrides.isActive ?? true,
    features: overrides.features ?? [
      faker.commerce.productMaterial(),
      faker.commerce.productMaterial(),
      faker.commerce.productMaterial(),
    ],
    createdAt: overrides.createdAt ?? now,
    prices: overrides.prices ?? [
      createPriceFactory({ planId }),
      createPriceFactory({ planId, interval: PlanInterval.YEAR, amount: 99900 }),
    ],
  };
}

export function createSubscriptionFactory(
  overrides: SubscriptionFactoryOptions = {},
): SubscriptionEntity {
  const now = new Date();
  const periodStart = overrides.currentPeriodStart ?? now;
  const periodEnd =
    overrides.currentPeriodEnd ??
    new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

  const plan = overrides.plan ?? createPlanFactory();
  const price = overrides.price ?? plan.prices[0];

  return {
    id: overrides.id ?? faker.string.uuid(),
    userId: overrides.userId ?? faker.string.uuid(),
    stripeSubscriptionId:
      overrides.stripeSubscriptionId ?? `sub_${faker.string.alphanumeric(14)}`,
    stripeCustomerId: overrides.stripeCustomerId ?? `cus_${faker.string.alphanumeric(14)}`,
    planId: overrides.planId ?? plan.id,
    priceId: overrides.priceId ?? price.id,
    status: overrides.status ?? SubscriptionStatus.ACTIVE,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: overrides.cancelAtPeriodEnd ?? false,
    canceledAt: overrides.canceledAt,
    trialStart: overrides.trialStart,
    trialEnd: overrides.trialEnd,
    metadata: overrides.metadata ?? {},
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    plan,
    price,
  };
}

export function createSubscriptionFactoryBatch(
  count: number,
  overrides: SubscriptionFactoryOptions = {},
): SubscriptionEntity[] {
  return Array.from({ length: count }, () => createSubscriptionFactory(overrides));
}

// Helper functions for specific subscription statuses
export function createActiveSubscription(
  overrides: SubscriptionFactoryOptions = {},
): SubscriptionEntity {
  return createSubscriptionFactory({
    ...overrides,
    status: SubscriptionStatus.ACTIVE,
  });
}

export function createTrialingSubscription(
  overrides: SubscriptionFactoryOptions = {},
): SubscriptionEntity {
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  return createSubscriptionFactory({
    ...overrides,
    status: SubscriptionStatus.TRIALING,
    trialStart: now,
    trialEnd,
    currentPeriodEnd: trialEnd,
  });
}

export function createCanceledSubscription(
  overrides: SubscriptionFactoryOptions = {},
): SubscriptionEntity {
  const now = new Date();

  return createSubscriptionFactory({
    ...overrides,
    status: SubscriptionStatus.CANCELED,
    cancelAtPeriodEnd: true,
    canceledAt: now,
  });
}

export function createPastDueSubscription(
  overrides: SubscriptionFactoryOptions = {},
): SubscriptionEntity {
  const now = new Date();
  // Past due means the period ended without payment
  const periodEnd = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

  return createSubscriptionFactory({
    ...overrides,
    status: SubscriptionStatus.PAST_DUE,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  });
}

export function createIncompleteSubscription(
  overrides: SubscriptionFactoryOptions = {},
): SubscriptionEntity {
  return createSubscriptionFactory({
    ...overrides,
    status: SubscriptionStatus.INCOMPLETE,
  });
}
