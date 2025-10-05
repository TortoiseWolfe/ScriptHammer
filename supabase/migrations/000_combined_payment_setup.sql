-- Combined Payment System Migration
-- Purpose: Complete payment infrastructure setup for ScriptHammer
-- Created: 2025-10-04
-- Run this in Supabase SQL Editor: https://vswxgxbjodpgwfgsjrhq.supabase.co/project/_/sql

-- ============================================================================
-- Migration 001: Payment Intents Table
-- ============================================================================

CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_user_id UUID NOT NULL REFERENCES auth.users(id),
  amount INTEGER NOT NULL CHECK (amount >= 100 AND amount <= 99999),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency IN ('usd', 'eur', 'gbp', 'cad', 'aud')),
  type TEXT NOT NULL CHECK (type IN ('one_time', 'recurring')),
  interval TEXT CHECK (interval IN ('month', 'year') OR interval IS NULL),
  description TEXT,
  customer_email TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_payment_intents_customer_email ON payment_intents(customer_email);
CREATE INDEX idx_payment_intents_created_at ON payment_intents(created_at DESC);
CREATE INDEX idx_payment_intents_user_id ON payment_intents(template_user_id);
CREATE INDEX idx_payment_intents_expires_at ON payment_intents(expires_at);

COMMENT ON TABLE payment_intents IS 'Customer payment intentions before provider redirect (24hr expiry)';
COMMENT ON COLUMN payment_intents.amount IS 'Amount in cents ($1.00 = 100)';
COMMENT ON COLUMN payment_intents.expires_at IS 'Intent expires after 24 hours if not completed';

-- ============================================================================
-- Migration 002: Payment Results Table
-- ============================================================================

CREATE TABLE payment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal', 'cashapp', 'chime')),
  transaction_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  charged_amount INTEGER,
  charged_currency TEXT,
  provider_fee INTEGER,
  webhook_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_method TEXT CHECK (verification_method IN ('webhook', 'redirect') OR verification_method IS NULL),
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_results_intent_id ON payment_results(intent_id);
CREATE INDEX idx_payment_results_transaction_id ON payment_results(transaction_id);
CREATE INDEX idx_payment_results_status ON payment_results(status);
CREATE INDEX idx_payment_results_created_at ON payment_results(created_at DESC);

COMMENT ON TABLE payment_results IS 'Outcome of payment attempts with webhook verification status';
COMMENT ON COLUMN payment_results.webhook_verified IS 'True if confirmed via webhook (most reliable)';
COMMENT ON COLUMN payment_results.verification_method IS 'How payment was confirmed: webhook (reliable) or redirect (less reliable)';

-- ============================================================================
-- Migration 003: Subscriptions Table
-- ============================================================================

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  provider_subscription_id TEXT NOT NULL UNIQUE,
  customer_email TEXT NOT NULL,
  plan_amount INTEGER NOT NULL CHECK (plan_amount >= 100),
  plan_interval TEXT NOT NULL CHECK (plan_interval IN ('month', 'year')),
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'grace_period', 'canceled', 'expired')),
  current_period_start TEXT,
  current_period_end TEXT,
  next_billing_date TEXT,
  failed_payment_count INTEGER NOT NULL DEFAULT 0,
  retry_schedule JSONB DEFAULT '{"day_1": false, "day_3": false, "day_7": false}'::jsonb,
  grace_period_expires TEXT,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_customer_email ON subscriptions(customer_email);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_next_billing_date ON subscriptions(next_billing_date) WHERE status = 'active';
CREATE UNIQUE INDEX idx_subscriptions_provider_id ON subscriptions(provider, provider_subscription_id);

COMMENT ON TABLE subscriptions IS 'Recurring payment subscriptions (monthly/yearly)';
COMMENT ON COLUMN subscriptions.retry_schedule IS 'Tracks retry attempts: day_1, day_3, day_7 after failure';
COMMENT ON COLUMN subscriptions.grace_period_expires IS 'Date when subscription will be canceled if payment still fails';

-- ============================================================================
-- Migration 004: Payment Provider Configuration Table
-- ============================================================================

CREATE TABLE payment_provider_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal', 'cashapp', 'chime')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config_status TEXT NOT NULL DEFAULT 'not_configured' CHECK (config_status IN ('not_configured', 'configured', 'invalid')),
  priority INTEGER NOT NULL DEFAULT 0,
  features JSONB DEFAULT '{"one_time": false, "recurring": false, "requires_consent": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider)
);

CREATE INDEX idx_provider_config_enabled ON payment_provider_config(enabled, priority DESC);

COMMENT ON TABLE payment_provider_config IS 'Payment provider settings and failover configuration';
COMMENT ON COLUMN payment_provider_config.priority IS 'Higher priority providers are tried first for failover';

-- ============================================================================
-- Migration 007: Webhook Events Table
-- ============================================================================

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  signature TEXT NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processing_attempts INTEGER NOT NULL DEFAULT 0,
  processing_error TEXT,
  related_payment_id UUID REFERENCES payment_results(id),
  related_subscription_id UUID REFERENCES subscriptions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_webhook_events_provider_event_id ON webhook_events(provider, provider_event_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed, created_at DESC);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);

COMMENT ON TABLE webhook_events IS 'Webhook notifications from payment providers with idempotency protection';
COMMENT ON INDEX idx_webhook_events_provider_event_id IS 'Prevents duplicate webhook processing (idempotency)';

-- ============================================================================
-- Migration 008: Row Level Security Policies
-- ============================================================================

-- Enable RLS on all payment tables
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_provider_config ENABLE ROW LEVEL SECURITY;

-- Payment Intents: Users can view and create own intents
CREATE POLICY "Users view own payment intents" ON payment_intents
  FOR SELECT USING (auth.uid() = template_user_id);

CREATE POLICY "Users create own payment intents" ON payment_intents
  FOR INSERT WITH CHECK (auth.uid() = template_user_id);

-- Payment Results: Users can only view (Edge Functions create/update)
CREATE POLICY "Users view own payment results" ON payment_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM payment_intents
      WHERE payment_intents.id = payment_results.intent_id
      AND payment_intents.template_user_id = auth.uid()
    )
  );

-- Subscriptions: Users can view and cancel own subscriptions
CREATE POLICY "Users view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = template_user_id);

CREATE POLICY "Users update own subscriptions" ON subscriptions
  FOR UPDATE USING (auth.uid() = template_user_id);

-- Webhook Events: Users can view events related to their payments
CREATE POLICY "Users view related webhook events" ON webhook_events
  FOR SELECT USING (
    related_payment_id IN (
      SELECT pr.id FROM payment_results pr
      JOIN payment_intents pi ON pr.intent_id = pi.id
      WHERE pi.template_user_id = auth.uid()
    )
    OR
    related_subscription_id IN (
      SELECT id FROM subscriptions
      WHERE template_user_id = auth.uid()
    )
  );

-- Payment Provider Config: Read-only for all users
CREATE POLICY "Users view provider config" ON payment_provider_config
  FOR SELECT USING (true);

COMMENT ON POLICY "Users view own payment intents" ON payment_intents IS 'RLS: Users can only see their own payment intents';
COMMENT ON POLICY "Users view own payment results" ON payment_results IS 'RLS: Users can only see results from their own intents';
