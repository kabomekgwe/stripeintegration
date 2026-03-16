import { faker } from '@faker-js/faker';

export interface InvoiceFactoryOptions {
  id?: string;
  userId?: string;
  stripeInvoiceId?: string;
  amount?: number;
  currency?: string;
  status?: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  paidAt?: Date | null;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function createInvoiceFactory(overrides: InvoiceFactoryOptions = {}): any {
  const now = new Date();
  const status = overrides.status ?? 'open';

  return {
    id: overrides.id ?? faker.string.uuid(),
    userId: overrides.userId ?? faker.string.uuid(),
    stripeInvoiceId: overrides.stripeInvoiceId ?? `in_${faker.string.alphanumeric(24)}`,
    amount: overrides.amount ?? faker.number.int({ min: 100, max: 100000 }), // cents
    currency: overrides.currency ?? 'usd',
    status,
    paidAt: overrides.paidAt ?? (status === 'paid' ? now : null),
    description: overrides.description ?? faker.commerce.productName(),
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

export function createInvoiceFactoryBatch(count: number, overrides: InvoiceFactoryOptions = {}): any[] {
  return Array.from({ length: count }, () => createInvoiceFactory(overrides));
}
