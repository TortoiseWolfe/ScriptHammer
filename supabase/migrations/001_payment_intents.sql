-- Migration: Payment Intents Table
-- Purpose: Store customer payment intentions before provider redirect
-- Created: 2025-10-03

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
CREATE INDEX idx_payment_intents_expires_at ON payment_intents(expires_at) ;

COMMENT ON TABLE payment_intents IS 'Customer payment intentions before provider redirect (24hr expiry)';
COMMENT ON COLUMN payment_intents.amount IS 'Amount in cents ($1.00 = 100)';
COMMENT ON COLUMN payment_intents.expires_at IS 'Intent expires after 24 hours if not completed';
