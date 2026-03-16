import { faker } from '@faker-js/faker';
import { PaymentEntity } from '../../src/payments/entities/payment.entity';
import { PaymentStatus, RefundStatus } from '@prisma/client';

export interface PaymentFactoryOptions {
  id?: string;
  userId?: string;
  stripePaymentIntentId?: string;
  amount?: number;
  currency?: string;
  status?: PaymentStatus | string;
  paymentMethodId?: string;
  description?: string;
  errorMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function createPaymentFactory(overrides: PaymentFactoryOptions = {}): PaymentEntity {
  const now = new Date();

  return {
    id: overrides.id ?? faker.string.uuid(),
    userId: overrides.userId ?? faker.string.uuid(),
    stripePaymentIntentId: overrides.stripePaymentIntentId ?? `pi_${faker.string.alphanumeric(24)}`,
    amount: overrides.amount ?? faker.number.int({ min: 100, max: 100000 }), // cents
    currency: overrides.currency ?? 'usd',
    status: (overrides.status as string) ?? 'PENDING',
    paymentMethodId: overrides.paymentMethodId ?? faker.string.uuid(),
    description: overrides.description ?? faker.commerce.productName(),
    errorMessage: overrides.errorMessage,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

export function createPaymentFactoryBatch(count: number, overrides: PaymentFactoryOptions = {}): PaymentEntity[] {
  return Array.from({ length: count }, () => createPaymentFactory(overrides));
}

// Prisma PaymentRecord factory (includes database fields)
export interface PaymentRecordFactoryOptions extends PaymentFactoryOptions {
  taxAmount?: number | null;
  taxRate?: number | null;
  taxDisplayName?: string | null;
  metadata?: any;
}

export function createPaymentRecordFactory(overrides: PaymentRecordFactoryOptions = {}): any {
  const now = new Date();

  return {
    id: overrides.id ?? faker.string.uuid(),
    userId: overrides.userId ?? faker.string.uuid(),
    stripePaymentIntentId: overrides.stripePaymentIntentId ?? `pi_${faker.string.alphanumeric(24)}`,
    amount: overrides.amount ?? faker.number.int({ min: 100, max: 100000 }),
    taxAmount: overrides.taxAmount ?? null,
    taxRate: overrides.taxRate ?? null,
    taxDisplayName: overrides.taxDisplayName ?? null,
    currency: overrides.currency ?? 'usd',
    status: overrides.status ?? 'PENDING',
    paymentMethodId: overrides.paymentMethodId ?? faker.string.uuid(),
    description: overrides.description ?? faker.commerce.productName(),
    metadata: overrides.metadata ?? {},
    errorMessage: overrides.errorMessage ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

// Refund factory
export interface RefundFactoryOptions {
  id?: string;
  paymentId?: string;
  stripeRefundId?: string;
  amount?: number;
  currency?: string;
  status?: RefundStatus | string;
  reason?: string | null;
  description?: string | null;
  createdAt?: Date;
}

export function createRefundFactory(overrides: RefundFactoryOptions = {}): any {
  const now = new Date();

  return {
    id: overrides.id ?? faker.string.uuid(),
    paymentId: overrides.paymentId ?? faker.string.uuid(),
    stripeRefundId: overrides.stripeRefundId ?? `re_${faker.string.alphanumeric(24)}`,
    amount: overrides.amount ?? faker.number.int({ min: 100, max: 50000 }),
    currency: overrides.currency ?? 'usd',
    status: (overrides.status as string) ?? 'PENDING',
    reason: overrides.reason ?? null,
    description: overrides.description ?? null,
    createdAt: overrides.createdAt ?? now,
  };
}

export function createRefundFactoryBatch(count: number, overrides: RefundFactoryOptions = {}): any[] {
  return Array.from({ length: count }, () => createRefundFactory(overrides));
}
