/**
 * Payment Integration Type Definitions
 * Based on specs/015-payment-integration/data-model.md
 */

// ============================================================================
// Payment Providers
// ============================================================================

export type PaymentProvider = 'stripe' | 'paypal' | 'cashapp' | 'chime';

export type PaymentType = 'one_time' | 'recurring';

export type PaymentInterval = 'month' | 'year';

export type Currency = 'usd' | 'eur' | 'gbp' | 'cad' | 'aud';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'grace_period'
  | 'canceled'
  | 'expired';

// ============================================================================
// Payment Intent
// ============================================================================

export interface PaymentIntent {
  id: string; // UUID
  template_user_id: string; // UUID
  amount: number; // Cents (100-99999)
  currency: Currency;
  type: PaymentType;
  interval: PaymentInterval | null;
  customer_email: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string; // ISO 8601 timestamp
  expires_at: string; // ISO 8601 timestamp
}

export interface CreatePaymentIntentInput {
  amount: number;
  currency: Currency;
  type: PaymentType;
  interval?: PaymentInterval;
  customer_email: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Payment Result
// ============================================================================

export interface PaymentResult {
  id: string; // UUID
  intent_id: string; // UUID -> payment_intents.id
  provider: PaymentProvider;
  transaction_id: string; // Provider's transaction ID
  status: PaymentStatus;
  charged_amount: number; // Cents
  charged_currency: Currency;
  provider_fee: number | null; // Cents
  webhook_verified: boolean;
  verification_method: 'webhook' | 'redirect' | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

// ============================================================================
// Webhook Event
// ============================================================================

export interface WebhookEvent {
  id: string; // UUID
  provider: PaymentProvider;
  provider_event_id: string; // Unique per provider (for idempotency)
  event_type: string; // e.g., 'payment_intent.succeeded'
  event_data: Record<string, unknown>; // Raw JSON from provider
  signature: string; // HMAC signature from provider
  signature_verified: boolean;
  processed: boolean;
  processing_attempts: number;
  processing_error: string | null;
  related_payment_id: string | null; // UUID -> payment_results.id
  related_subscription_id: string | null; // UUID -> subscriptions.id
  created_at: string; // ISO 8601 timestamp
  processed_at: string | null; // ISO 8601 timestamp
}

// ============================================================================
// Subscription
// ============================================================================

export interface Subscription {
  id: string; // UUID
  template_user_id: string; // UUID
  provider: 'stripe' | 'paypal'; // Cash App/Chime don't support subscriptions
  provider_subscription_id: string; // Provider's subscription ID
  customer_email: string;
  plan_amount: number; // Cents
  plan_interval: PaymentInterval;
  status: SubscriptionStatus;
  current_period_start: string; // ISO 8601 date
  current_period_end: string; // ISO 8601 date
  next_billing_date: string | null; // ISO 8601 date
  failed_payment_count: number;
  retry_schedule: {
    day_1: boolean;
    day_3: boolean;
    day_7: boolean;
  };
  grace_period_expires: string | null; // ISO 8601 date
  canceled_at: string | null; // ISO 8601 timestamp
  cancellation_reason: string | null;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

export interface CreateSubscriptionInput {
  plan_amount: number;
  plan_interval: PaymentInterval;
  customer_email: string;
}

// ============================================================================
// Payment Provider Configuration
// ============================================================================

export interface PaymentProviderConfig {
  id: string; // UUID
  provider: PaymentProvider;
  enabled: boolean;
  config_status: 'not_configured' | 'configured' | 'invalid';
  priority: number; // For failover order
  features: {
    one_time: boolean;
    recurring: boolean;
    requires_consent: boolean; // GDPR - loads external scripts
  };
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

// ============================================================================
// Client-Side Types
// ============================================================================

export interface ConsentPreferences {
  payment_consent: 'granted' | 'declined' | null;
  consent_date: string | null; // ISO 8601 timestamp
}

export interface OfflineQueueItem {
  id?: number; // IndexedDB auto-increment
  type: 'create_payment_intent' | 'update_payment_result';
  payload: unknown;
  created_at: string; // ISO 8601 timestamp
  retry_count: number;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface PaymentActivity {
  id: string;
  provider: PaymentProvider;
  transaction_id: string;
  status: PaymentStatus;
  charged_amount: number;
  charged_currency: Currency;
  customer_email: string;
  webhook_verified: boolean;
  created_at: string;
}

export interface PaymentStatsResponse {
  total_payments: number;
  successful_payments: number;
  failed_payments: number;
  total_revenue: number; // Cents
  revenue_by_currency: Record<Currency, number>;
  revenue_by_provider: Record<PaymentProvider, number>;
  active_subscriptions: number;
}

// ============================================================================
// Error Types
// ============================================================================

export interface PaymentError {
  code: string;
  message: string;
  provider?: PaymentProvider;
  retryable: boolean;
}

export class PaymentIntegrationError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: PaymentProvider,
    public retryable = false
  ) {
    super(message);
    this.name = 'PaymentIntegrationError';
  }
}
