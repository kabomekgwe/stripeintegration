export class PaymentEntity {
  id: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethodId?: string;
  description?: string;
  errorMessage?: string;
  idempotencyKey?: string;
  createdAt: Date;
}
