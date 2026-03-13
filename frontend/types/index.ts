export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'USER' | 'ADMIN';
  stripeCustomerId?: string;
  defaultPaymentMethodId?: string;
}

export interface PaymentMethod {
  id: string;
  stripePmId: string;
  type: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Payment {
  id: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'REQUIRES_ACTION';
  paymentMethodId?: string;
  description?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface UsageRecord {
  id: string;
  period: string;
  amount: number;
  usageCount: number;
  description?: string;
  billed: boolean;
  paymentId?: string;
  createdAt: string;
}

export interface BillingPreview {
  period: string;
  totalAmount: number;
  usageCount: number;
  description: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface CreatePaymentRequest {
  amount: number;
  currency: string;
  paymentMethodId?: string;
  description?: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

export interface SetupIntentResponse {
  clientSecret: string;
}

export interface CreateUsageRequest {
  amount: number;
  usageCount: number;
  description?: string;
}

export interface BillingResult {
  success: boolean;
  paymentId?: string;
  error?: string;
}

export interface MonthlyBillingResult {
  processed: number;
  succeeded: number;
  failed: number;
}
