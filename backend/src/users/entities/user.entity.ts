export class UserEntity {
  id: string;
  email: string;
  name?: string;
  stripeCustomerId?: string;
  defaultPaymentMethodId?: string;
  createdAt: Date;
  updatedAt: Date;
}
