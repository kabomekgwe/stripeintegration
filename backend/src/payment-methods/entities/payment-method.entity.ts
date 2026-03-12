export class PaymentMethodEntity {
  id: string;
  stripePmId: string;
  type: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
}
