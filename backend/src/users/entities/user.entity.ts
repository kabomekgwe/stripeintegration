export class UserEntity {
  id: string;
  email: string;
  name?: string;
  role: string;
  stripeCustomerId?: string;
  defaultPaymentMethodId?: string;
  preferredCurrency: string;
  createdAt: Date;
  updatedAt: Date;
}
