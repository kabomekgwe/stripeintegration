import { faker } from '@faker-js/faker';
import { UserEntity } from '../../src/users/entities/user.entity';

export interface UserFactoryOptions {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  preferredCurrency?: string;
  country?: string;
  stripeCustomerId?: string;
  defaultPaymentMethodId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function createUserFactory(overrides: UserFactoryOptions = {}): UserEntity {
  const now = new Date();

  return {
    id: overrides.id ?? faker.string.uuid(),
    email: overrides.email ?? faker.internet.email(),
    name: overrides.name ?? faker.person.fullName(),
    role: overrides.role ?? 'user',
    preferredCurrency: overrides.preferredCurrency ?? 'USD',
    country: overrides.country ?? faker.location.countryCode('alpha-2'),
    stripeCustomerId: overrides.stripeCustomerId ?? `cus_${faker.string.alphanumeric(14)}`,
    defaultPaymentMethodId: overrides.defaultPaymentMethodId ?? `pm_${faker.string.alphanumeric(14)}`,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

export function createUserFactoryBatch(count: number, overrides: UserFactoryOptions = {}): UserEntity[] {
  return Array.from({ length: count }, () => createUserFactory(overrides));
}
