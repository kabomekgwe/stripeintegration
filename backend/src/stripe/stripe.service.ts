import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not defined');
    }
    this.stripe = new Stripe(secretKey, {
      // Latest stable version supported by SDK
      apiVersion: '2025-02-24.acacia',
    });
  }

  // Customer management
  async createCustomer(
    email: string,
    name?: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Customer> {
    const idempotencyKey = uuidv4();

    return this.stripe.customers.create(
      {
        email,
        name,
        metadata,
      },
      { idempotencyKey },
    );
  }

  async updateCustomer(
    customerId: string,
    updates: Partial<Stripe.CustomerUpdateParams>,
  ): Promise<Stripe.Customer> {
    return this.stripe.customers.update(customerId, updates);
  }

  async deleteCustomer(customerId: string): Promise<void> {
    await this.stripe.customers.del(customerId);
  }

  // Payment methods
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string,
  ): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  }

  async detachPaymentMethod(
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.detach(paymentMethodId);
  }

  async listPaymentMethods(
    customerId: string,
    type?: Stripe.PaymentMethodListParams.Type,
  ): Promise<Stripe.ApiList<Stripe.PaymentMethod>> {
    return this.stripe.paymentMethods.list({
      customer: customerId,
      type: type || 'card',
    });
  }

  // Setup intents (for saving payment methods)
  async createSetupIntent(
    customerId: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.SetupIntent> {
    const idempotencyKey = uuidv4();

    return this.stripe.setupIntents.create(
      {
        customer: customerId,
        // Use automatic_payment_methods instead of hardcoded types
        // Enable desired methods in Stripe Dashboard: https://dashboard.stripe.com/settings/payments
        automatic_payment_methods: {
          enabled: true,
        },
        metadata,
        usage: 'off_session',
      },
      { idempotencyKey },
    );
  }

  // Payment intents (for immediate charges)
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    customerId: string;
    paymentMethodId?: string;
    offSession?: boolean;
    confirm?: boolean;
    description?: string;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<Stripe.PaymentIntent> {
    const idempotencyKey = params.idempotencyKey || uuidv4();

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: params.amount,
      currency: params.currency,
      customer: params.customerId,
      description: params.description,
      metadata: params.metadata,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
    };

    if (params.paymentMethodId) {
      paymentIntentParams.payment_method = params.paymentMethodId;
    }

    if (params.offSession) {
      paymentIntentParams.off_session = true;
    }

    if (params.confirm) {
      paymentIntentParams.confirm = true;
    }

    return this.stripe.paymentIntents.create(paymentIntentParams, {
      idempotencyKey,
    });
  }

  async retrievePaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string,
  ): Promise<Stripe.PaymentIntent> {
    const params: Stripe.PaymentIntentConfirmParams = {};
    if (paymentMethodId) {
      params.payment_method = paymentMethodId;
    }
    return this.stripe.paymentIntents.confirm(paymentIntentId, params);
  }

  async cancelPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  // Refunds
  async createRefund(params: {
    paymentIntentId: string;
    amount?: number;
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  }): Promise<Stripe.Refund> {
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: params.paymentIntentId,
    };

    if (params.amount) {
      refundParams.amount = params.amount;
    }

    if (params.reason) {
      refundParams.reason = params.reason;
    }

    return this.stripe.refunds.create(refundParams);
  }

  async retrieveRefund(refundId: string): Promise<Stripe.Refund> {
    return this.stripe.refunds.retrieve(refundId);
  }

  // Webhooks
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  // Test clocks (for testing)
  async createTestClock(frozenTime: number): Promise<Stripe.TestHelpers.TestClock> {
    return this.stripe.testHelpers.testClocks.create({
      frozen_time: frozenTime,
    });
  }

  async advanceTestClock(
    testClockId: string,
    frozenTime: number,
  ): Promise<Stripe.TestHelpers.TestClock> {
    return this.stripe.testHelpers.testClocks.advance(testClockId, {
      frozen_time: frozenTime,
    });
  }
}
