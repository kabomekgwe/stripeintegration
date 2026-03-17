export class PaymentMethodEntity {
  id: string;
  stripePmId: string;
  type: string;

  // Card-specific fields
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;

  // Bank account fields (US ACH)
  bankName?: string;
  accountType?: string;

  // SEPA Direct Debit fields
  bankCode?: string;
  country?: string;

  // Wallet fields
  walletType?: string;

  // Common fields
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
}