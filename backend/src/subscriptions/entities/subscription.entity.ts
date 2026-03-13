export enum SubscriptionStatus {
  INCOMPLETE = 'INCOMPLETE',
  INCOMPLETE_EXPIRED = 'INCOMPLETE_EXPIRED',
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
  UNPAID = 'UNPAID',
  PAUSED = 'PAUSED',
}

export enum PlanInterval {
  MONTH = 'MONTH',
  YEAR = 'YEAR',
  WEEK = 'WEEK',
  DAY = 'DAY',
}

export class PriceEntity {
  id: string;
  planId: string;
  stripePriceId: string;
  amount: number;
  currency: string;
  interval: PlanInterval;
  intervalCount: number;
  isActive: boolean;
  createdAt: Date;
}

export class PlanEntity {
  id: string;
  name: string;
  description?: string;
  stripeProductId: string;
  isActive: boolean;
  features: string[];
  createdAt: Date;
  prices: PriceEntity[];
}

export class SubscriptionEntity {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  planId: string;
  priceId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  // Computed fields
  plan?: PlanEntity;
  price?: PriceEntity;
}
