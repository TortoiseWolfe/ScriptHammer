-- Migration: Webhook Events Table
-- Purpose: Store webhook notifications from payment providers (idempotency + audit)
-- Created: 2025-10-03

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
