-- Migration: Subscriptions Table
-- Purpose: Track recurring payment agreements (monthly/yearly)
-- Created: 2025-10-03

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
