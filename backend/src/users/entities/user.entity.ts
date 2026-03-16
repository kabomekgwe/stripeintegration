export class UserEntity {
  id: string;
  email: string;
  name?: string;
  role: string;
  preferredCurrency: string;
  country?: string;  // ISO 3166-1 alpha-2 code
  stripeCustomerId?: string;
  defaultPaymentMethodId?: string;
  createdAt: Date;
  updatedAt: Date;

  // Suspension fields
  suspended?: boolean;
  suspendedAt?: Date;
  suspensionReason?: string;
  suspensionExpiry?: Date | null;
}
