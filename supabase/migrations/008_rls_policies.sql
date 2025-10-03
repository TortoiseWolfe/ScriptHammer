-- Migration: Row Level Security Policies
-- Purpose: Ensure template users can only access their own payment data
-- Created: 2025-10-03

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
