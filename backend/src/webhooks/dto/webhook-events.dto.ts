/**
 * Stripe Webhook Event Types
 *
 * Comprehensive TypeScript interfaces for Stripe webhook events.
 * Replaces all 'any' types with proper type definitions.
 */

// ============================================================================
// Base Event Types
// ============================================================================

/**
 * Request information embedded in webhook events
 */
export interface StripeWebhookRequest {
  id: string | null;
  idempotency_key: string | null;
}

/**
 * Base interface for all Stripe webhook events
 */
export interface StripeWebhookEvent {
  id: string;
  object: 'event';
  api_version: string;
  created: number;
  livemode: boolean;
  pending_webhooks: number;
  request: StripeWebhookRequest;
  type: string;
}

/**
 * Generic event with typed data
 */
export interface StripeWebhookEventTyped<T> extends StripeWebhookEvent {
  data: {
    object: T;
    previous_attributes?: Record<string, unknown>;
  };
}

// ============================================================================
// Payment Intent Data Types
// ============================================================================

/**
 * Stripe PaymentIntent status
 */
export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'canceled'
  | 'succeeded';

/**
 * Payment method details
 */
export interface PaymentMethodDetails {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
    network?: string;
  };
}

/**
 * Payment intent data structure
 */
export interface PaymentIntentData {
  id: string;
  object: 'payment_intent';
  amount: number;
  amount_capturable?: number;
  amount_received?: number;
  automatic_payment_methods?: {
    enabled: boolean;
  };
  canceled_at?: number | null;
  cancellation_reason?: string | null;
  capture_method: 'automatic' | 'manual';
  charges?: {
    object: 'list';
    data: Array<{
      id: string;
      amount: number;
      status: string;
    }>;
    has_more: boolean;
  };
  client_secret: string;
  confirmation_method: 'automatic' | 'manual';
  created: number;
  currency: string;
  customer: string | null;
  description: string | null;
  last_payment_error?: {
    code?: string;
    message: string;
    payment_method?: PaymentMethodDetails;
    type: string;
  };
  metadata: Record<string, string>;
  next_action?: {
    type: string;
    use_stripe_sdk?: {
      type: string;
      stripe_js: string;
    };
    redirect_to_url?: {
      url: string;
      return_url: string;
    };
  };
  payment_method: string | null;
  payment_method_types: string[];
  receipt_email: string | null;
  setup_future_usage?: 'on_session' | 'off_session' | null;
  shipping?: Record<string, unknown> | null;
  status: PaymentIntentStatus;
}

// ============================================================================
// Setup Intent Data Types
// ============================================================================

/**
 * Setup intent data structure
 */
export interface SetupIntentData {
  id: string;
  object: 'setup_intent';
  application: string | null;
  automatic_payment_methods: {
    enabled: boolean;
  } | null;
  cancellation_reason?: string | null;
  client_secret: string;
  created: number;
  customer: string | null;
  description: string | null;
  last_setup_error?: {
    code?: string;
    message: string;
    payment_method?: PaymentMethodDetails;
    type: string;
  };
  latest_attempt: string | null;
  livemode: boolean;
  metadata: Record<string, string>;
  next_action?: {
    type: string;
    use_stripe_sdk?: {
      type: string;
      stripe_js: string;
    };
    verify_with_microdeposits?: {
      arrival_date: number;
      hosted_verification_url: string;
      microdeposit_type: string;
    };
  };
  payment_method: string | null;
  payment_method_options?: Record<string, unknown>;
  payment_method_types: string[];
  single_use_mandate: string | null;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'succeeded' | 'canceled';
  usage: 'on_session' | 'off_session';
}

// ============================================================================
// Subscription Data Types
// ============================================================================

/**
 * Subscription status
 */
export type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

/**
 * Subscription item
 */
export interface SubscriptionItem {
  id: string;
  object: 'subscription_item';
  billing_thresholds: unknown | null;
  created: number;
  discounts: unknown[];
  metadata: Record<string, string>;
  plan: {
    id: string;
    object: 'plan';
    active: boolean;
    aggregate_usage: string | null;
    amount: number;
    amount_decimal: string;
    billing_scheme: string;
    created: number;
    currency: string;
    interval: 'day' | 'week' | 'month' | 'year';
    interval_count: number;
    livemode: boolean;
    metadata: Record<string, string>;
    nickname: string | null;
    product: string;
    tiers: unknown[];
    tiers_mode: string | null;
    transform_usage: unknown | null;
    trial_period_days: number | null;
    usage_type: 'licensed' | 'metered';
  };
  price: {
    id: string;
    object: 'price';
    active: boolean;
    billing_scheme: string;
    created: number;
    currency: string;
    custom_unit_amount: unknown | null;
    livemode: boolean;
    lookup_key: string | null;
    metadata: Record<string, string>;
    nickname: string | null;
    product: string;
    recurring: {
      aggregate_usage: string | null;
      interval: 'day' | 'week' | 'month' | 'year';
      interval_count: number;
      trial_period_days: number | null;
      usage_type: 'licensed' | 'metered';
    };
    tax_behavior: string;
    tiers_mode: string | null;
    transform_quantity: unknown | null;
    type: 'recurring' | 'one_time';
    unit_amount: number;
    unit_amount_decimal: string;
  };
  quantity: number;
  subscription: string;
  tax_rates: unknown[];
}

/**
 * Subscription data structure
 */
export interface SubscriptionData {
  id: string;
  object: 'subscription';
  application_fee_percent: number | null;
  automatic_tax: {
    enabled: boolean;
    liability: unknown | null;
  };
  billing_cycle_anchor: number;
  billing_thresholds: unknown | null;
  cancel_at: number | null;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  cancellation_details: {
    comment: string | null;
    feedback: string | null;
    reason: string | null;
  };
  collection_method: 'charge_automatically' | 'send_invoice';
  created: number;
  currency: string;
  current_period_end: number;
  current_period_start: number;
  customer: string;
  days_until_due: number | null;
  default_payment_method: string | null;
  default_tax_rates: unknown[];
  description: string | null;
  discounts: unknown[];
  ended_at: number | null;
  items: {
    object: 'list';
    data: SubscriptionItem[];
    has_more: boolean;
    url: string;
  };
  latest_invoice: string | {
    id: string;
    object: 'invoice';
    payment_intent?: PaymentIntentData;
  };
  livemode: boolean;
  metadata: Record<string, string>;
  next_pending_invoice_item_invoice: number | null;
  on_behalf_of: string | null;
  pause_collection: unknown | null;
  payment_settings: {
    application_fee_amount: number | null;
    automatic_payment_methods: {
      enabled: boolean;
    } | null;
    default_mandate: string | null;
    default_payment_method: string | null;
    payment_method_options: unknown | null;
    payment_method_types: string[] | null;
  };
  pending_invoice_item_interval: unknown | null;
  pending_setup_intent: string | null;
  pending_update: unknown | null;
  plan: {
    id: string;
    object: 'plan';
    active: boolean;
    aggregate_usage: string | null;
    amount: number;
    billing_scheme: string;
    created: number;
    currency: string;
    interval: 'day' | 'week' | 'month' | 'year';
    interval_count: number;
    livemode: boolean;
    metadata: Record<string, string>;
    nickname: string | null;
    product: string;
    tiers: unknown[];
    tiers_mode: string | null;
    transform_usage: unknown | null;
    trial_period_days: number | null;
    usage_type: 'licensed' | 'metered';
  };
  quantity: number;
  schedule: string | null;
  start_date: number;
  status: SubscriptionStatus;
  test_clock: string | null;
  transfer_data: unknown | null;
  trial_end: number | null;
  trial_settings: {
    end_behavior: {
      missing_payment_method: 'cancel' | 'create_invoice' | 'pause';
    };
  };
  trial_start: number | null;
}

// ============================================================================
// Invoice Data Types
// ============================================================================

/**
 * Invoice status
 */
export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'uncollectible'
  | 'void';

/**
 * Invoice data structure
 */
export interface InvoiceData {
  id: string;
  object: 'invoice';
  account_country: string;
  account_name: string | null;
  account_tax_ids: unknown | null;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  amount_shipping: number;
  application: string | null;
  application_fee_amount: number | null;
  attempt_count: number;
  attempted: boolean;
  auto_advance: boolean;
  automatic_tax: {
    enabled: boolean;
    liability: unknown | null;
    status: string | null;
  };
  billing_reason: string | null;
  charge: string | null;
  collection_method: 'charge_automatically' | 'send_invoice';
  created: number;
  currency: string;
  custom_fields: unknown | null;
  customer: string;
  customer_address: unknown | null;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_shipping: unknown | null;
  customer_tax_exempt: string | null;
  customer_tax_ids: unknown[];
  default_payment_method: string | null;
  default_tax_rates: unknown[];
  description: string | null;
  discount: unknown | null;
  discounts: unknown[];
  due_date: number | null;
  ending_balance: number;
  footer: string | null;
  from_invoice: unknown | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  last_finalization_error: unknown | null;
  latest_revision: string | null;
  lines: {
    object: 'list';
    data: unknown[];
    has_more: boolean;
    total_count: number;
    url: string;
  };
  livemode: boolean;
  metadata: Record<string, string>;
  next_payment_attempt: number | null;
  number: string | null;
  on_behalf_of: string | null;
  paid: boolean;
  paid_out_of_band: boolean;
  payment_intent: string | PaymentIntentData | null;
  payment_settings: {
    default_mandate: string | null;
    default_payment_method: string | null;
    payment_method_options: unknown | null;
    payment_method_types: string[] | null;
  };
  period_end: number;
  period_start: number;
  post_payment_credit_notes_amount: number;
  pre_payment_credit_notes_amount: number;
  quote: string | null;
  receipt_number: string | null;
  rendering: unknown | null;
  shipping_cost: unknown | null;
  shipping_details: unknown | null;
  starting_balance: number;
  statement_descriptor: string | null;
  status: InvoiceStatus;
  status_transitions: {
    finalized_at: number | null;
    marked_uncollectible_at: number | null;
    paid_at: number | null;
    voided_at: number | null;
  };
  subscription: string | null;
  subtotal: number;
  subtotal_excluding_tax: number | null;
  tax: number | null;
  test_clock: string | null;
  total: number;
  total_discount_amounts: unknown[];
  total_excluding_tax: number;
  total_tax_amounts: unknown[];
  transfer_data: unknown | null;
  webhooks_delivered_at: number | null;
}

// ============================================================================
// Customer Data Types
// ============================================================================

/**
 * Customer data structure
 */
export interface CustomerData {
  id: string;
  object: 'customer';
  address: {
    city: string | null;
    country: string | null;
    line1: string | null;
    line2: string | null;
    postal_code: string | null;
    state: string | null;
  } | null;
  balance: number;
  created: number;
  currency: string | null;
  default_source: string | null;
  delinquent: boolean;
  description: string | null;
  discount: unknown | null;
  email: string | null;
  invoice_prefix: string;
  invoice_settings: {
    custom_fields: unknown | null;
    default_payment_method: string | null;
    footer: string | null;
    rendering_options: unknown | null;
  };
  livemode: boolean;
  metadata: Record<string, string>;
  name: string | null;
  next_invoice_sequence: number;
  phone: string | null;
  preferred_locales: string[];
  shipping: {
    address: {
      city: string | null;
      country: string | null;
      line1: string | null;
      line2: string | null;
      postal_code: string | null;
      state: string | null;
    };
    name: string;
    phone: string | null;
  } | null;
  tax_exempt: 'none' | 'exempt' | 'reverse';
  test_clock: string | null;
}

// ============================================================================
// Dispute Data Types
// ============================================================================

/**
 * Dispute status
 */
export type DisputeStatus =
  | 'warning_needs_response'
  | 'warning_under_review'
  | 'warning_closed'
  | 'needs_response'
  | 'under_review'
  | 'charge_refunded'
  | 'won'
  | 'lost';

/**
 * Dispute data structure
 */
export interface DisputeData {
  id: string;
  object: 'dispute';
  amount: number;
  balance_transactions: string[];
  charge: string;
  created: number;
  currency: string;
  evidence: {
    access_activity_log: string | null;
    billing_address: string | null;
    cancellation_policy: string | null;
    cancellation_policy_disclosure: string | null;
    cancellation_rebuttal: string | null;
    customer_communication: string | null;
    customer_email_address: string | null;
    customer_name: string | null;
    customer_purchase_ip: string | null;
    customer_signature: string | null;
    duplicate_charge_documentation: string | null;
    duplicate_charge_explanation: string | null;
    duplicate_charge_id: string | null;
    product_description: string | null;
    receipt: string | null;
    refund_policy: string | null;
    refund_policy_disclosure: string | null;
    refund_refusal_explanation: string | null;
    service_date: string | null;
    service_documentation: string | null;
    shipping_address: string | null;
    shipping_carrier: string | null;
    shipping_date: string | null;
    shipping_documentation: string | null;
    shipping_tracking_number: string | null;
    uncategorized_file: string | null;
    uncategorized_text: string | null;
  };
  evidence_details: {
    due_by: number;
    has_evidence: boolean;
    past_due: boolean;
    submission_count: number;
  };
  is_charge_refundable: boolean;
  livemode: boolean;
  metadata: Record<string, string>;
  payment_intent: string | null;
  reason: 'duplicate' | 'fraudulent' | 'subscription_canceled' | 'product_unacceptable' | 'product_not_received' | 'unrecognized' | 'credit_not_processed' | 'customer_initiated' | 'debit_not_authorized' | 'general';
  status: DisputeStatus;
}

// ============================================================================
// Connect Account Data Types
// ============================================================================

/**
 * Connect account data structure
 */
export interface AccountData {
  id: string;
  object: 'account';
  business_profile: {
    mcc: string | null;
    name: string | null;
    product_description: string | null;
    support_address: unknown | null;
    support_email: string | null;
    support_phone: string | null;
    support_url: string | null;
    url: string | null;
  };
  capabilities: Record<string, 'active' | 'inactive' | 'pending'>;
  charges_enabled: boolean;
  controller: {
    type: 'application' | 'account' | 'stripe';
    is_controller?: boolean;
    application?: {
      loss_liable: boolean;
      onboarding_owner: boolean;
      pricing_controls: boolean;
      fees: {
        payer: 'account' | 'application' | 'application_express';
      };
      stripe_dashboard: {
        type: 'full' | 'express' | 'none';
      };
    };
  };
  country: string;
  created: number;
  default_currency: string;
  details_submitted: boolean;
  email: string | null;
  external_accounts: {
    object: 'list';
    data: unknown[];
    has_more: boolean;
    total_count: number;
    url: string;
  };
  future_requirements: {
    alternatives: unknown[];
    current_deadline: number | null;
    currently_due: string[];
    disabled_reason: string | null;
    errors: unknown[];
    eventually_due: string[];
    past_due: string[];
    pending_verification: string[];
  };
  metadata: Record<string, string>;
  payouts_enabled: boolean;
  requirements: {
    alternatives: unknown[];
    current_deadline: number | null;
    currently_due: string[];
    disabled_reason: string | null;
    errors: unknown[];
    eventually_due: string[];
    past_due: string[];
    pending_verification: string[];
  };
  settings: {
    bacs_debit_payments: {
      display_name: string | null;
      service_user_number: string | null;
    };
    branding: {
      icon: string | null;
      logo: string | null;
      primary_color: string | null;
      secondary_color: string | null;
    };
    card_issuing: {
      tos_acceptance: {
        date: number | null;
        ip: string | null;
      };
    };
    card_payments: {
      decline_on: {
        avs_failure: boolean;
        cvc_failure: boolean;
      };
      statement_descriptor_prefix: string | null;
      statement_descriptor_prefix_kanji: string | null;
      statement_descriptor_prefix_kana: string | null;
    };
    dashboard: {
      display_name: string | null;
      timezone: string;
    };
    payments: {
      statement_descriptor: string | null;
      statement_descriptor_kanji: string | null;
      statement_descriptor_kana: string | null;
    };
    payouts: {
      debit_negative_balances: boolean;
      schedule: {
        delay_days: number;
        interval: 'manual' | 'daily' | 'weekly' | 'monthly' | 'custom';
        monthly_anchor?: number;
        weekly_anchor?: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
      };
      statement_descriptor: string | null;
    };
    sepa_debit_payments: {
      creditor_id: string | null;
    };
  };
  tos_acceptance: {
    date: number | null;
    ip: string | null;
    user_agent: string | null;
  };
  type: 'standard' | 'express' | 'custom';
}

// ============================================================================
// Event Type Unions
// ============================================================================

/**
 * Payment intent event types
 */
export type PaymentIntentEventType =
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.requires_action'
  | 'payment_intent.created'
  | 'payment_intent.canceled';

/**
 * Setup intent event types
 */
export type SetupIntentEventType =
  | 'setup_intent.succeeded'
  | 'setup_intent.setup_failed'
  | 'setup_intent.created'
  | 'setup_intent.canceled';

/**
 * Subscription event types
 */
export type SubscriptionEventType =
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.subscription.paused'
  | 'customer.subscription.resumed'
  | 'customer.subscription.trial_will_end';

/**
 * Invoice event types
 */
export type InvoiceEventType =
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'invoice.created'
  | 'invoice.finalized'
  | 'invoice.voided'
  | 'invoice.marked_uncollectible';

/**
 * Customer event types
 */
export type CustomerEventType =
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | 'customer.source.created'
  | 'customer.source.updated'
  | 'customer.source.deleted';

/**
 * Dispute event types
 */
export type DisputeEventType =
  | 'charge.dispute.created'
  | 'charge.dispute.updated'
  | 'charge.dispute.closed'
  | 'charge.dispute.funds_withdrawn'
  | 'charge.dispute.funds_reinstated';

/**
 * Connect account event types
 */
export type AccountEventType =
  | 'account.updated'
  | 'account.application.authorized'
  | 'account.application.deauthorized';

// ============================================================================
// Specific Event Interfaces
// ============================================================================

/**
 * Payment intent succeeded event
 */
export interface PaymentIntentSucceededEvent extends StripeWebhookEventTyped<PaymentIntentData> {
  type: 'payment_intent.succeeded';
}

/**
 * Payment intent failed event
 */
export interface PaymentIntentFailedEvent extends StripeWebhookEventTyped<PaymentIntentData> {
  type: 'payment_intent.payment_failed';
}

/**
 * Payment intent requires action event
 */
export interface PaymentIntentRequiresActionEvent extends StripeWebhookEventTyped<PaymentIntentData> {
  type: 'payment_intent.requires_action';
}

/**
 * Setup intent succeeded event
 */
export interface SetupIntentSucceededEvent extends StripeWebhookEventTyped<SetupIntentData> {
  type: 'setup_intent.succeeded';
}

/**
 * Setup intent failed event
 */
export interface SetupIntentFailedEvent extends StripeWebhookEventTyped<SetupIntentData> {
  type: 'setup_intent.setup_failed';
}

/**
 * Subscription created event
 */
export interface SubscriptionCreatedEvent extends StripeWebhookEventTyped<SubscriptionData> {
  type: 'customer.subscription.created';
}

/**
 * Subscription updated event
 */
export interface SubscriptionUpdatedEvent extends StripeWebhookEventTyped<SubscriptionData> {
  type: 'customer.subscription.updated';
}

/**
 * Subscription deleted event
 */
export interface SubscriptionDeletedEvent extends StripeWebhookEventTyped<SubscriptionData> {
  type: 'customer.subscription.deleted';
}

/**
 * Invoice paid event
 */
export interface InvoicePaidEvent extends StripeWebhookEventTyped<InvoiceData> {
  type: 'invoice.paid';
}

/**
 * Invoice payment failed event
 */
export interface InvoicePaymentFailedEvent extends StripeWebhookEventTyped<InvoiceData> {
  type: 'invoice.payment_failed';
}

/**
 * Customer updated event
 */
export interface CustomerUpdatedEvent extends StripeWebhookEventTyped<CustomerData> {
  type: 'customer.updated';
}

/**
 * Dispute created event
 */
export interface DisputeCreatedEvent extends StripeWebhookEventTyped<DisputeData> {
  type: 'charge.dispute.created';
}

/**
 * Dispute updated event
 */
export interface DisputeUpdatedEvent extends StripeWebhookEventTyped<DisputeData> {
  type: 'charge.dispute.updated';
}

/**
 * Account updated event
 */
export interface AccountUpdatedEvent extends StripeWebhookEventTyped<AccountData> {
  type: 'account.updated';
}

// ============================================================================
// Union Types for Event Handling
// ============================================================================

/**
 * All payment intent events
 */
export type PaymentIntentEvents =
  | PaymentIntentSucceededEvent
  | PaymentIntentFailedEvent
  | PaymentIntentRequiresActionEvent;

/**
 * All setup intent events
 */
export type SetupIntentEvents =
  | SetupIntentSucceededEvent
  | SetupIntentFailedEvent;

/**
 * All subscription events
 */
export type SubscriptionEvents =
  | SubscriptionCreatedEvent
  | SubscriptionUpdatedEvent
  | SubscriptionDeletedEvent;

/**
 * All invoice events
 */
export type InvoiceEvents =
  | InvoicePaidEvent
  | InvoicePaymentFailedEvent;

/**
 * All customer events
 */
export type CustomerEvents = CustomerUpdatedEvent;

/**
 * All dispute events
 */
export type DisputeEvents =
  | DisputeCreatedEvent
  | DisputeUpdatedEvent;

/**
 * All account events
 */
export type AccountEvents = AccountUpdatedEvent;

/**
 * Union of all typed webhook events
 */
export type TypedStripeWebhookEvent =
  | PaymentIntentEvents
  | SetupIntentEvents
  | SubscriptionEvents
  | InvoiceEvents
  | CustomerEvents
  | DisputeEvents
  | AccountEvents;

// ============================================================================
// Handler Types
// ============================================================================

/**
 * Generic webhook handler type
 */
export type WebhookHandler<T> = (event: T) => Promise<void>;

/**
 * Specific handler types for each event category
 */
export type PaymentIntentHandler = WebhookHandler<PaymentIntentEvents>;
export type SetupIntentHandler = WebhookHandler<SetupIntentEvents>;
export type SubscriptionHandler = WebhookHandler<SubscriptionEvents>;
export type InvoiceHandler = WebhookHandler<InvoiceEvents>;
export type CustomerHandler = WebhookHandler<CustomerEvents>;
export type DisputeHandler = WebhookHandler<DisputeEvents>;
export type AccountHandler = WebhookHandler<AccountEvents>;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Base Stripe event interface for type guards
 */
interface BaseStripeEvent {
  type: string;
}

/**
 * Type guard for payment intent events
 */
export function isPaymentIntentEvent(event: BaseStripeEvent): event is PaymentIntentEvents {
  return event.type.startsWith('payment_intent.');
}

/**
 * Type guard for setup intent events
 */
export function isSetupIntentEvent(event: BaseStripeEvent): event is SetupIntentEvents {
  return event.type.startsWith('setup_intent.');
}

/**
 * Type guard for subscription events
 */
export function isSubscriptionEvent(event: BaseStripeEvent): event is SubscriptionEvents {
  return event.type.startsWith('customer.subscription.');
}

/**
 * Type guard for invoice events
 */
export function isInvoiceEvent(event: BaseStripeEvent): event is InvoiceEvents {
  return event.type.startsWith('invoice.');
}

/**
 * Type guard for customer events
 */
export function isCustomerEvent(event: BaseStripeEvent): event is CustomerEvents {
  return event.type.startsWith('customer.');
}

/**
 * Type guard for dispute events
 */
export function isDisputeEvent(event: BaseStripeEvent): event is DisputeEvents {
  return event.type.startsWith('charge.dispute.');
}

/**
 * Type guard for account events
 */
export function isAccountEvent(event: BaseStripeEvent): event is AccountEvents {
  return event.type.startsWith('account.');
}
