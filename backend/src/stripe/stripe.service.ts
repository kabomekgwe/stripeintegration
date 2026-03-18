import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { handleStripeError, isRetryableStripeError, logStripeError } from './stripe.errors';

/**
 * Application info for Stripe telemetry
 * Helps Stripe debug issues specific to this integration
 */
const APP_INFO: Stripe.AppInfo = {
  name: 'stripe-integration',
  version: '1.0.0',
  url: 'https://github.com/yourorg/stripe-integration',
};

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not defined');
    }

    const appVersion = this.configService.get<string>('npm_package_version') || '1.0.0';

    this.stripe = new Stripe(secretKey, {
      // Use preview version for FX Quotes API support
      apiVersion: '2025-03-31.basil' as Stripe.LatestApiVersion,
      // App info for Stripe telemetry - helps with debugging
      appInfo: {
        name: APP_INFO.name,
        version: appVersion,
        url: APP_INFO.url,
      },
      // Network retry configuration for transient failures
      maxNetworkRetries: 2,
      // Timeout for API requests (30 seconds)
      timeout: 30000,
      // Telemetry enabled for better support
      telemetry: true,
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

  async getPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.retrieve(paymentMethodId) as Promise<Stripe.PaymentMethod>;
  }

  async listPaymentMethods(
    customerId: string,
  ): Promise<Stripe.ApiList<Stripe.PaymentMethod>> {
    // Get all enabled payment method types from Dashboard
    const { paymentMethodTypes } = await this.getEnabledPaymentMethods();

    const allMethods: Stripe.PaymentMethod[] = [];

    // Fetch each type (Stripe API requires type parameter)
    for (const type of paymentMethodTypes) {
      try {
        const methods = await this.stripe.paymentMethods.list({
          customer: customerId,
          type: type as Stripe.PaymentMethodListParams.Type,
        });
        allMethods.push(...methods.data);
      } catch {
        // Skip types that don't support listing
        continue;
      }
    }

    return {
      object: 'list',
      data: allMethods,
      has_more: false,
      url: '/v1/payment_methods',
    } as Stripe.ApiList<Stripe.PaymentMethod>;
  }

  // Setup intents (for saving payment methods)
  async createSetupIntent(
    customerId: string,
    metadata?: Record<string, string>,
    paymentMethodId?: string, // Optional: pass existing payment method
  ): Promise<Stripe.SetupIntent> {
    const idempotencyKey = uuidv4();

    const setupIntentParams: Stripe.SetupIntentCreateParams = {
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata,
      usage: 'off_session',
    };

    if (paymentMethodId) {
      setupIntentParams.payment_method = paymentMethodId;
    }

    return this.stripe.setupIntents.create(
      setupIntentParams,
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

  isStripeTaxEnabled(): boolean {
    return this.configService.get<boolean>('STRIPE_TAX_ENABLED') || false;
  }

  getStripe(): Stripe {
    return this.stripe;
  }

  /**
   * Get enabled payment method configurations for the account
   * Uses Stripe PaymentMethodConfigurations API to get the actual enabled methods
   */
  async getEnabledPaymentMethods(): Promise<{
  paymentMethodTypes: string[];
  paymentMethodConfigurations: Array<{
    id: string;
    displayName: string;
    parent?: string;
    active: boolean;
  }>;
}> {
  try {
    const configs = await this.stripe.paymentMethodConfigurations.list({
      limit: 100,
    });

    const configurationsArray: Array<{
      id: string;
      displayName: string;
      parent?: string;
      active: boolean;
    }> = [];

    const paymentMethodTypes: string[] = [];

    const NON_PAYMENT_METHOD_KEYS = new Set([
      'id',
      'object',
      'active',
      'application',
      'is_default',
      'livemode',
      'name',
      'parent',
    ]);

    for (const config of configs.data) {
      if (!config.active) continue;

      for (const [type, value] of Object.entries(config)) {
   
        

        const paymentMethodConfig = value as {
          available?: boolean;
          display_preference?: {
            overridable?: boolean | null;
            preference?: string;
            value?: string;
          };
        };

        // Keep only enabled/available methods
        if (!paymentMethodConfig.available) continue;

        // Optional: require Stripe display setting to also be "on"
        // if (paymentMethodConfig.display_preference?.value !== 'on') continue;

        if (!paymentMethodTypes.includes(type)) {
          paymentMethodTypes.push(type);
        }

        if (!configurationsArray.some((item) => item.id === type)) {
          configurationsArray.push({
            id: type,
            displayName: this.getDisplayName(type),
            parent: undefined,
            active: true,
          });
        }
      }
    }

    if (configurationsArray.length === 0) {
      configurationsArray.push({
        id: 'card',
        displayName: 'Card',
        parent: undefined,
        active: true,
      });
      paymentMethodTypes.push('card');
    }

    return {
      paymentMethodTypes,
      paymentMethodConfigurations: configurationsArray,
    };
  } catch (error) {
    this.logger.warn(
      'Could not retrieve payment method configurations, using defaults',
      error,
    );

    return {
      paymentMethodTypes: ['card'],
      paymentMethodConfigurations: [
        {
          id: 'card',
          displayName: 'Card',
          parent: undefined,
          active: true,
        },
      ],
    };
  }
}

  /**
   * Get display name for payment method type
   */
  private getDisplayName(type: string): string {
    const displayNames: Record<string, string> = {
      card: 'Card',
      us_bank_account: 'US Bank Account (ACH)',
      sepa_debit: 'SEPA Direct Debit',
      au_becs_debit: 'BECS Direct Debit',
      bacs_debit: 'BACS Direct Debit',
      bancontact: 'Bancontact',
      ideal: 'iDEAL',
      giropay: 'Giropay',
      eps: 'EPS',
      p24: 'Przelewy24',
      sofort: 'Sofort',
      link: 'Link',
      affirm: 'Affirm',
      afterpay_clearpay: 'Afterpay / Clearpay',
      klarna: 'Klarna',
      wechat_pay: 'WeChat Pay',
      alipay: 'Alipay',
      cashapp: 'Cash App Pay',
    };
    return displayNames[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
  }

  /**
   * Get parent type for payment method (e.g., 'card' for 'visa', 'mastercard')
   */
  private getParentType(type: string): string | undefined {
    const parentMap: Record<string, string> = {
      // Card brands have 'card' as parent
      visa: 'card',
      mastercard: 'card',
      amex: 'card',
      discover: 'card',
      // Add others as needed
    };
    return parentMap[type];
  }

  // Checkout Sessions (for Adaptive Pricing / Embedded Checkout)
  /**
   * Create a Checkout Session in embedded UI mode with Adaptive Pricing enabled.
   *
   * NOTE: adaptive_pricing has no effect unless also enabled in the Stripe Dashboard:
   * Settings → Payment methods → Adaptive Pricing.
   */
  async createCheckoutSession(params: {
    amount: number;
    currency: string;
    customerId: string;
    description?: string;
    returnUrl: string;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<Stripe.Checkout.Session> {
    const idempotencyKey = params.idempotencyKey || uuidv4();

    return this.stripe.checkout.sessions.create(
      {
        ui_mode: 'embedded',
        mode: 'payment',
        customer: params.customerId,
        line_items: [
          {
            price_data: {
              currency: params.currency,
              product_data: { name: params.description || 'Payment' },
              unit_amount: params.amount,
            },
            quantity: 1,
          },
        ],
        // Adaptive Pricing shows localised currency to international customers.
        // Requires the feature to be enabled in the Stripe Dashboard as well.
        adaptive_pricing: { enabled: true },
        return_url: params.returnUrl,
        metadata: params.metadata,
      },
      { idempotencyKey },
    );
  }

  /**
   * Get exchange rates from Stripe FX Quotes API
   * Returns rates relative to USD (how much 1 USD is worth in each currency)
   *
   * Note: Uses Stripe's FX Quotes API (preview). The base_rate is the mid-market
   * rate, while exchange_rate includes Stripe's ~2% FX fee.
   * We use base_rate for display purposes.
   */
  async getExchangeRates(): Promise<Record<string, number>> {
    // Currencies we want rates for (supported by the app)
    const fromCurrencies = ['eur', 'gbp', 'cad', 'aud', 'jpy', 'zar'];

    try {
      // Create an FX quote to get current rates
      // FX Quotes is a preview API, so we need to cast the Stripe client
      // to access the fxQuotes resource
      const stripeWithFx = this.stripe as unknown as {
        fxQuotes: {
          create: (params: {
            to_currency: string;
            from_currencies: string[];
            lock_duration: 'none' | 'five_minutes' | 'hour' | 'day';
          }) => Promise<{
            rates: Record<string, { rate_details: { base_rate: number } }>;
          }>;
        };
      };

      const quote = await stripeWithFx.fxQuotes.create({
        to_currency: 'usd',
        from_currencies: fromCurrencies,
        lock_duration: 'none', // Don't lock the rate, just get current spot
      });

      const rates: Record<string, number> = { usd: 1.0 };

      // Extract base_rate from each currency's rate details
      for (const [currency, data] of Object.entries(quote.rates || {})) {
        if (data.rate_details?.base_rate) {
          // base_rate is mid-market rate (no Stripe fee)
          // For display: 1 USD = X foreign currency, so we need the inverse
          rates[currency.toLowerCase()] = 1 / data.rate_details.base_rate;
        }
      }

      this.logger.log(
        `Fetched exchange rates for ${Object.keys(rates).length} currencies from Stripe FX Quotes`,
      );
      return rates;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to fetch FX quotes from Stripe: ${errorMessage}`,
      );
      // Return fallback rates if API fails
      return { usd: 1.0 };
    }
  }
}
