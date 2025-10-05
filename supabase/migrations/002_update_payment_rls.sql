-- =========================================
-- Migration: Update Payment RLS Policies
-- Feature: PRP-016 User Authentication
-- Created: 2025-10-05
-- =========================================
-- Purpose: Replace demo RLS policies with real auth-based policies
-- This migration integrates authentication with the existing payment system

-- =========================================
-- UPDATE: payment_intents RLS policies
-- =========================================

-- Remove old demo policies
DROP POLICY IF EXISTS "Demo users view payments" ON payment_intents;
DROP POLICY IF EXISTS "Demo users create payments" ON payment_intents;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON payment_intents;
DROP POLICY IF EXISTS "Enable read access for all users" ON payment_intents;

-- Create new auth-based policies
-- Users can only view their own payment intents
CREATE POLICY "Users view own payments" ON payment_intents
  FOR SELECT
  USING (auth.uid() = template_user_id);

-- Users can only create payment intents for themselves
CREATE POLICY "Users create own payments" ON payment_intents
  FOR INSERT
  WITH CHECK (auth.uid() = template_user_id);

-- Users can only update their own payment intents
CREATE POLICY "Users update own payments" ON payment_intents
  FOR UPDATE
  USING (auth.uid() = template_user_id);

-- =========================================
-- UPDATE: payment_results RLS policies
-- =========================================

-- Remove old demo policies
DROP POLICY IF EXISTS "Demo users view results" ON payment_results;
DROP POLICY IF EXISTS "Enable read access for all users" ON payment_results;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON payment_results;

-- Create new auth-based policies
-- Users can only view payment results for their own payment intents
CREATE POLICY "Users view own results" ON payment_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payment_intents
      WHERE payment_intents.id = payment_results.intent_id
      AND payment_intents.template_user_id = auth.uid()
    )
  );

-- Service role can insert payment results (webhook handling)
CREATE POLICY "Service creates results" ON payment_results
  FOR INSERT
  WITH CHECK (true);

-- =========================================
-- UPDATE: subscriptions RLS policies
-- =========================================

-- Remove old demo policies (if any)
DROP POLICY IF EXISTS "Demo users view subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Enable read access for all users" ON subscriptions;

-- Create new auth-based policies
-- Users can only view their own subscriptions
CREATE POLICY "Users view own subscriptions" ON subscriptions
  FOR SELECT
  USING (auth.uid() = template_user_id);

-- Users can only create subscriptions for themselves
CREATE POLICY "Users create own subscriptions" ON subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = template_user_id);

-- Users can update their own subscriptions (cancel, etc.)
CREATE POLICY "Users update own subscriptions" ON subscriptions
  FOR UPDATE
  USING (auth.uid() = template_user_id);

-- =========================================
-- UPDATE: webhook_events RLS policies
-- =========================================

-- Remove old demo policies (if any)
DROP POLICY IF EXISTS "Enable read access for all users" ON webhook_events;

-- Webhook events are internal - only service role can access
-- Users don't need direct access to webhook events

-- Service role can insert webhook events
CREATE POLICY "Service creates webhook events" ON webhook_events
  FOR INSERT
  WITH CHECK (true);

-- Service role can update webhook events (processing status)
CREATE POLICY "Service updates webhook events" ON webhook_events
  FOR UPDATE
  WITH CHECK (true);

-- =========================================
-- COMMENTS: Documentation
-- =========================================

COMMENT ON POLICY "Users view own payments" ON payment_intents IS 'Users can only view their own payment intents based on auth.uid()';
COMMENT ON POLICY "Users create own payments" ON payment_intents IS 'Users can only create payment intents for themselves';
COMMENT ON POLICY "Users view own results" ON payment_results IS 'Users can only view results for their own payment intents';
COMMENT ON POLICY "Service creates results" ON payment_results IS 'Service role creates payment results from webhook handlers';
COMMENT ON POLICY "Users view own subscriptions" ON subscriptions IS 'Users can only view their own subscriptions';
COMMENT ON POLICY "Service creates webhook events" ON webhook_events IS 'Service role handles webhook event storage';

-- =========================================
-- MIGRATION COMPLETE
-- =========================================
-- Payment system now requires authentication
-- Hardcoded demo user ID (00000000-0000-0000-0000-000000000000) no longer works
-- Users must sign in to create payments and view their history
