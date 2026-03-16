import { Test } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { SubscriptionService } from '../subscriptions/subscription.service';
import { DisputeService } from '../disputes/dispute.service';
import { ConnectService } from '../connect/connect.service';
import type Stripe from 'stripe';
import {
  PaymentIntentData,
  SetupIntentData,
  SubscriptionData,
  DisputeData,
  AccountData,
} from './dto/webhook-events.dto';

// Factory functions for creating test data
const createStripeEvent = (overrides: Partial<Stripe.Event> = {}): Stripe.Event =>
  ({
    id: 'evt_test123',
    object: 'event',
    api_version: '2023-10-16',
    created: Date.now(),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: 'payment_intent.succeeded',
    data: {
      object: {},
    },
    ...overrides,
  }) as Stripe.Event;

const createPaymentIntentData = (overrides: Partial<PaymentIntentData> = {}): PaymentIntentData =>
  ({
    id: 'pi_test123',
    object: 'payment_intent',
    amount: 1000,
    capture_method: 'automatic',
    client_secret: 'pi_test123_secret',
    confirmation_method: 'automatic',
    created: Date.now(),
    currency: 'usd',
    customer: 'cus_test123',
    description: 'Test payment',
    metadata: {},
    payment_method: 'pm_test123',
    payment_method_types: ['card'],
    receipt_email: 'test@example.com',
    status: 'succeeded',
    ...overrides,
  }) as PaymentIntentData;

const createSetupIntentData = (overrides: Partial<SetupIntentData> = {}): SetupIntentData =>
  ({
    id: 'seti_test123',
    object: 'setup_intent',
    application: null,
    automatic_payment_methods: { enabled: true },
    client_secret: 'seti_test123_secret',
    created: Date.now(),
    customer: 'cus_test123',
    description: 'Test setup',
    livemode: false,
    metadata: {},
    payment_method: 'pm_test123',
    payment_method_types: ['card'],
    single_use_mandate: null,
    status: 'succeeded',
    usage: 'off_session',
    ...overrides,
  }) as SetupIntentData;

const createSubscriptionData = (overrides: Partial<SubscriptionData> = {}): SubscriptionData =>
  ({
    id: 'sub_test123',
    object: 'subscription',
    application_fee_percent: null,
    automatic_tax: { enabled: false, liability: null },
    billing_cycle_anchor: Date.now(),
    billing_thresholds: null,
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    cancellation_details: { comment: null, feedback: null, reason: null },
    collection_method: 'charge_automatically',
    created: Date.now(),
    currency: 'usd',
    current_period_end: Date.now() + 86400 * 30,
    current_period_start: Date.now(),
    customer: 'cus_test123',
    days_until_due: null,
    default_payment_method: 'pm_test123',
    default_tax_rates: [],
    description: null,
    discounts: [],
    ended_at: null,
    items: {
      object: 'list',
      data: [],
      has_more: false,
      url: '/v1/subscription_items',
    },
    latest_invoice: 'inv_test123',
    livemode: false,
    metadata: {},
    next_pending_invoice_item_invoice: null,
    on_behalf_of: null,
    pause_collection: null,
    payment_settings: {
      application_fee_amount: null,
      automatic_payment_methods: null,
      default_mandate: null,
      default_payment_method: null,
      payment_method_options: null,
      payment_method_types: null,
    },
    pending_invoice_item_interval: null,
    pending_setup_intent: null,
    pending_update: null,
    plan: {
      id: 'plan_test123',
      object: 'plan',
      active: true,
      aggregate_usage: null,
      amount: 1000,
      billing_scheme: 'per_unit',
      created: Date.now(),
      currency: 'usd',
      interval: 'month',
      interval_count: 1,
      livemode: false,
      metadata: {},
      nickname: null,
      product: 'prod_test123',
      tiers: [],
      tiers_mode: null,
      transform_usage: null,
      trial_period_days: null,
      usage_type: 'licensed',
    },
    quantity: 1,
    schedule: null,
    start_date: Date.now(),
    status: 'active',
    test_clock: null,
    transfer_data: null,
    trial_end: null,
    trial_settings: {
      end_behavior: { missing_payment_method: 'cancel' },
    },
    trial_start: null,
    ...overrides,
  }) as SubscriptionData;

const createDisputeData = (overrides: Partial<DisputeData> = {}): DisputeData =>
  ({
    id: 'dp_test123',
    object: 'dispute',
    amount: 1000,
    balance_transactions: [],
    charge: 'ch_test123',
    created: Date.now(),
    currency: 'usd',
    evidence: {
      access_activity_log: null,
      billing_address: null,
      cancellation_policy: null,
      cancellation_policy_disclosure: null,
      cancellation_rebuttal: null,
      customer_communication: null,
      customer_email_address: null,
      customer_name: null,
      customer_purchase_ip: null,
      customer_signature: null,
      duplicate_charge_documentation: null,
      duplicate_charge_explanation: null,
      duplicate_charge_id: null,
      product_description: null,
      receipt: null,
      refund_policy: null,
      refund_policy_disclosure: null,
      refund_refusal_explanation: null,
      service_date: null,
      service_documentation: null,
      shipping_address: null,
      shipping_carrier: null,
      shipping_date: null,
      shipping_documentation: null,
      shipping_tracking_number: null,
      uncategorized_file: null,
      uncategorized_text: null,
    },
    evidence_details: {
      due_by: Date.now() + 86400 * 7,
      has_evidence: false,
      past_due: false,
      submission_count: 0,
    },
    is_charge_refundable: false,
    livemode: false,
    metadata: {},
    payment_intent: 'pi_test123',
    reason: 'fraudulent',
    status: 'needs_response',
    ...overrides,
  }) as DisputeData;

const createAccountData = (overrides: Partial<AccountData> = {}): AccountData =>
  ({
    id: 'acct_test123',
    object: 'account',
    business_profile: {
      mcc: null,
      name: 'Test Business',
      product_description: 'Test',
      support_address: null,
      support_email: 'support@example.com',
      support_phone: null,
      support_url: null,
      url: 'https://example.com',
    },
    capabilities: {},
    charges_enabled: true,
    controller: { type: 'account' },
    country: 'US',
    created: Date.now(),
    default_currency: 'usd',
    details_submitted: true,
    email: 'test@example.com',
    external_accounts: {
      object: 'list',
      data: [],
      has_more: false,
      total_count: 0,
      url: '/v1/accounts/acct_test123/external_accounts',
    },
    future_requirements: {
      alternatives: [],
      current_deadline: null,
      currently_due: [],
      disabled_reason: null,
      errors: [],
      eventually_due: [],
      past_due: [],
      pending_verification: [],
    },
    metadata: {},
    payouts_enabled: true,
    requirements: {
      alternatives: [],
      current_deadline: null,
      currently_due: [],
      disabled_reason: null,
      errors: [],
      eventually_due: [],
      past_due: [],
      pending_verification: [],
    },
    settings: {
      bacs_debit_payments: { display_name: null, service_user_number: null },
      branding: { icon: null, logo: null, primary_color: null, secondary_color: null },
      card_issuing: { tos_acceptance: { date: null, ip: null } },
      card_payments: {
        decline_on: { avs_failure: false, cvc_failure: false },
        statement_descriptor_prefix: null,
        statement_descriptor_prefix_kanji: null,
        statement_descriptor_prefix_kana: null,
      },
      dashboard: { display_name: 'Test', timezone: 'America/New_York' },
      payments: { statement_descriptor: null, statement_descriptor_kanji: null, statement_descriptor_kana: null },
      payouts: {
        debit_negative_balances: false,
        schedule: { delay_days: 2, interval: 'daily' },
        statement_descriptor: null,
      },
      sepa_debit_payments: { creditor_id: null },
    },
    tos_acceptance: { date: null, ip: null, user_agent: null },
    type: 'standard',
    ...overrides,
  }) as AccountData;

describe('WebhooksService', () => {
  let webhooksService: WebhooksService;
  let prismaService: PrismaService;
  let stripeService: StripeService;
  let redisService: RedisService;
  let configService: ConfigService;
  let subscriptionService: SubscriptionService;
  let disputeService: DisputeService;
  let connectService: ConnectService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: PrismaService,
          useValue: {
            webhookEvent: {
              create: vi.fn(),
              findUnique: vi.fn(),
              findMany: vi.fn(),
              update: vi.fn(),
              count: vi.fn(),
              groupBy: vi.fn(),
            },
            paymentRecord: {
              findUnique: vi.fn(),
              update: vi.fn(),
            },
          },
        },
        {
          provide: StripeService,
          useValue: {
            constructWebhookEvent: vi.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            acquireWebhookLock: vi.fn(),
            releaseWebhookLock: vi.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn(),
          },
        },
        {
          provide: SubscriptionService,
          useValue: {
            handleStripeSubscriptionUpdated: vi.fn(),
            handleStripeSubscriptionDeleted: vi.fn(),
          },
        },
        {
          provide: DisputeService,
          useValue: {
            handleDisputeCreated: vi.fn(),
            handleDisputeUpdated: vi.fn(),
          },
        },
        {
          provide: ConnectService,
          useValue: {
            handleAccountUpdated: vi.fn(),
          },
        },
      ],
    }).compile();

    webhooksService = moduleRef.get<WebhooksService>(WebhooksService);
    prismaService = moduleRef.get<PrismaService>(PrismaService);
    stripeService = moduleRef.get<StripeService>(StripeService);
    redisService = moduleRef.get<RedisService>(RedisService);
    configService = moduleRef.get<ConfigService>(ConfigService);
    subscriptionService = moduleRef.get<SubscriptionService>(SubscriptionService);
    disputeService = moduleRef.get<DisputeService>(DisputeService);
    connectService = moduleRef.get<ConnectService>(ConnectService);

    vi.clearAllMocks();
  });

  describe('service initialization', () => {
    it('should be defined', () => {
      expect(webhooksService).toBeDefined();
    });
  });

  describe('processWebhook', () => {
    const payload = '{"test":"data"}';
    const signature = 'sig_test123';

    it('should verify webhook signature and process valid events', async () => {
      // Arrange
      const event = createStripeEvent({
        type: 'payment_intent.succeeded',
        data: { object: createPaymentIntentData() },
      });

      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);
      vi.mocked(prismaService.webhookEvent.create).mockResolvedValue({ id: 'evt_db_123' });
      vi.mocked(redisService.acquireWebhookLock).mockResolvedValue(true);
      vi.mocked(prismaService.paymentRecord.findUnique).mockResolvedValue({
        id: 'pr_123',
        stripePaymentIntentId: 'pi_test123',
      });
      vi.mocked(prismaService.paymentRecord.update).mockResolvedValue({});
      vi.mocked(prismaService.webhookEvent.update).mockResolvedValue({});
      vi.mocked(redisService.releaseWebhookLock).mockResolvedValue(undefined);

      // Act
      await webhooksService.processWebhook(payload, signature);

      // Assert
      expect(stripeService.constructWebhookEvent).toHaveBeenCalledWith(
        payload,
        signature,
        'whsec_test',
      );
      expect(prismaService.webhookEvent.create).toHaveBeenCalled();
      expect(redisService.acquireWebhookLock).toHaveBeenCalledWith('evt_test123');
      expect(prismaService.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeEventId: 'evt_test123' },
          data: expect.objectContaining({ processed: true }),
        }),
      );
      expect(redisService.releaseWebhookLock).toHaveBeenCalledWith('evt_test123');
    });

    it('should throw error when webhook secret is not configured', async () => {
      // Arrange
      vi.mocked(configService.get).mockReturnValue(undefined);

      // Act & Assert
      await expect(webhooksService.processWebhook(payload, signature)).rejects.toThrow(
        'STRIPE_WEBHOOK_SECRET is not defined',
      );
    });

    it('should throw error when signature verification fails', async () => {
      // Arrange
      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      // Act & Assert
      await expect(webhooksService.processWebhook(payload, signature)).rejects.toThrow(
        'Invalid signature',
      );
    });

    it('should skip processing when Redis lock is not acquired (duplicate)', async () => {
      // Arrange
      const event = createStripeEvent({
        type: 'payment_intent.succeeded',
        data: { object: createPaymentIntentData() },
      });

      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);
      vi.mocked(prismaService.webhookEvent.create).mockResolvedValue({ id: 'evt_db_123' });
      vi.mocked(redisService.acquireWebhookLock).mockResolvedValue(false);

      // Act
      await webhooksService.processWebhook(payload, signature);

      // Assert
      expect(redisService.acquireWebhookLock).toHaveBeenCalledWith('evt_test123');
      expect(prismaService.paymentRecord.findUnique).not.toHaveBeenCalled();
      expect(redisService.releaseWebhookLock).not.toHaveBeenCalled();
    });

    it('should release lock even when event processing fails', async () => {
      // Arrange
      const event = createStripeEvent({
        type: 'payment_intent.succeeded',
        data: { object: createPaymentIntentData() },
      });

      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);
      vi.mocked(prismaService.webhookEvent.create).mockResolvedValue({ id: 'evt_db_123' });
      vi.mocked(redisService.acquireWebhookLock).mockResolvedValue(true);
      vi.mocked(prismaService.paymentRecord.findUnique).mockRejectedValue(new Error('DB error'));
      vi.mocked(prismaService.webhookEvent.update).mockResolvedValue({});
      vi.mocked(redisService.releaseWebhookLock).mockResolvedValue(undefined);

      // Act
      await webhooksService.processWebhook(payload, signature);

      // Assert
      expect(prismaService.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeEventId: 'evt_test123' },
          data: expect.objectContaining({ error: 'DB error' }),
        }),
      );
      expect(redisService.releaseWebhookLock).toHaveBeenCalledWith('evt_test123');
    });
  });

  describe('handleEvent', () => {
    it('should handle unhandled event types gracefully', async () => {
      // Arrange
      const event = createStripeEvent({
        type: 'unknown.event',
        data: { object: {} },
      });

      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);
      vi.mocked(prismaService.webhookEvent.create).mockResolvedValue({ id: 'evt_db_123' });
      vi.mocked(redisService.acquireWebhookLock).mockResolvedValue(true);
      vi.mocked(prismaService.webhookEvent.update).mockResolvedValue({});
      vi.mocked(redisService.releaseWebhookLock).mockResolvedValue(undefined);

      // Act
      await webhooksService.processWebhook('payload', 'sig');

      // Assert - should complete without throwing
      expect(prismaService.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ processed: true }),
        }),
      );
    });
  });

  describe('payment intent handlers', () => {
    it('should handle payment_intent.succeeded and update payment record', async () => {
      // Arrange
      const paymentIntent = createPaymentIntentData({ status: 'succeeded' });
      const event = createStripeEvent({
        type: 'payment_intent.succeeded',
        data: { object: paymentIntent },
      });

      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);
      vi.mocked(prismaService.webhookEvent.create).mockResolvedValue({ id: 'evt_db_123' });
      vi.mocked(redisService.acquireWebhookLock).mockResolvedValue(true);
      vi.mocked(prismaService.paymentRecord.findUnique).mockResolvedValue({
        id: 'pr_123',
        stripePaymentIntentId: 'pi_test123',
      });
      vi.mocked(prismaService.paymentRecord.update).mockResolvedValue({});
      vi.mocked(prismaService.webhookEvent.update).mockResolvedValue({});
      vi.mocked(redisService.releaseWebhookLock).mockResolvedValue(undefined);

      // Act
      await webhooksService.processWebhook('payload', 'sig');

      // Assert
      expect(prismaService.paymentRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pr_123' },
          data: expect.objectContaining({
            status: 'SUCCEEDED',
            errorMessage: null,
          }),
        }),
      );
    });

    it('should handle payment_intent.payment_failed and update with error', async () => {
      // Arrange
      const paymentIntent = createPaymentIntentData({
        status: 'requires_payment_method',
        last_payment_error: {
          message: 'Your card was declined.',
          type: 'card_error',
        },
      });
      const event = createStripeEvent({
        type: 'payment_intent.payment_failed',
        data: { object: paymentIntent },
      });

      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);
      vi.mocked(prismaService.webhookEvent.create).mockResolvedValue({ id: 'evt_db_123' });
      vi.mocked(redisService.acquireWebhookLock).mockResolvedValue(true);
      vi.mocked(prismaService.paymentRecord.findUnique).mockResolvedValue({
        id: 'pr_123',
        stripePaymentIntentId: 'pi_test123',
      });
      vi.mocked(prismaService.paymentRecord.update).mockResolvedValue({});
      vi.mocked(prismaService.webhookEvent.update).mockResolvedValue({});
      vi.mocked(redisService.releaseWebhookLock).mockResolvedValue(undefined);

      // Act
      await webhooksService.processWebhook('payload', 'sig');

      // Assert
      expect(prismaService.paymentRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pr_123' },
          data: expect.objectContaining({
            status: 'FAILED',
            errorMessage: 'Your card was declined.',
          }),
        }),
      );
    });

    it('should handle payment_intent.requires_action status', async () => {
      // Arrange
      const paymentIntent = createPaymentIntentData({ status: 'requires_action' });
      const event = createStripeEvent({
        type: 'payment_intent.requires_action',
        data: { object: paymentIntent },
      });

      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);
      vi.mocked(prismaService.webhookEvent.create).mockResolvedValue({ id: 'evt_db_123' });
      vi.mocked(redisService.acquireWebhookLock).mockResolvedValue(true);
      vi.mocked(prismaService.paymentRecord.findUnique).mockResolvedValue({
        id: 'pr_123',
        stripePaymentIntentId: 'pi_test123',
      });
      vi.mocked(prismaService.paymentRecord.update).mockResolvedValue({});
      vi.mocked(prismaService.webhookEvent.update).mockResolvedValue({});
      vi.mocked(redisService.releaseWebhookLock).mockResolvedValue(undefined);

      // Act
      await webhooksService.processWebhook('payload', 'sig');

      // Assert
      expect(prismaService.paymentRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pr_123' },
          data: expect.objectContaining({
            status: 'REQUIRES_ACTION',
          }),
        }),
      );
    });

    it('should warn when payment intent not found in database', async () => {
      // Arrange
      const paymentIntent = createPaymentIntentData();
      const event = createStripeEvent({
        type: 'payment_intent.succeeded',
        data: { object: paymentIntent },
      });

      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);
      vi.mocked(prismaService.webhookEvent.create).mockResolvedValue({ id: 'evt_db_123' });
      vi.mocked(redisService.acquireWebhookLock).mockResolvedValue(true);
      vi.mocked(prismaService.paymentRecord.findUnique).mockResolvedValue(null);
      vi.mocked(prismaService.webhookEvent.update).mockResolvedValue({});
      vi.mocked(redisService.releaseWebhookLock).mockResolvedValue(undefined);

      // Act
      await webhooksService.processWebhook('payload', 'sig');

      // Assert
      expect(prismaService.paymentRecord.update).not.toHaveBeenCalled();
      expect(prismaService.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ processed: true }),
        }),
      );
    });
  });

  describe('setup intent handlers', () => {
    it('should handle setup_intent.succeeded', async () => {
      // Arrange
      const setupIntent = createSetupIntentData({ status: 'succeeded' });
      const event = createStripeEvent({
        type: 'setup_intent.succeeded',
        data: { object: setupIntent },
      });

      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);
      vi.mocked(prismaService.webhookEvent.create).mockResolvedValue({ id: 'evt_db_123' });
      vi.mocked(redisService.acquireWebhookLock).mockResolvedValue(true);
      vi.mocked(prismaService.webhookEvent.update).mockResolvedValue({});
      vi.mocked(redisService.releaseWebhookLock).mockResolvedValue(undefined);

      // Act
      await webhooksService.processWebhook('payload', 'sig');

      // Assert
      expect(prismaService.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ processed: true }),
        }),
      );
    });

    it('should handle setup_intent.setup_failed with error logging', async () => {
      // Arrange
      const setupIntent = createSetupIntentData({
        status: 'requires_payment_method',
        last_setup_error: {
          message: 'Setup failed: card expired',
          type: 'card_error',
        },
      });
      const event = createStripeEvent({
        type: 'setup_intent.setup_failed',
        data: { object: setupIntent },
      });

      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);
      vi.mocked(prismaService.webhookEvent.create).mockResolvedValue({ id: 'evt_db_123' });
      vi.mocked(redisService.acquireWebhookLock).mockResolvedValue(true);
      vi.mocked(prismaService.webhookEvent.update).mockResolvedValue({});
      vi.mocked(redisService.releaseWebhookLock).mockResolvedValue(undefined);

      // Act
      await webhooksService.processWebhook('payload', 'sig');

      // Assert
      expect(prismaService.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ processed: true }),
        }),
      );
    });
  });

  describe('subscription handlers', () => {
    it('should handle customer.subscription.created', async () => {
      // Arrange
      const subscription = createSubscriptionData({ status: 'active' });
      const event = createStripeEvent({
        type: 'customer.subscription.created',
        data: { object: subscription },
      });

      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);
      vi.mocked(prismaService.webhookEvent.create).mockResolvedValue({ id: 'evt_db_123' });
      vi.mocked(redisService.acquireWebhookLock).mockResolvedValue(true);
      vi.mocked(prismaService.webhookEvent.update).mockResolvedValue({});
      vi.mocked(redisService.releaseWebhookLock).mockResolvedValue(undefined);

      // Act
      await webhooksService.processWebhook('payload', 'sig');

      // Assert
      expect(subscriptionService.handleStripeSubscriptionUpdated).not.toHaveBeenCalled();
      expect(subscriptionService.handleStripeSubscriptionDeleted).not.toHaveBeenCalled();
      expect(prismaService.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ processed: true }),
        }),
      );
    });

    it('should handle customer.subscription.updated and call subscriptionService', async () => {
      // Arrange
      const subscription = createSubscriptionData({ status: 'active' });
      const event = createStripeEvent({
        type: 'customer.subscription.updated',
        data: { object: subscription },
      });

      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);
      vi.mocked(prismaService.webhookEvent.create).mockResolvedValue({ id: 'evt_db_123' });
      vi.mocked(redisService.acquireWebhookLock).mockResolvedValue(true);
      vi.mocked(subscriptionService.handleStripeSubscriptionUpdated).mockResolvedValue(undefined);
      vi.mocked(prismaService.webhookEvent.update).mockResolvedValue({});
      vi.mocked(redisService.releaseWebhookLock).mockResolvedValue(undefined);

      // Act
      await webhooksService.processWebhook('payload', 'sig');

      // Assert
      expect(subscriptionService.handleStripeSubscriptionUpdated).toHaveBeenCalled();
      expect(prismaService.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ processed: true }),
        }),
      );
    });

    it('should handle customer.subscription.deleted and call subscriptionService', async () => {
      // Arrange
      const subscription = createSubscriptionData({ status: 'canceled' });
      const event = createStripeEvent({
        type: 'customer.subscription.deleted',
        data: { object: subscription },
      });

      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);
      vi.mocked(prismaService.webhookEvent.create).mockResolvedValue({ id: 'evt_db_123' });
      vi.mocked(redisService.acquireWebhookLock).mockResolvedValue(true);
      vi.mocked(subscriptionService.handleStripeSubscriptionDeleted).mockResolvedValue(undefined);
      vi.mocked(prismaService.webhookEvent.update).mockResolvedValue({});
      vi.mocked(redisService.releaseWebhookLock).mockResolvedValue(undefined);

      // Act
      await webhooksService.processWebhook('payload', 'sig');

      // Assert
      expect(subscriptionService.handleStripeSubscriptionDeleted).toHaveBeenCalled();
      expect(prismaService.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ processed: true }),
        }),
      );
    });
  });

  describe('dispute handlers', () => {
    it('should handle charge.dispute.created and call disputeService', async () => {
      // Arrange
      const dispute = createDisputeData({ status: 'needs_response' });
      const event = createStripeEvent({
        type: 'charge.dispute.created',
        data: { object: dispute },
      });

      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);
      vi.mocked(prismaService.webhookEvent.create).mockResolvedValue({ id: 'evt_db_123' });
      vi.mocked(redisService.acquireWebhookLock).mockResolvedValue(true);
      vi.mocked(disputeService.handleDisputeCreated).mockResolvedValue(undefined);
      vi.mocked(prismaService.webhookEvent.update).mockResolvedValue({});
      vi.mocked(redisService.releaseWebhookLock).mockResolvedValue(undefined);

      // Act
      await webhooksService.processWebhook('payload', 'sig');

      // Assert
      expect(disputeService.handleDisputeCreated).toHaveBeenCalled();
      expect(prismaService.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ processed: true }),
        }),
      );
    });

    it('should handle charge.dispute.updated and call disputeService', async () => {
      // Arrange
      const dispute = createDisputeData({ status: 'under_review' });
      const event = createStripeEvent({
        type: 'charge.dispute.updated',
        data: { object: dispute },
      });

      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);
      vi.mocked(prismaService.webhookEvent.create).mockResolvedValue({ id: 'evt_db_123' });
      vi.mocked(redisService.acquireWebhookLock).mockResolvedValue(true);
      vi.mocked(disputeService.handleDisputeUpdated).mockResolvedValue(undefined);
      vi.mocked(prismaService.webhookEvent.update).mockResolvedValue({});
      vi.mocked(redisService.releaseWebhookLock).mockResolvedValue(undefined);

      // Act
      await webhooksService.processWebhook('payload', 'sig');

      // Assert
      expect(disputeService.handleDisputeUpdated).toHaveBeenCalled();
      expect(prismaService.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ processed: true }),
        }),
      );
    });
  });

  describe('account handlers', () => {
    it('should handle account.updated and call connectService', async () => {
      // Arrange
      const account = createAccountData({ charges_enabled: true });
      const event = createStripeEvent({
        type: 'account.updated',
        data: { object: account },
      });

      vi.mocked(configService.get).mockReturnValue('whsec_test');
      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);
      vi.mocked(prismaService.webhookEvent.create).mockResolvedValue({ id: 'evt_db_123' });
      vi.mocked(redisService.acquireWebhookLock).mockResolvedValue(true);
      vi.mocked(connectService.handleAccountUpdated).mockResolvedValue(undefined);
      vi.mocked(prismaService.webhookEvent.update).mockResolvedValue({});
      vi.mocked(redisService.releaseWebhookLock).mockResolvedValue(undefined);

      // Act
      await webhooksService.processWebhook('payload', 'sig');

      // Assert
      expect(connectService.handleAccountUpdated).toHaveBeenCalled();
      expect(prismaService.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ processed: true }),
        }),
      );
    });
  });

  describe('dashboard methods', () => {
    describe('getWebhookStats', () => {
      it('should get webhook stats with correct counts', async () => {
        // Arrange
        vi.mocked(prismaService.webhookEvent.count).mockResolvedValueOnce(100); // total
        vi.mocked(prismaService.webhookEvent.count).mockResolvedValueOnce(80); // processed
        vi.mocked(prismaService.webhookEvent.count).mockResolvedValueOnce(10); // failed
        vi.mocked(prismaService.webhookEvent.groupBy).mockResolvedValue([
          { type: 'payment_intent.succeeded', _count: { type: 50 } },
          { type: 'payment_intent.payment_failed', _count: { type: 30 } },
          { type: 'customer.subscription.updated', _count: { type: 20 } },
        ]);

        // Act
        const stats = await webhooksService.getWebhookStats();

        // Assert
        expect(stats).toEqual({
          total: 100,
          processed: 80,
          failed: 10,
          pending: 20,
          byType: {
            'payment_intent.succeeded': 50,
            'payment_intent.payment_failed': 30,
            'customer.subscription.updated': 20,
          },
        });
        expect(prismaService.webhookEvent.count).toHaveBeenCalledTimes(3);
        expect(prismaService.webhookEvent.groupBy).toHaveBeenCalledWith({
          by: ['type'],
          _count: { type: true },
        });
      });
    });

    describe('getWebhookEvents', () => {
      it('should get webhook events with pagination and filters', async () => {
        // Arrange
        const mockEvents = [
          { id: 'evt_1', type: 'payment_intent.succeeded', processed: true },
          { id: 'evt_2', type: 'payment_intent.payment_failed', processed: false },
        ];
        vi.mocked(prismaService.webhookEvent.findMany).mockResolvedValue(mockEvents);
        vi.mocked(prismaService.webhookEvent.count).mockResolvedValue(2);

        // Act
        const result = await webhooksService.getWebhookEvents({
          limit: 10,
          offset: 0,
          processed: true,
          type: 'payment_intent.succeeded',
        });

        // Assert
        expect(result.events).toEqual(mockEvents);
        expect(result.total).toBe(2);
        expect(prismaService.webhookEvent.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              processed: true,
              type: 'payment_intent.succeeded',
            }),
            orderBy: { createdAt: 'desc' },
            take: 10,
            skip: 0,
          }),
        );
      });

      it('should get webhook events with failed filter', async () => {
        // Arrange
        const mockEvents = [{ id: 'evt_1', type: 'payment_intent.payment_failed', error: 'Failed' }];
        vi.mocked(prismaService.webhookEvent.findMany).mockResolvedValue(mockEvents);
        vi.mocked(prismaService.webhookEvent.count).mockResolvedValue(1);

        // Act
        const result = await webhooksService.getWebhookEvents({
          limit: 20,
          offset: 0,
          failed: true,
        });

        // Assert
        expect(result.events).toEqual(mockEvents);
        expect(prismaService.webhookEvent.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              error: { not: null },
            }),
          }),
        );
      });

      it('should use default limit and offset when not provided', async () => {
        // Arrange
        vi.mocked(prismaService.webhookEvent.findMany).mockResolvedValue([]);
        vi.mocked(prismaService.webhookEvent.count).mockResolvedValue(0);

        // Act
        await webhooksService.getWebhookEvents({});

        // Assert
        expect(prismaService.webhookEvent.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 50,
            skip: 0,
          }),
        );
      });
    });

    describe('getWebhookEvent', () => {
      it('should get single webhook event', async () => {
        // Arrange
        const mockEvent = { id: 'evt_123', type: 'payment_intent.succeeded' };
        vi.mocked(prismaService.webhookEvent.findUnique).mockResolvedValue(mockEvent);

        // Act
        const result = await webhooksService.getWebhookEvent('evt_123');

        // Assert
        expect(result).toEqual(mockEvent);
        expect(prismaService.webhookEvent.findUnique).toHaveBeenCalledWith({
          where: { id: 'evt_123' },
        });
      });

      it('should return null when event not found', async () => {
        // Arrange
        vi.mocked(prismaService.webhookEvent.findUnique).mockResolvedValue(null);

        // Act
        const result = await webhooksService.getWebhookEvent('evt_nonexistent');

        // Assert
        expect(result).toBeNull();
      });
    });

    describe('retryWebhookEvent', () => {
      it('should retry failed webhook events', async () => {
        // Arrange
        const mockStripeEvent = createStripeEvent({
          type: 'payment_intent.succeeded',
          data: { object: createPaymentIntentData() },
        });
        const mockEvent = {
          id: 'evt_123',
          stripeEventId: 'evt_stripe_123',
          type: 'payment_intent.succeeded',
          processed: false,
          error: 'Previous error',
          data: mockStripeEvent,
          createdAt: new Date(),
        };
        vi.mocked(prismaService.webhookEvent.findUnique).mockResolvedValue(mockEvent);
        vi.mocked(prismaService.webhookEvent.update).mockResolvedValue({});
        vi.mocked(prismaService.paymentRecord.findUnique).mockResolvedValue({
          id: 'pr_123',
          stripePaymentIntentId: 'pi_test123',
        });
        vi.mocked(prismaService.paymentRecord.update).mockResolvedValue({});

        // Act
        await webhooksService.retryWebhookEvent('evt_123');

        // Assert
        expect(prismaService.webhookEvent.update).toHaveBeenCalledTimes(2);
        expect(prismaService.webhookEvent.update).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            where: { id: 'evt_123' },
            data: expect.objectContaining({
              error: null,
              processed: false,
              processedAt: null,
            }),
          }),
        );
        expect(prismaService.webhookEvent.update).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            where: { id: 'evt_123' },
            data: expect.objectContaining({
              processed: true,
            }),
          }),
        );
      });

      it('should throw when event not found', async () => {
        // Arrange
        vi.mocked(prismaService.webhookEvent.findUnique).mockResolvedValue(null);

        // Act & Assert
        await expect(webhooksService.retryWebhookEvent('evt_nonexistent')).rejects.toThrow(
          'Webhook event not found',
        );
      });

      it('should throw when event already processed', async () => {
        // Arrange
        const mockEvent = {
          id: 'evt_123',
          type: 'payment_intent.succeeded',
          processed: true,
          error: null,
          data: {},
        };
        vi.mocked(prismaService.webhookEvent.findUnique).mockResolvedValue(mockEvent);

        // Act & Assert
        await expect(webhooksService.retryWebhookEvent('evt_123')).rejects.toThrow(
          'Webhook event already processed',
        );
      });
    });

    describe('getRecentErrors', () => {
      it('should get recent errors', async () => {
        // Arrange
        const mockErrors = [
          { id: 'evt_1', type: 'payment_intent.succeeded', error: 'Error 1' },
          { id: 'evt_2', type: 'payment_intent.payment_failed', error: 'Error 2' },
        ];
        vi.mocked(prismaService.webhookEvent.findMany).mockResolvedValue(mockErrors);

        // Act
        const result = await webhooksService.getRecentErrors(10);

        // Assert
        expect(result).toEqual(mockErrors);
        expect(prismaService.webhookEvent.findMany).toHaveBeenCalledWith({
          where: { error: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
      });

      it('should use default limit when not provided', async () => {
        // Arrange
        vi.mocked(prismaService.webhookEvent.findMany).mockResolvedValue([]);

        // Act
        await webhooksService.getRecentErrors();

        // Assert
        expect(prismaService.webhookEvent.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 20,
          }),
        );
      });
    });
  });
});
