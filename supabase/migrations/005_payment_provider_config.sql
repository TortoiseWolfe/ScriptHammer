-- Migration: Payment Provider Configuration Table
-- Purpose: Store enabled payment providers and their configuration status
-- Created: 2025-10-03

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
