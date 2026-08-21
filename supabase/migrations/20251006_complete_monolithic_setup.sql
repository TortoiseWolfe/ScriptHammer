-- ============================================================================
-- COMPLETE MONOLITHIC SETUP
-- Everything in one file: Payment + Auth + Security
-- ============================================================================
-- Purpose: Single migration to create entire database from scratch
-- Created: 2025-10-06
--
-- This migration includes:
-- - Payment System (PRP-015)
-- - User Authentication (PRP-016)
-- - Security Hardening (Feature 017)
--   - Rate limiting (brute force protection)
--   - OAuth CSRF protection
--   - Row Level Security (RLS)
--   - Audit logging
--   - Webhook retry
-- ============================================================================

-- Clean up any existing test user BEFORE transaction
-- (auth.users changes can't be rolled back, so do this first)
--
-- GUARDED, BECAUSE THIS IS THE FIRST STATEMENT AND IT USED TO ABORT EVERYTHING.
-- `auth.users` is owned by `supabase_auth_admin` on Supabase Cloud, and the
-- `postgres` role the Management API connects as has no DELETE on it. So this
-- line raised `42501: permission denied for schema auth` before the transaction
-- below even opened — the whole file applied nothing, and the error named the
-- schema rather than the statement, which sent the search to the auth.users
-- TRIGGER further down instead of here (#567 org migration).
--
-- The delete is convenience for re-running against a stack that already has a
-- seeded test user. It is not required for a fresh project, so failing to
-- perform it must not stop the schema from being created.
DO $cleanup_test_user$
BEGIN
  DELETE FROM auth.users WHERE email = 'test@example.com';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'skipping test-user cleanup: no DELETE on auth.users (expected on Supabase Cloud)';
END
$cleanup_test_user$;

-- Wrap everything in a transaction - all or nothing
BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PART 1: PAYMENT SYSTEM TABLES
-- ============================================================================

-- Payment intents (24hr expiry)
CREATE TABLE IF NOT EXISTS payment_intents (
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

CREATE INDEX IF NOT EXISTS idx_payment_intents_customer_email ON payment_intents(customer_email);
CREATE INDEX IF NOT EXISTS idx_payment_intents_created_at ON payment_intents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_user_id ON payment_intents(template_user_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_expires_at ON payment_intents(expires_at);

-- Idempotency key for offline-queue retries (#52). Partial unique index:
-- only enforced when set, so direct-server INSERTs (admin tooling, edge
-- functions) without a key remain valid. Only client-queued INSERTs
-- participate in dedupe.
ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_idempotency_key
  ON payment_intents(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Retry tracking (#43, B1). Each retry creates a new INSERT-only row that
-- references its parent and bumps retry_count. The "Payment intents are
-- immutable" UPDATE policy below ensures retry_count only ever moves
-- forward (set on INSERT, never UPDATEd).
ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS parent_intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_intents_parent
  ON payment_intents(parent_intent_id)
  WHERE parent_intent_id IS NOT NULL;

COMMENT ON TABLE payment_intents IS 'Customer payment intentions before provider redirect (24hr expiry)';

-- Payment results
CREATE TABLE IF NOT EXISTS payment_results (
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

CREATE INDEX IF NOT EXISTS idx_payment_results_intent_id ON payment_results(intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_results_transaction_id ON payment_results(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_results_status ON payment_results(status);
CREATE INDEX IF NOT EXISTS idx_payment_results_created_at ON payment_results(created_at DESC);

-- #239: defense-in-depth against double-counting a single payment. Each
-- payment_intent may yield AT MOST ONE 'succeeded' result. Previously the
-- PayPal redirect-capture and the out-of-band webhook each wrote their own
-- 'succeeded' row (keyed on different transaction_ids — order id vs capture id),
-- inflating admin revenue. The paypal-webhook handler now reconciles onto the
-- existing row, but this partial unique index makes a regression impossible: a
-- second 'succeeded' INSERT for the same intent hits 23505 instead of silently
-- duplicating. Partial (WHERE status='succeeded') so pending/failed rows and
-- retries via a NEW intent are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_results_one_succeeded_per_intent
  ON payment_results(intent_id)
  WHERE status = 'succeeded';

COMMENT ON TABLE payment_results IS 'Outcome of payment attempts with webhook verification';

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  provider_subscription_id TEXT NOT NULL UNIQUE,
  customer_email TEXT NOT NULL,
  plan_amount INTEGER NOT NULL CHECK (plan_amount >= 100),
  plan_interval TEXT NOT NULL CHECK (plan_interval IN ('month', 'year')),
  -- #242: 'canceling' = user canceled-at-period-end but the sub is STILL LIVE at
  -- the provider through the paid period. It counts as live (see the one-live
  -- partial index below) so a second subscription can't be started during the
  -- window; the terminal provider event flips it to 'canceled' at period end.
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'grace_period', 'canceling', 'canceled', 'expired')),
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

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_email ON subscriptions(customer_email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing_date ON subscriptions(next_billing_date) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_provider_id ON subscriptions(provider, provider_subscription_id);

-- #242: idempotently extend the status CHECK to include 'canceling' on EXISTING
-- DBs (the CREATE TABLE IF NOT EXISTS above only applies the inline CHECK on a
-- fresh table). Mirrors the auth_audit_logs event_type extension pattern.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'past_due', 'grace_period', 'canceling', 'canceled', 'expired'));

-- Duplicate-subscription guard (#5): a user may hold at most ONE live
-- subscription at a time. Server-side root-cause enforcement — the webhook
-- upsert that would create a second live row hits this and is rejected (23505),
-- which the handlers catch and acknowledge gracefully. No trigger / SECURITY
-- DEFINER needed.
--
-- #242: 'canceling' is included in the live set. A cancel-at-period-end sub
-- (still active at the provider through the paid period) must keep occupying
-- the one-live slot, so a user can't start a SECOND subscription while the
-- first is still billing at the provider. Previously cancel wrote 'canceled'
-- immediately, dropping the row out of this index and letting a second sub slip
-- in. DROP + CREATE so the predicate change applies to existing DBs too.
DROP INDEX IF EXISTS idx_subscriptions_one_live_per_user;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_live_per_user
  ON subscriptions(template_user_id)
  WHERE status IN ('active', 'grace_period', 'past_due', 'canceling');

COMMENT ON TABLE subscriptions IS 'Recurring payment subscriptions';

-- Payment provider config
CREATE TABLE IF NOT EXISTS payment_provider_config (
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

CREATE INDEX IF NOT EXISTS idx_provider_config_enabled ON payment_provider_config(enabled, priority DESC);

COMMENT ON TABLE payment_provider_config IS 'Payment provider settings and failover';

-- Edge-function idempotency keys (#106). Lets outbound payment functions
-- dedupe retried operations (offline-queue replay, double-click, network
-- retry) by returning the previously-stored result instead of re-calling the
-- provider. Written/read only by service-role (the Edge Functions); not
-- client-facing. See supabase/functions/_shared/idempotency.ts.
CREATE TABLE IF NOT EXISTS edge_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,
  function_name TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idempotency_key, function_name)
);

CREATE INDEX IF NOT EXISTS idx_edge_idempotency_lookup
  ON edge_idempotency_keys(idempotency_key, function_name);

-- Fingerprint of the request that first used a key (#558). Without it, a client
-- that reuses one key across two different SKUs gets the FIRST order replayed
-- back silently — a wrong-product order with nothing to surface it. create-order
-- compares this and returns 409 on a mismatch, which is the rule Stripe applies:
-- a key is a promise about one request.
--
-- Nullable on purpose. Rows written before this column existed have no
-- fingerprint, and the safe reading of NULL is "cannot prove it was different",
-- so those replay rather than 409.
ALTER TABLE edge_idempotency_keys
  ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;

COMMENT ON TABLE edge_idempotency_keys IS 'Idempotency cache for outbound payment Edge Functions (#106)';

-- Webhook events (with retry fields from Feature 017)
CREATE TABLE IF NOT EXISTS webhook_events (
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
  processed_at TIMESTAMPTZ,
  -- Feature 017: Webhook retry fields
  next_retry_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  permanently_failed BOOLEAN NOT NULL DEFAULT FALSE,
  last_retry_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_event_id ON webhook_events(provider, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry ON webhook_events(next_retry_at, permanently_failed) WHERE processed = FALSE AND permanently_failed = FALSE;
CREATE INDEX IF NOT EXISTS idx_webhook_events_failed ON webhook_events(permanently_failed, created_at DESC) WHERE permanently_failed = TRUE;

COMMENT ON TABLE webhook_events IS 'Webhook notifications with idempotency and retry';

-- ----------------------------------------------------------------------------
-- COMMERCE CATALOG (Feature 050, Phase 1 — #557)
-- ----------------------------------------------------------------------------
--
-- The premise of this feature in one line: THE BUYER'S DEVICE STOPS BEING ABLE
-- TO NAME A PRICE. `products` is the only authority on what something costs;
-- create-order (#558) resolves from it and DISCARDS any amount in the request.
-- FR-002 says "discarded, not validated" deliberately — a validator that rejects
-- a mismatched amount leaks the real price and turns a silent server-authoritative
-- design into an oracle.

-- Raise the payment ceiling to $3,500 (T002).
--
-- THE CEILING IS A BLAST-RADIUS CONTROL, NOT A BUSINESS RULE, so it is set to the
-- most expensive thing actually sold (svc-site, $3,500) rather than to a round
-- number with room to spare. The PRD proposed $25,000; at that height a bug or a
-- compromised client could mint a charge seven times larger than anything real,
-- and nothing downstream would question it.
--
-- scripts/__tests__/payment-ceiling.test.js asserts this stays >= the priciest
-- active product, so adding a dearer SKU fails loudly instead of silently
-- creating one that cannot be sold.
--
-- THE INLINE CHECK AT payment_intents.amount IS NOT ENOUGH ON ITS OWN. That
-- constraint lives inside `CREATE TABLE IF NOT EXISTS`, so on an already
-- provisioned database (i.e. production) re-running this file does NOT change it
-- — editing the line above is a no-op there. The DROP + ADD below is what
-- actually moves it, the same idiom used at subscriptions_status_check and
-- auth_audit_logs_event_type_check for exactly this reason.
--
-- Two of the three business packages ($1,200 Landing Page, $3,500 Business Site)
-- sat above the old $999.99 ceiling, so the catalog advertised prices the system
-- could not charge.
ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_amount_check;
ALTER TABLE payment_intents ADD CONSTRAINT payment_intents_amount_check
  CHECK (amount >= 100 AND amount <= 350000);  -- $1.00 .. $3,500.00

-- subscriptions.plan_amount had a floor and NO ceiling at all, so the $999.99
-- limit never applied to subscriptions in the first place (T003).
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_amount_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_amount_check
  CHECK (plan_amount >= 100 AND plan_amount <= 350000);

-- Guest checkout: a buyer must be able to hold an intent without an account.
-- An anonymous Supabase session still yields a real auth.uid(), so every existing
-- RLS policy keeps working unmodified; this only stops requiring one.
ALTER TABLE payment_intents ALTER COLUMN template_user_id DROP NOT NULL;

-- Catalog. Seeded here, edited only by service_role or the admin panel.
CREATE TABLE IF NOT EXISTS products (
  id                TEXT PRIMARY KEY,                        -- 'svc-landing'
  lane              TEXT NOT NULL CHECK (lane IN ('service','product')),
  name              TEXT NOT NULL,
  tagline           TEXT,
  description       TEXT,
  -- Cents. For amount_mode='variable' this is the SUGGESTED default.
  amount            INTEGER NOT NULL CHECK (amount >= 0),
  amount_mode       TEXT NOT NULL DEFAULT 'fixed'
                      CHECK (amount_mode IN ('fixed','variable')),
  min_amount        INTEGER,
  max_amount        INTEGER,
  currency          TEXT NOT NULL DEFAULT 'usd'
                      CHECK (currency IN ('usd','eur','gbp','cad','aud')),
  type              TEXT NOT NULL CHECK (type IN ('one_time','recurring')),
  interval          TEXT CHECK (interval IN ('month','year') OR interval IS NULL),
  stripe_price_id   TEXT,
  paypal_plan_id    TEXT,
  features          JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Named, and added via DROP/ADD rather than inline, for the same reason as the
-- amount ceiling above: an inline constraint never reaches an existing database.
--
-- A variable SKU without bounds is an unbounded charge.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_variable_bounds_check;
ALTER TABLE products ADD CONSTRAINT products_variable_bounds_check
  CHECK (amount_mode = 'fixed'
         OR (min_amount IS NOT NULL AND max_amount IS NOT NULL
             AND min_amount <= max_amount));

-- A recurring SKU with no provider price is an unresolvable subscription.
--
-- DELIBERATE DEVIATION FROM PRD §6, which omits the `NOT active` clause. Without
-- it the three recurring SKUs cannot be seeded at all — we have no real Stripe
-- price ids yet, and the constraint would reject the INSERT outright. Seeding
-- obvious placeholder ids instead would satisfy the check while leaving a SKU
-- that looks sellable and is not, which is worse.
-- This version encodes the rule that actually matters: an ACTIVE recurring SKU
-- must have somewhere to bill. Inactive rows are catalog entries awaiting
-- configuration, and cannot be activated until they have one.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_recurring_provider_check;
ALTER TABLE products ADD CONSTRAINT products_recurring_provider_check
  CHECK (type = 'one_time'
         OR NOT active
         OR stripe_price_id IS NOT NULL
         OR paypal_plan_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_products_lane_sort ON products(lane, sort_order) WHERE active;

COMMENT ON TABLE products IS 'Commerce catalog — the ONLY authority on price. Client-supplied amounts are discarded, never validated (FR-002, #557).';

-- Orders. One item per order; a Care Plan attached at checkout is a second order.
CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id         UUID REFERENCES payment_intents(id),
  subscription_id   UUID REFERENCES subscriptions(id),
  product_id        TEXT NOT NULL REFERENCES products(id),
  buyer_user_id     UUID REFERENCES auth.users(id),   -- nullable: guest checkout
  buyer_email       TEXT NOT NULL,
  quantity          INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  amount_charged    INTEGER NOT NULL,                 -- cents, resolved server-side
  promo_code        TEXT,
  discount_amount   INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','paid','fulfilling','delivered','refunded','canceled')),
  fulfillment_notes TEXT,
  -- Includes `phone`. Not politeness: the catalog promises every build ships with
  -- click-to-call and a form wired to the buyer's phone, and the product cannot
  -- deliver what it sells without asking for the number (FR-013). In Phase 1
  -- deliberately, so the very first sale carries it.
  intake_data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- An order must point at something that can actually be charged.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payable_check;
ALTER TABLE orders ADD CONSTRAINT orders_payable_check
  CHECK (intent_id IS NOT NULL OR subscription_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_user_id ON orders(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_email ON orders(buyer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_intent_id ON orders(intent_id);

COMMENT ON TABLE orders IS 'One order per purchase. status is advanced by the webhook and the admin panel only — never by the buyer (FR-011).';

-- Catalog seed (T006). Ten SKUs, ids matching the storefront exactly so a card on
-- /pricing and a row here are the same thing. Idempotent: ON CONFLICT re-asserts
-- price and copy, so this file remains the source of truth for both.
--
-- The three RECURRING rows are seeded INACTIVE. They have no Stripe price id or
-- PayPal plan id yet, and products_recurring_provider_check will not let them be
-- activated until they do. That is the intended safety property, not an oversight
-- — a subscription SKU that is visible but unbillable is how you take money you
-- cannot fulfil.
--
-- prd-forge is $0 and can never produce a payment_intent (that table's floor is
-- 100 cents). It is display-only by design: its call to action is "Clone the
-- repo", pointing at GitHub, not at checkout.
INSERT INTO products (id, lane, name, tagline, amount, amount_mode, min_amount, max_amount,
                      type, interval, features, metadata, sort_order, active)
VALUES
  ('svc-discovery', 'service', 'Discovery', 'Prove it works before you commit.',
   25000, 'fixed', NULL, NULL, 'one_time', NULL,
   '["Deployed staging page on a real URL","Working contact form","Mobile + Lighthouse pass","Credited in full toward any build within 30 days"]'::jsonb,
   '{"credits_toward":["svc-landing","svc-site"],"credit_window_days":30}'::jsonb, 10, true),

  ('svc-landing', 'service', 'Landing Page', 'One page. Live on your domain. Leads in your inbox.',
   120000, 'fixed', NULL, NULL, 'one_time', NULL,
   '["Single page, your domain, SSL","Form wired to your inbox and phone","Click-to-call + LocalBusiness schema","Lighthouse >= 90, OG tags, favicon","2 revision rounds"]'::jsonb,
   '{"deposit_pct":50}'::jsonb, 20, true),

  ('svc-site', 'service', 'Business Site', 'The full presence, built to rank locally.',
   350000, 'fixed', NULL, NULL, 'one_time', NULL,
   '["5-7 pages incl. service pages","Project gallery","Local SEO + structured data","Blog scaffold + analytics","3 revision rounds"]'::jsonb,
   '{"deposit_pct":50}'::jsonb, 30, true),

  ('svc-care', 'service', 'Care Plan', 'Someone answers when it breaks.',
   9900, 'fixed', NULL, NULL, 'recurring', 'month',
   '["Hosting, SSL, daily backups","Dependency + security updates","Uptime monitoring","30 min of edits per month"]'::jsonb,
   '{"attach_at_checkout":true}'::jsonb, 40, false),

  ('svc-care-pro', 'service', 'Care Plan Pro', 'Care Plan, plus someone who keeps it current.',
   24900, 'fixed', NULL, NULL, 'recurring', 'month',
   '["Everything in Care Plan","Content updates","Monthly performance report","2 hrs of edits, priority turnaround"]'::jsonb,
   '{"attach_at_checkout":true}'::jsonb, 50, false),

  ('prd-forge', 'product', 'Forge', 'The starter. Take it, ship it, keep it.',
   0, 'fixed', NULL, NULL, 'one_time', NULL,
   '["Next.js 15 + React 19 + TypeScript","680+ tests, PWA, 34 themes","Auth, payments, encrypted messaging","MIT licensed, community support"]'::jsonb,
   '{"purchasable":false,"external_url":"https://github.com/TortoiseWolfe/ScriptHammer"}'::jsonb, 10, true),

  ('prd-anvil', 'product', 'Anvil', 'A vertical, productized.',
   14900, 'fixed', NULL, NULL, 'one_time', NULL,
   '["One industry template (Roofer, HVAC, Plumber, Landscaper)","Copy, layout, and schema tuned for the trade","Commercial license, unlimited client sites","Lifetime updates to that pack"]'::jsonb,
   '{}'::jsonb, 20, true),

  ('prd-foundry', 'product', 'Foundry', 'Every pack, and the ones not built yet.',
   4900, 'fixed', NULL, NULL, 'recurring', 'month',
   '["All vertical packs","New packs as they ship","Private channel","Priority issue triage"]'::jsonb,
   '{}'::jsonb, 30, false),

  ('prd-office-hours', 'product', 'Office Hours', 'Bring a goal. Leave with something running.',
   9900, 'fixed', NULL, NULL, 'one_time', NULL,
   '["90-minute live 1:1 session","Bring a goal, leave with something running","Screen-share, real code, your questions","Recording is yours to keep"]'::jsonb,
   '{}'::jsonb, 35, true),

  ('prd-field-study', 'product', 'Field Study', 'Your first client site, built with you, on stream.',
   250000, 'fixed', NULL, NULL, 'one_time', NULL,
   '["Two weeks, done-with-you","Real client, real deployment","Recorded and yours to keep","Pricing and scoping coaching included"]'::jsonb,
   '{}'::jsonb, 40, true),

  -- The ONLY variable-amount SKU. Bounds are the ones the tip-jar screen states
  -- to the visitor: "$1 to $500. Whole dollars."
  ('tip-jar', 'product', 'Tip Jar', 'The template is free and stays free. This is only if you want to.',
   1500, 'variable', 100, 50000, 'one_time', NULL,
   '["Suggested $5 / $15 / $50","Nothing is gated","Any amount, once"]'::jsonb,
   '{"presets":[500,1500,5000],"whole_dollars_only":true}'::jsonb, 50, true)
ON CONFLICT (id) DO UPDATE SET
  lane = EXCLUDED.lane, name = EXCLUDED.name, tagline = EXCLUDED.tagline,
  amount = EXCLUDED.amount, amount_mode = EXCLUDED.amount_mode,
  min_amount = EXCLUDED.min_amount, max_amount = EXCLUDED.max_amount,
  type = EXCLUDED.type, interval = EXCLUDED.interval,
  features = EXCLUDED.features, metadata = EXCLUDED.metadata,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

-- ============================================================================
-- PART 2: AUTHENTICATION TABLES
-- ============================================================================

-- User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE CHECK (length(username) >= 3 AND length(username) <= 30),
  display_name TEXT CHECK (length(display_name) <= 100),
  avatar_url TEXT,
  bio TEXT CHECK (length(bio) <= 500),
  welcome_message_sent BOOLEAN NOT NULL DEFAULT FALSE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON user_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_welcome_pending ON user_profiles(id) WHERE welcome_message_sent = FALSE;

COMMENT ON TABLE user_profiles IS 'User profile information 1:1 with auth.users';

-- Auth audit logs (90-day retention)
CREATE TABLE IF NOT EXISTS auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sign_up',
    'sign_in', 'sign_in_success', 'sign_in_failed',
    'sign_out',
    'password_change', 'password_reset_request', 'password_reset_complete',
    'email_verification', 'email_verification_sent', 'email_verification_complete',
    'token_refresh',
    'account_delete',
    'oauth_link', 'oauth_unlink',
    'payment_retry'
  )),
  event_data JSONB,
  ip_address INET,
  user_agent TEXT CHECK (length(user_agent) <= 500),
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_user_id ON auth_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_event_type ON auth_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_created_at ON auth_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_ip_address ON auth_audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_event ON auth_audit_logs(user_id, event_type, created_at DESC);

-- The "(90-day retention)" half of this comment was untrue for ten months: the
-- function existed, nothing called it (#585). It now names its own enforcer, so
-- the claim is checkable rather than asserted.
COMMENT ON TABLE auth_audit_logs IS 'Security audit trail for all auth events. 90-day retention, enforced by cleanup_old_audit_logs() via .github/workflows/data-retention.yml (#585).';

-- Idempotent extension of auth_audit_logs.event_type CHECK to include
-- 'payment_retry' (#43, B1). The CREATE TABLE above picks up the new
-- value on a fresh DB; this DROP + ADD applies it to existing DBs.
ALTER TABLE auth_audit_logs DROP CONSTRAINT IF EXISTS auth_audit_logs_event_type_check;
ALTER TABLE auth_audit_logs ADD CONSTRAINT auth_audit_logs_event_type_check
  CHECK (event_type IN (
    'sign_up',
    'sign_in', 'sign_in_success', 'sign_in_failed',
    'sign_out',
    'password_change', 'password_reset_request', 'password_reset_complete',
    'email_verification', 'email_verification_sent', 'email_verification_complete',
    'token_refresh',
    'account_delete',
    'oauth_link', 'oauth_unlink',
    'payment_retry'
  ));

-- ============================================================================
-- PART 3: SECURITY TABLES (Feature 017)
-- ============================================================================

-- Rate limiting (brute force protection)
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,  -- Email or IP
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('sign_in', 'sign_up', 'password_reset')),
  ip_address INET,
  user_agent TEXT,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempt_count INTEGER NOT NULL DEFAULT 1,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- #784: the contact form is an ANONYMOUS endpoint that sends mail, so it needs the
-- same ceiling the auth forms have. Reusing `check_rate_limit` / `record_failed_attempt`
-- rather than hand-rolling a second limiter means one implementation to get right —
-- but the CHECK above predates that caller and rejected 'contact_form' with a 23514,
-- which surfaced only because the live probe was run rather than assumed.
--
-- Widening a CHECK permits strictly more values and rewrites no rows. Written as
-- DROP-then-ADD so re-running this file is idempotent, matching the rest of it.
ALTER TABLE rate_limit_attempts
  DROP CONSTRAINT IF EXISTS rate_limit_attempts_attempt_type_check;
ALTER TABLE rate_limit_attempts
  ADD CONSTRAINT rate_limit_attempts_attempt_type_check
  CHECK (attempt_type IN ('sign_in', 'sign_up', 'password_reset', 'contact_form'));

CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON rate_limit_attempts(identifier, attempt_type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_attempts(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limit_locked ON rate_limit_attempts(locked_until) WHERE locked_until IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limit_unique ON rate_limit_attempts(identifier, attempt_type);

COMMENT ON TABLE rate_limit_attempts IS 'Server-side rate limiting - prevents brute force';

-- Enable RLS on rate_limit_attempts (system-managed, service role only)
ALTER TABLE rate_limit_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only access" ON rate_limit_attempts;
CREATE POLICY "Service role only access" ON rate_limit_attempts
  FOR ALL
  USING (false);

COMMENT ON POLICY "Service role only access" ON rate_limit_attempts IS
  'Rate limiting data is system-managed. Only service role can access.';

-- NOTE: the custom `oauth_states` CSRF table + `src/lib/auth/oauth-state.ts`
-- were removed (#183). They had zero production callers — the real OAuth CSRF
-- defense is Supabase's built-in PKCE `state` (see OAuthButtons.tsx /
-- auth/callback). The table also carried fully-public INSERT/SELECT/UPDATE RLS,
-- so it was unused attack surface. Dropped from prod via the Management API.

-- ============================================================================
-- PART 4: FUNCTIONS
-- ============================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, created_at, updated_at)
  VALUES (NEW.id, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- #49: write the 'sign_up' audit event here, in the AFTER INSERT ON auth.users
  -- trigger, so EVERY signup path is captured — email/password form, OAuth
  -- redirect, AND admin-API auth.admin.createUser(). The application-level
  -- logAuthEvent() in SignUpForm only fired on the form path, so OAuth/admin
  -- signups were silently missing and admin_auth_stats().signups_this_month
  -- under-reported. The trigger is now the single source of truth for SUCCESSFUL
  -- signups; the form keeps logging only the FAILED-attempt row (no auth.users
  -- INSERT happens on failure, so the trigger can't cover that case).
  -- provider is best-effort from raw_app_meta_data (defaults to 'email').
  INSERT INTO public.auth_audit_logs (user_id, event_type, success, event_data)
  VALUES (
    NEW.id,
    'sign_up',
    TRUE,
    jsonb_build_object(
      'email', NEW.email,
      'provider', COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create user profile / audit log for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Cleanup old audit logs (90 days) — #585
--
-- THIS FUNCTION EXISTED FROM THE INITIAL MIGRATION AND WAS NEVER CALLED. For ten
-- months the table COMMENT above, two security audits and one E2E-teardown design
-- decision all cited its 90-day window as though it were in force, and it deleted
-- nothing; the oldest row was four months old when #585 measured it. The caller
-- now lives in .github/workflows/data-retention.yml. If you ever remove that
-- caller, correct those documents in the same change — a retention claim with no
-- job behind it is precisely the defect this ticket was.
--
-- Batched on purpose: auth_audit_logs carries FIVE indexes (lines 288-292), so
-- every deleted row costs five index updates, and the original unbounded DELETE
-- built one working set as large as the whole backlog. Note the call is still a
-- SINGLE transaction — plpgsql functions cannot COMMIT — so this bounds
-- per-statement work, not transaction duration. That is enough here: the rows are
-- 90+ days old in an append-only table, so no live writer contends for them.
--
-- Returns the number of rows removed, so a caller can log a COUNT. Never log the
-- rows themselves: they carry ip_address, user_agent and event_data.
-- (scripts/cleanup-expired-intents.ts:73-78 prints customer_email per deleted
-- row. Do not copy that here.)
DROP FUNCTION IF EXISTS cleanup_old_audit_logs();
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
  p_batch_size INT DEFAULT 5000,
  p_max_batches INT DEFAULT 100
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW() - INTERVAL '90 days';
  v_batch  INT;
  v_total  INT := 0;
BEGIN
  FOR i IN 1..p_max_batches LOOP
    DELETE FROM auth_audit_logs
    WHERE id IN (
      SELECT id
      FROM auth_audit_logs
      WHERE created_at < v_cutoff
      ORDER BY created_at
      LIMIT p_batch_size
    );
    GET DIAGNOSTICS v_batch = ROW_COUNT;
    v_total := v_total + v_batch;
    -- A short batch means the cutoff is drained; stop rather than burning
    -- the remaining iterations on empty DELETEs.
    EXIT WHEN v_batch < p_batch_size;
  END LOOP;

  RETURN v_total;
END;
$$;

-- Rate limiting check (Feature 017)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_attempt_type TEXT,
  p_ip_address INET DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record rate_limit_attempts%ROWTYPE;
  v_max_attempts INTEGER := 5;
  v_window_minutes INTEGER := 15;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_record
  FROM rate_limit_attempts
  WHERE identifier = p_identifier AND attempt_type = p_attempt_type
  FOR UPDATE SKIP LOCKED;

  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
    RETURN json_build_object('allowed', FALSE, 'remaining', 0, 'locked_until', v_record.locked_until, 'reason', 'rate_limited');
  END IF;

  IF v_record.id IS NULL OR (v_now - v_record.window_start) > (v_window_minutes || ' minutes')::INTERVAL THEN
    INSERT INTO rate_limit_attempts (identifier, attempt_type, ip_address, window_start, attempt_count)
    VALUES (p_identifier, p_attempt_type, p_ip_address, v_now, 0)
    ON CONFLICT (identifier, attempt_type) DO UPDATE
      SET window_start = v_now, attempt_count = 0, locked_until = NULL, updated_at = v_now;
    RETURN json_build_object('allowed', TRUE, 'remaining', v_max_attempts, 'locked_until', NULL);
  END IF;

  IF v_record.attempt_count < v_max_attempts THEN
    RETURN json_build_object('allowed', TRUE, 'remaining', v_max_attempts - v_record.attempt_count, 'locked_until', NULL);
  ELSE
    UPDATE rate_limit_attempts
    SET locked_until = v_now + (v_window_minutes || ' minutes')::INTERVAL, updated_at = v_now
    WHERE identifier = p_identifier AND attempt_type = p_attempt_type;
    RETURN json_build_object('allowed', FALSE, 'remaining', 0, 'locked_until', v_now + (v_window_minutes || ' minutes')::INTERVAL, 'reason', 'rate_limited');
  END IF;
END;
$$;

-- Record failed auth attempt (Feature 017)
CREATE OR REPLACE FUNCTION record_failed_attempt(
  p_identifier TEXT,
  p_attempt_type TEXT,
  p_ip_address INET DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rate_limit_attempts
  SET attempt_count = attempt_count + 1, updated_at = now(), ip_address = COALESCE(p_ip_address, ip_address)
  WHERE identifier = p_identifier AND attempt_type = p_attempt_type;

  IF NOT FOUND THEN
    INSERT INTO rate_limit_attempts (identifier, attempt_type, ip_address, attempt_count)
    VALUES (p_identifier, p_attempt_type, p_ip_address, 1)
    ON CONFLICT (identifier, attempt_type) DO UPDATE
      SET attempt_count = rate_limit_attempts.attempt_count + 1, updated_at = now();
  END IF;
END;
$$;

-- ============================================================================
-- PART 5: TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- ============================================================================
-- PART 6: STORAGE BUCKETS (Feature 022: Avatar Upload)
-- ============================================================================

-- Create avatars bucket for user profile pictures
--
-- Local-profile caveat: the supabase/postgres image's storage-schema.sql
-- creates storage.buckets with only (id, name, owner, created_at, updated_at).
-- The public / file_size_limit / allowed_mime_types columns are added by the
-- storage SERVICE's own runtime migrations on first connect -- which can't
-- happen during initdb because storage hasn't started yet. Against Supabase
-- Cloud this INSERT works as-is because storage has already migrated there.
-- Forward-fill the three columns here so the INSERT succeeds; storage's own
-- ADD COLUMN IF NOT EXISTS will no-op when it catches up later.
--
-- GUARDED, BECAUSE `IF NOT EXISTS` IS NOT ENOUGH. Postgres checks ownership
-- BEFORE the IF-NOT-EXISTS short-circuit, and on Supabase Cloud storage.buckets
-- is owned by `supabase_storage_admin`. So on cloud these three lines fail with
-- `42501: must be owner of table buckets` even though every column already
-- exists and the statements would be no-ops. That aborts the entire migration
-- in its transaction — 0 tables created — which is exactly what happened when
-- this file was first applied to a fresh cloud project (#567 org migration).
--
-- Checking the catalog first means cloud skips the ALTER entirely and only the
-- local stack, where the columns really are missing and we really are the owner,
-- executes it.
DO $storage_cols$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'storage' AND table_name = 'buckets'
                   AND column_name = 'public') THEN
    ALTER TABLE storage.buckets ADD COLUMN public boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'storage' AND table_name = 'buckets'
                   AND column_name = 'file_size_limit') THEN
    ALTER TABLE storage.buckets ADD COLUMN file_size_limit bigint;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'storage' AND table_name = 'buckets'
                   AND column_name = 'allowed_mime_types') THEN
    ALTER TABLE storage.buckets ADD COLUMN allowed_mime_types text[];
  END IF;
END
$storage_cols$;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'avatars',
  'avatars',
  true,                                              -- Public read access
  5242880,                                           -- 5MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp']    -- Allowed formats
)
ON CONFLICT (id) DO NOTHING;                         -- Idempotent

-- Drop existing avatar policies (for clean re-run)
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- These three policies used to read:  auth.uid()::text = (storage.foldername(name))[1]
-- That expression creates a pg_depend edge on storage.foldername(text). On Cloud nobody
-- cares because storage-api has already run its storage-schema migration by
-- the time anybody applies app schema. On a fresh local initdb the ordering is
-- inverted: this file runs first, pins the base-image foldername, then
-- storage-api connects and tries DROP FUNCTION foldername(text) to install its
-- canonical version -- and can't, because our three policies depend on it.
-- storage-api crash-loops on "cannot drop function foldername(text) because
-- other objects depend on it" forever.
--
-- split_part(name, '/', 1) is the same thing -- first path segment -- using
-- only pg_catalog built-ins. No pg_depend edge, storage-api free to DROP.
-- Edge cases land identically for policy purposes: bare filename with no '/'
-- produces NULL vs the filename itself, but auth.uid() = NULL and
-- auth.uid() = 'avatar.png' both DENY (uuids can't collide with filenames).

-- Avatar RLS Policy 1: INSERT - Users can upload own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- Avatar RLS Policy 2: UPDATE - Users can update own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- Avatar RLS Policy 3: DELETE - Users can delete own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- Avatar RLS Policy 4: SELECT - Anyone can view avatars (public read)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- ============================================================================
-- PART 7: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_provider_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Payment intents (Feature 017: Stricter policies)
DROP POLICY IF EXISTS "Users can view own payment intents" ON payment_intents;
CREATE POLICY "Users can view own payment intents" ON payment_intents
  FOR SELECT USING (auth.uid() = template_user_id);

DROP POLICY IF EXISTS "Users can create own payment intents" ON payment_intents;
CREATE POLICY "Users can create own payment intents" ON payment_intents
  FOR INSERT WITH CHECK (auth.uid() = template_user_id);

DROP POLICY IF EXISTS "Payment intents are immutable" ON payment_intents;
CREATE POLICY "Payment intents are immutable" ON payment_intents
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Payment intents cannot be deleted by users" ON payment_intents;
CREATE POLICY "Payment intents cannot be deleted by users" ON payment_intents
  FOR DELETE USING (false);

-- Payment results (Feature 017: Stricter policies)
DROP POLICY IF EXISTS "Users can view own payment results" ON payment_results;
CREATE POLICY "Users can view own payment results" ON payment_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM payment_intents
      WHERE payment_intents.id = payment_results.intent_id
      AND payment_intents.template_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role can insert payment results" ON payment_results;
CREATE POLICY "Service role can insert payment results" ON payment_results
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Payment results are immutable" ON payment_results;
CREATE POLICY "Payment results are immutable" ON payment_results
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Payment results cannot be deleted by users" ON payment_results;
CREATE POLICY "Payment results cannot be deleted by users" ON payment_results
  FOR DELETE USING (false);

-- Subscriptions
DROP POLICY IF EXISTS "Users view own subscriptions" ON subscriptions;
CREATE POLICY "Users view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = template_user_id);

DROP POLICY IF EXISTS "Users create own subscriptions" ON subscriptions;
CREATE POLICY "Users create own subscriptions" ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = template_user_id);

DROP POLICY IF EXISTS "Users update own subscriptions" ON subscriptions;
CREATE POLICY "Users update own subscriptions" ON subscriptions
  FOR UPDATE USING (auth.uid() = template_user_id);

-- Webhook events
DROP POLICY IF EXISTS "Service creates webhook events" ON webhook_events;
CREATE POLICY "Service creates webhook events" ON webhook_events
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service updates webhook events" ON webhook_events;
CREATE POLICY "Service updates webhook events" ON webhook_events
  FOR UPDATE TO service_role WITH CHECK (true);

-- Payment provider config
DROP POLICY IF EXISTS "Users view provider config" ON payment_provider_config;
CREATE POLICY "Users view provider config" ON payment_provider_config
  FOR SELECT USING (true);

-- Commerce catalog (#557).
--
-- products is world-readable when active — a visitor must see prices before they
-- have any session at all. Nothing writes it from a client, ever: price lives
-- here precisely so the browser cannot name one.
DROP POLICY IF EXISTS "Anyone can view active products" ON products;
CREATE POLICY "Anyone can view active products" ON products
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Products are not client-writable" ON products;
CREATE POLICY "Products are not client-writable" ON products
  FOR ALL USING (false) WITH CHECK (false);

-- A buyer reads their own orders and writes none of them. FR-011: buyers must not
-- be able to write an order's fulfillment stage, so there is no client UPDATE
-- policy at all — the webhook and the admin panel are the only writers.
-- An anonymous session is still a session, so a guest cannot read another guest's
-- order; auth.uid() differs per anonymous user.
DROP POLICY IF EXISTS "Buyers can view own orders" ON orders;
CREATE POLICY "Buyers can view own orders" ON orders
  FOR SELECT USING (auth.uid() = buyer_user_id);

DROP POLICY IF EXISTS "Service role can insert orders" ON orders;
CREATE POLICY "Service role can insert orders" ON orders
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update orders" ON orders;
CREATE POLICY "Service role can update orders" ON orders
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Orders cannot be deleted by users" ON orders;
CREATE POLICY "Orders cannot be deleted by users" ON orders
  FOR DELETE USING (false);

-- User profiles
-- Note: "Users view own profile" provides full access to own profile
DROP POLICY IF EXISTS "Users view own profile" ON user_profiles;
CREATE POLICY "Users view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Note: "Authenticated users can search profiles" enables Feature 023 friend search
-- Users can view public profile fields (username, display_name, avatar_url) to find friends
DROP POLICY IF EXISTS "Authenticated users can search profiles" ON user_profiles;
CREATE POLICY "Authenticated users can search profiles" ON user_profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users update own profile" ON user_profiles;
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Service creates profiles" ON user_profiles;
CREATE POLICY "Service creates profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);

-- Auth audit logs (Feature 017)
DROP POLICY IF EXISTS "Users can view own audit logs" ON auth_audit_logs;
CREATE POLICY "Users can view own audit logs" ON auth_audit_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert audit logs" ON auth_audit_logs;
CREATE POLICY "Service role can insert audit logs" ON auth_audit_logs
  FOR INSERT TO service_role WITH CHECK (true);

-- log_auth_event(): the client-callable write path for auth audit events (#241).
--
-- Before this, sign-in / failed-sign-in events were written by a client-side
-- `.from('auth_audit_logs').insert()` running as the authenticated/anon role —
-- but the ONLY INSERT policy on the table is service_role, so RLS silently
-- rejected every one of those writes. Result: the audit log was empty for all
-- real sign-ins and failed logins (only the SECURITY DEFINER signup trigger got
-- through), and the "too many failed attempts" detector — which reads
-- event_type='sign_in_failed' — could never fire.
--
-- Rather than open a broad client INSERT policy on a security-sensitive table
-- (which would let clients forge arbitrary audit rows), we expose a narrow
-- SECURITY DEFINER RPC. It bypasses RLS to insert, but ENFORCES that a caller
-- may only attribute an event to themselves (user_id = auth.uid()) or leave it
-- unattributed (user_id IS NULL — the legitimate case for a FAILED login, where
-- no session exists yet). The event_type CHECK on the table is the vocabulary
-- guard; callers must use 'sign_in_success' / 'sign_in_failed' (what the admin
-- stats + failed-attempt detector read), not 'sign_in'.
CREATE OR REPLACE FUNCTION public.log_auth_event(
  p_event_type   TEXT,
  p_user_id      UUID DEFAULT NULL,
  p_event_data   JSONB DEFAULT NULL,
  p_success      BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL,
  p_user_agent   TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Anti-forgery: a client may only log for itself or anonymously. Never allow
  -- attributing an event to a DIFFERENT user. (auth.uid() is NULL for anon.)
  IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'log_auth_event: cannot log an event for another user';
  END IF;

  INSERT INTO auth_audit_logs (
    user_id, event_type, event_data, success, error_message, user_agent
  ) VALUES (
    p_user_id, p_event_type, p_event_data,
    COALESCE(p_success, TRUE), p_error_message, left(p_user_agent, 500)
  );
END;
$$;
-- Revoke the implicit PUBLIC grant Postgres puts on new functions, then grant
-- explicitly to the client roles that need it — least privilege for a function
-- that writes to a security table.
REVOKE EXECUTE ON FUNCTION public.log_auth_event(TEXT, UUID, JSONB, BOOLEAN, TEXT, TEXT)
  FROM public;
GRANT EXECUTE ON FUNCTION public.log_auth_event(TEXT, UUID, JSONB, BOOLEAN, TEXT, TEXT)
  TO authenticated, anon;

-- Admin read-only policies (Feature: Admin Dashboard)
-- Uses JWT custom claims from auth.users.raw_app_meta_data (Supabase RBAC best practice)
-- NEVER subquery user_profiles from its own policy — causes infinite recursion
-- Admin status is set via: UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
--
-- Local-profile caveat: the supabase/postgres image ships auth.uid/role/email
-- (init-scripts/00000000000001-auth-schema.sql) but NOT auth.jwt -- GoTrue
-- creates that on its own first boot. CREATE POLICY checks function existence
-- at parse time, not call time, so every policy below would fail during local
-- initdb. Forward-fill a stub with the canonical implementation; GoTrue's
-- CREATE OR REPLACE overwrites it at service boot. Ownership must be
-- supabase_auth_admin or that REPLACE dies on 42501 (must be owner).
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;
ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;

-- ============================================================================
-- Admin authorization: SINGLE SOURCE OF TRUTH (#240)
--
-- Previously admin status lived in TWO places that could disagree:
--   1. user_profiles.is_admin (column) — read by the client UI gate
--      (admin-auth-service.checkIsAdmin), and
--   2. auth.users.raw_app_meta_data->>'is_admin' → the JWT app_metadata claim —
--      read by every RLS policy and admin RPC guard.
-- Nothing synced them, producing "hollow admins" (column set, claim not → UI
-- shows the section but every RPC returns '{}'/zero rows) and "lingering
-- admins" (claim revoked but the already-minted JWT keeps working until
-- re-login).
--
-- Fix: user_profiles.is_admin is now the ONE authority.
--   • custom_access_token_hook() DERIVES the app_metadata.is_admin claim FROM
--     the column at every token mint — so the claim can never drift from the
--     column, and RLS-policy-level filtering stays fast for normal operation.
--   • is_admin() re-reads the column LIVE (SECURITY DEFINER, bypasses
--     user_profiles' own RLS to avoid recursion — same pattern as
--     is_conversation_member below). The admin RPC guards call is_admin()
--     instead of trusting the JWT claim, so revoking the column cuts off
--     sensitive-data access on the very next request — no waiting for token
--     refresh (closes the "lingering admin" gap the hook alone can't).
--   • The client gate (admin-auth-service.checkIsAdmin) also calls is_admin(),
--     so the UI and the data can never disagree.
--
-- OUT-OF-BAND STEP (project config, not SQL — do via the Management API auth
-- config or Dashboard → Authentication → Hooks): register
-- public.custom_access_token_hook as the project's "Custom Access Token" hook.
-- Until that is done, the hook function exists but is not invoked; is_admin()
-- still makes the RPC guards correct on its own.
-- ============================================================================

-- is_admin(): the live authority. Reads the user_profiles.is_admin column
-- directly. SECURITY DEFINER so it can read the column regardless of the
-- caller's RLS on user_profiles (and without recursing into that table's own
-- admin policy). Defaults to auth.uid() so guards can call is_admin() bare.
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM user_profiles WHERE id = check_user_id),
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, anon;

-- ============================================================================
-- STORAGE: intake-uploads bucket (#560, FR-014 … FR-018)
-- ============================================================================
--
-- What the buyer shows us at checkout: screenshots of the site they have, and
-- sketches or references for the one they want. Tagged have/want in the UI and
-- stored under `{auth.uid()}/…` so ownership is a property of the PATH.
--
-- WHY THIS LIVES HERE AND NOT WITH THE `avatars` BUCKET ABOVE. The SELECT and
-- DELETE policies call public.is_admin(), and CREATE POLICY resolves the function
-- at creation time — so it has to be defined first. is_admin() is declared
-- immediately above. Moving this block up next to `avatars` for tidiness breaks
-- the migration with `function public.is_admin() does not exist`.
--
-- PRIVATE, unlike `avatars`. FR-016: an attachment is readable by the buyer who
-- uploaded it and by the operator, nobody else. `public = false` means no
-- unauthenticated URL exists at all; /admin/orders renders these through signed
-- URLs (T022).
--
-- THE LIMITS ARE ON THE BUCKET, WHICH IS THE POINT. FR-015 requires size and type
-- to be enforced "in a place the buyer's device cannot bypass", and SC-011 tests
-- exactly that by removing the browser-side check. `file_size_limit` and
-- `allowed_mime_types` are enforced by storage-api itself, so the client-side
-- validation in src/lib/commerce/intake-upload.ts is a courtesy that produces a
-- good error message — never the control.
--
-- HEIC IS ALLOWED THOUGH WE CANNOT THUMBNAIL IT (FR-018). A phone photo straight
-- from an iPhone is the single most likely thing a buyer sends; rejecting it
-- because we cannot draw a preview would be refusing the common case. Both
-- image/heic and image/heif are listed because the two are used interchangeably
-- and browsers disagree. The uploader sets an explicit contentType from the file
-- extension when the browser reports none, which it often does for HEIC — without
-- that, the upload arrives as application/octet-stream and this allowlist rejects
-- a file the product promises to accept.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'intake-uploads',
  'intake-uploads',
  false,                                             -- FR-016: never public
  10485760,                                          -- 10MB per file (FR-015)
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',                                    -- FR-018: accepted, not previewable
    'image/heif',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
-- DO UPDATE, not DO NOTHING. These three columns ARE the server-side enforcement
-- (FR-015). With DO NOTHING a re-run silently keeps whatever limits the bucket
-- already had, so tightening or widening them here would be a no-op against any
-- project where the bucket exists — the change would appear applied and not be.

DROP POLICY IF EXISTS "Buyers can upload own intake files" ON storage.objects;
DROP POLICY IF EXISTS "Buyers and operator can read intake files" ON storage.objects;
DROP POLICY IF EXISTS "Buyers can replace own intake files" ON storage.objects;
DROP POLICY IF EXISTS "Buyers and operator can delete intake files" ON storage.objects;

-- split_part(name, '/', 1), not storage.foldername() — same first-path-segment
-- result using only pg_catalog built-ins, so no pg_depend edge is created on a
-- storage function that storage-api later needs to DROP. See the long note above
-- the avatar policies; getting this wrong crash-loops storage-api on a fresh
-- local initdb.

-- INSERT: a buyer may only write under their own uid prefix.
CREATE POLICY "Buyers can upload own intake files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'intake-uploads' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- SELECT: the buyer who owns the prefix, or the operator (FR-016).
CREATE POLICY "Buyers and operator can read intake files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'intake-uploads' AND (
    auth.uid()::text = split_part(name, '/', 1)
    OR public.is_admin()
  )
);

-- UPDATE: needed for upsert on retry (same path, second attempt).
CREATE POLICY "Buyers can replace own intake files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'intake-uploads' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- DELETE: the buyer removing a file before submitting, and the operator for the
-- 7-day sweep of abandoned checkouts (FR-017, T023).
CREATE POLICY "Buyers and operator can delete intake files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'intake-uploads' AND (
    auth.uid()::text = split_part(name, '/', 1)
    OR public.is_admin()
  )
);

-- custom_access_token_hook(): Supabase Auth calls this at token-mint time
-- (login + refresh) with the pending JWT claims. We merge the derived
-- is_admin flag (from the user_profiles column) into app_metadata so the
-- claim is always a projection of the column, never a hand-set second store.
-- Signature/return shape per Supabase's custom-access-token-hook contract:
-- receive { user_id, claims, ... }, return the (possibly modified) event.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims        jsonb;
  app_metadata  jsonb;
  admin_flag    boolean;
BEGIN
  SELECT COALESCE(is_admin, false) INTO admin_flag
  FROM user_profiles
  WHERE id = (event->>'user_id')::uuid;

  admin_flag := COALESCE(admin_flag, false);

  claims := COALESCE(event->'claims', '{}'::jsonb);
  app_metadata := COALESCE(claims->'app_metadata', '{}'::jsonb);
  app_metadata := jsonb_set(app_metadata, '{is_admin}', to_jsonb(admin_flag), true);
  claims := jsonb_set(claims, '{app_metadata}', app_metadata, true);

  RETURN jsonb_set(event, '{claims}', claims, true);
END;
$$;

-- Grants per Supabase's auth-hook requirement: only the auth admin role may
-- execute the hook; it must NOT be callable by client roles.
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;
-- The auth admin role needs to read the column the hook derives from.
GRANT SELECT ON public.user_profiles TO supabase_auth_admin;

DROP POLICY IF EXISTS "Admin can view all profiles" ON user_profiles;
CREATE POLICY "Admin can view all profiles" ON user_profiles
  FOR SELECT USING (
    is_admin()  -- #240: live column authority (was: JWT claim, which could drift/linger)
  );

DROP POLICY IF EXISTS "Admin can view all audit logs" ON auth_audit_logs;
CREATE POLICY "Admin can view all audit logs" ON auth_audit_logs
  FOR SELECT USING (
    is_admin()  -- #240: live column authority (was: JWT claim, which could drift/linger)
  );

DROP POLICY IF EXISTS "Admin can view all orders" ON orders;
CREATE POLICY "Admin can view all orders" ON orders
  FOR SELECT USING (
    is_admin()  -- the fulfillment queue at /admin/orders (#561) reads through this
  );

DROP POLICY IF EXISTS "Admin can view all payment intents" ON payment_intents;
CREATE POLICY "Admin can view all payment intents" ON payment_intents
  FOR SELECT USING (
    is_admin()  -- #240: live column authority (was: JWT claim, which could drift/linger)
  );

DROP POLICY IF EXISTS "Admin can view all payment results" ON payment_results;
CREATE POLICY "Admin can view all payment results" ON payment_results
  FOR SELECT USING (
    is_admin()  -- #240: live column authority (was: JWT claim, which could drift/linger)
  );

DROP POLICY IF EXISTS "Admin can view all subscriptions" ON subscriptions;
CREATE POLICY "Admin can view all subscriptions" ON subscriptions
  FOR SELECT USING (
    is_admin()  -- #240: live column authority (was: JWT claim, which could drift/linger)
  );

DROP POLICY IF EXISTS "Admin can view all rate limits" ON rate_limit_attempts;
CREATE POLICY "Admin can view all rate limits" ON rate_limit_attempts
  FOR SELECT USING (
    is_admin()  -- #240: live column authority (was: JWT claim, which could drift/linger)
  );

-- The three admin-read policies for user_connections / conversations / messages
-- belong with this block semantically but live ~400 lines down, right after
-- the messages section finishes. Those tables are created in PART 8; placing
-- the policies here would be a forward reference that crashes on a fresh
-- local initdb (relation does not exist). On Cloud the tables already exist
-- from prior runs so nobody noticed. Grep for "Admin can view all connections".

-- ============================================================================
-- Admin RPC Aggregation Functions (Feature: Admin Dashboard)
-- SECURITY INVOKER: runs as calling user, respects RLS
-- ============================================================================

-- admin_payment_stats(): Payment metrics for admin dashboard
CREATE OR REPLACE FUNCTION admin_payment_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN  -- #240: live column authority (was: JWT claim)
    RETURN '{}'::json;
  END IF;

  RETURN (
    SELECT json_build_object(
      'total_payments', (SELECT count(*) FROM payment_results),
      'successful_payments', (SELECT count(*) FROM payment_results WHERE status = 'succeeded'),
      'failed_payments', (SELECT count(*) FROM payment_results WHERE status = 'failed'),
      'pending_payments', (SELECT count(*) FROM payment_results WHERE status = 'pending'),
      'total_revenue_cents', (SELECT COALESCE(sum(charged_amount), 0) FROM payment_results WHERE status = 'succeeded'),
      'active_subscriptions', (SELECT count(*) FROM subscriptions WHERE status = 'active'),
      'failed_this_week', (SELECT count(*) FROM payment_results WHERE status = 'failed' AND created_at > now() - interval '7 days'),
      -- json_object_agg keys on provider so the wire shape matches
      -- AdminPaymentStats.revenue_by_provider: Record<string, number>.
      -- json_agg(row_to_json(...)) here used to emit an array — every unit
      -- mock used the Record shape so the mismatch only surfaced live.
      'revenue_by_provider', (
        SELECT COALESCE(json_object_agg(provider, total), '{}'::json)
        FROM (
          SELECT provider, sum(charged_amount) AS total
          FROM payment_results
          WHERE status = 'succeeded'
          GROUP BY provider
        ) t
      )
    )
  );
END;
$$;

-- admin_auth_stats(): Auth/security metrics for admin dashboard
CREATE OR REPLACE FUNCTION admin_auth_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN  -- #240: live column authority (was: JWT claim)
    RETURN '{}'::json;
  END IF;

  RETURN (
    SELECT json_build_object(
      'logins_today', (SELECT count(*) FROM auth_audit_logs WHERE event_type IN ('sign_in', 'sign_in_success') AND success = TRUE AND created_at > now() - interval '1 day'),
      'failed_this_week', (SELECT count(*) FROM auth_audit_logs WHERE event_type = 'sign_in_failed' AND created_at > now() - interval '7 days'),
      'signups_this_month', (SELECT count(*) FROM auth_audit_logs WHERE event_type = 'sign_up' AND success = TRUE AND created_at > now() - interval '30 days'),
      'rate_limited_users', (SELECT count(*) FROM rate_limit_attempts WHERE locked_until IS NOT NULL AND locked_until > now()),
      'top_failed_logins', (
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
        FROM (
          -- 'attempts' matches AdminAuthStats.top_failed_logins[].attempts
          -- and AuditBurst.attempts — same semantic, one name.
          SELECT user_id, count(*) AS attempts
          FROM auth_audit_logs
          WHERE event_type = 'sign_in_failed'
            AND created_at > now() - interval '7 days'
          GROUP BY user_id
          ORDER BY attempts DESC
          LIMIT 10
        ) t
      )
    )
  );
END;
$$;

-- admin_user_stats(): User metrics for admin dashboard
CREATE OR REPLACE FUNCTION admin_user_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN  -- #240: live column authority (was: JWT claim)
    RETURN '{}'::json;
  END IF;

  RETURN (
    SELECT json_build_object(
      'total_users', (SELECT count(*) FROM user_profiles WHERE is_admin = FALSE),
      'active_this_week', (SELECT count(*) FROM user_profiles WHERE updated_at > now() - interval '7 days' AND is_admin = FALSE),
      'pending_connections', (SELECT count(*) FROM user_connections WHERE status = 'pending'),
      'total_connections', (SELECT count(*) FROM user_connections WHERE status = 'accepted')
    )
  );
END;
$$;

-- admin_messaging_stats(): Messaging metrics for admin dashboard
CREATE OR REPLACE FUNCTION admin_messaging_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN  -- #240: live column authority (was: JWT claim)
    RETURN '{}'::json;
  END IF;

  RETURN (
    SELECT json_build_object(
      'total_conversations', (SELECT count(*) FROM conversations),
      'group_conversations', (SELECT count(*) FROM conversations WHERE is_group = TRUE),
      'direct_conversations', (SELECT count(*) FROM conversations WHERE is_group = FALSE),
      'messages_this_week', (SELECT count(*) FROM messages WHERE created_at > now() - interval '7 days'),
      'active_connections', (SELECT count(*) FROM user_connections WHERE status = 'accepted'),
      'blocked_connections', (SELECT count(*) FROM user_connections WHERE status = 'blocked'),
      -- json_object_agg keys on status so Object.entries() at
      -- AdminMessagingOverview.tsx gets {accepted: N, pending: M, ...}
      -- not [{status, total}]. Empty case → {} not [].
      'connection_distribution', (
        SELECT COALESCE(json_object_agg(status, total), '{}'::json)
        FROM (
          SELECT status, count(*) AS total
          FROM user_connections
          GROUP BY status
        ) t
      )
    )
  );
END;
$$;

-- admin_list_users(p_search, p_limit, p_offset): User listing for admin dashboard
--
-- SECURITY DEFINER: auth.users.last_sign_in_at is the activity truth source and
-- is NOT reachable through RLS from the client. The JWT guard is the only gate.
--
-- activity is computed in SQL so the admin stats and this listing agree on what
-- "active" means — same 7-day boundary as admin_user_stats.active_this_week.
-- NULL last_sign_in_at (signed up but never returned) folds into dormant.
--
-- Search covers both username and display_name. Leading-wildcard ILIKE won't hit
-- the btree index on username but at admin-dashboard scale this is a non-issue.
--
-- Returns {total, users[]} — total is the search-filtered count ignoring
-- limit/offset, so the UI can render "showing N of M" without a second call.
CREATE OR REPLACE FUNCTION admin_list_users(
  p_search TEXT DEFAULT NULL,
  p_limit  INT  DEFAULT 50,
  p_offset INT  DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pattern TEXT;
  v_total   BIGINT;
BEGIN
  IF NOT is_admin() THEN  -- #240: live column authority (was: JWT claim)
    RETURN '{}'::json;
  END IF;

  -- Build once, reuse twice. NULL pattern → no filter (short-circuited below).
  v_pattern := '%' || p_search || '%';

  SELECT COUNT(*) INTO v_total
  FROM user_profiles p
  WHERE p.is_admin = FALSE
    AND (p_search IS NULL
         OR p.username     ILIKE v_pattern
         OR p.display_name ILIKE v_pattern);

  RETURN json_build_object(
    'total', v_total,
    'users', COALESCE((
      SELECT json_agg(row_to_json(u))
      FROM (
        SELECT
          p.id,
          p.username,
          p.display_name,
          p.created_at,
          p.welcome_message_sent,
          au.last_sign_in_at,
          CASE
            WHEN au.last_sign_in_at IS NULL                           THEN 'dormant'
            WHEN au.last_sign_in_at > now() - interval '7 days'       THEN 'active'
            WHEN au.last_sign_in_at > now() - interval '30 days'      THEN 'idle'
            ELSE 'dormant'
          END AS activity
        FROM user_profiles p
        JOIN auth.users au ON au.id = p.id
        WHERE p.is_admin = FALSE
          AND (p_search IS NULL
               OR p.username     ILIKE v_pattern
               OR p.display_name ILIKE v_pattern)
        ORDER BY au.last_sign_in_at DESC NULLS LAST, p.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) u
    ), '[]'::json)
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_list_users(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_users(TEXT, INT, INT) TO authenticated;

-- admin_payment_trends(p_start, p_end): Date-ranged payment breakdown for admin dashboard
--
-- SECURITY DEFINER: bypasses RLS by design. The JWT guard on the first line is the
-- ONLY access check — non-admin callers get {} and never reach the aggregation.
-- This is the pattern for admin aggregates that must work even on tables where
-- the admin has no row-level SELECT policy (see: messaging). payment_results
-- happens to have an admin RLS policy too, but this function does not rely on it.
--
-- Refund rate = refunded / succeeded (0 when succeeded = 0, no NaN).
-- daily_series is DENSE: generate_series emits every day in range, LEFT JOIN fills
-- gaps with zeros. Charts can render directly without client-side gap-filling.
CREATE OR REPLACE FUNCTION admin_payment_trends(
  p_start TIMESTAMPTZ DEFAULT (now() - interval '7 days'),
  p_end   TIMESTAMPTZ DEFAULT now()
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_succeeded     BIGINT;
  v_failed        BIGINT;
  v_refunded      BIGINT;
  v_revenue_cents BIGINT;
BEGIN
  IF NOT is_admin() THEN  -- #240: live column authority (was: JWT claim)
    RETURN '{}'::json;
  END IF;

  -- Single pass over the range for totals. COUNT/SUM over a condition are
  -- expressed with FILTER so the planner scans payment_results once.
  SELECT
    COUNT(*) FILTER (WHERE status = 'succeeded'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'refunded'),
    COALESCE(SUM(charged_amount) FILTER (WHERE status = 'succeeded'), 0)
  INTO v_succeeded, v_failed, v_refunded, v_revenue_cents
  FROM payment_results
  WHERE created_at >= p_start AND created_at < p_end;

  RETURN json_build_object(
    'range', json_build_object('start', p_start, 'end', p_end),
    'totals', json_build_object(
      'succeeded',     v_succeeded,
      'failed',        v_failed,
      'refunded',      v_refunded,
      'revenue_cents', v_revenue_cents
    ),
    'refund_rate', CASE
      WHEN v_succeeded = 0 THEN 0
      ELSE round(v_refunded::numeric / v_succeeded::numeric, 4)
    END,
    'provider_breakdown', (
      SELECT COALESCE(json_agg(row_to_json(p) ORDER BY p.revenue_cents DESC), '[]'::json)
      FROM (
        SELECT
          provider,
          COUNT(*) FILTER (WHERE status = 'succeeded')                        AS succeeded,
          COUNT(*) FILTER (WHERE status = 'failed')                           AS failed,
          COUNT(*) FILTER (WHERE status = 'refunded')                         AS refunded,
          COALESCE(SUM(charged_amount) FILTER (WHERE status = 'succeeded'), 0) AS revenue_cents
        FROM payment_results
        WHERE created_at >= p_start AND created_at < p_end
        GROUP BY provider
      ) p
    ),
    'daily_series', (
      SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.day), '[]'::json)
      FROM (
        SELECT
          to_char(days.day, 'YYYY-MM-DD')               AS day,
          COALESCE(agg.succeeded, 0)                    AS succeeded,
          COALESCE(agg.failed, 0)                       AS failed,
          COALESCE(agg.revenue_cents, 0)                AS revenue_cents
        FROM generate_series(
          date_trunc('day', p_start),
          date_trunc('day', p_end),
          interval '1 day'
        ) AS days(day)
        LEFT JOIN (
          SELECT
            date_trunc('day', created_at)                                        AS day,
            COUNT(*) FILTER (WHERE status = 'succeeded')                         AS succeeded,
            COUNT(*) FILTER (WHERE status = 'failed')                            AS failed,
            COALESCE(SUM(charged_amount) FILTER (WHERE status = 'succeeded'), 0) AS revenue_cents
          FROM payment_results
          WHERE created_at >= p_start AND created_at < p_end
          GROUP BY date_trunc('day', created_at)
        ) agg ON agg.day = days.day
      ) d
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_payment_trends(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_payment_trends(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- admin_audit_trends(p_start, p_end, ...): Failed-login burst detection for admin dashboard
--
-- SECURITY DEFINER: JWT guard is the only gate. auth_audit_logs happens to have an
-- admin RLS policy, but this function does not rely on it — same pattern as
-- admin_payment_trends so messaging aggregates can follow without an RLS policy.
--
-- Bursts (gaps-and-islands): a burst is a contiguous run of sign_in_failed rows
-- from one IP where no two consecutive attempts are more than p_burst_gap apart.
-- LAG finds gaps, cumulative SUM assigns a burst_id, GROUP BY (ip, burst_id)
-- collapses each run, HAVING count >= p_burst_min_attempts keeps the meaningful ones.
-- An IP that fails once on Monday and 12 times in a tight cluster on Friday yields
-- ONE burst (Friday), not a misleading 5-day span.
--
-- distinct_users disambiguates: 1 = targeted account, many = credential stuffing.
-- COUNT(DISTINCT user_id) ignores NULL, which is correct — failed logins against
-- unknown emails have user_id=NULL and shouldn't inflate the distinct count.
CREATE OR REPLACE FUNCTION admin_audit_trends(
  p_start              TIMESTAMPTZ DEFAULT (now() - interval '7 days'),
  p_end                TIMESTAMPTZ DEFAULT now(),
  p_burst_min_attempts INT         DEFAULT 5,
  p_burst_gap          INTERVAL    DEFAULT interval '10 minutes'
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failed    BIGINT;
  v_succeeded BIGINT;
  v_bursts    JSON;
BEGIN
  IF NOT is_admin() THEN  -- #240: live column authority (was: JWT claim)
    RETURN '{}'::json;
  END IF;

  -- Totals: single scan over the range, FILTER for multi-count
  SELECT
    COUNT(*) FILTER (WHERE event_type = 'sign_in_failed'),
    COUNT(*) FILTER (WHERE event_type IN ('sign_in', 'sign_in_success') AND success = TRUE)
  INTO v_failed, v_succeeded
  FROM auth_audit_logs
  WHERE created_at >= p_start AND created_at < p_end;

  -- Burst sessionization. The first row per IP has LAG=NULL → NULL > interval
  -- is NULL → CASE falls through to 0, so burst_id starts at 0 per IP. Correct.
  WITH failed AS (
    SELECT ip_address, user_id, created_at
    FROM auth_audit_logs
    WHERE event_type = 'sign_in_failed'
      AND ip_address IS NOT NULL
      AND created_at >= p_start AND created_at < p_end
  ),
  gapped AS (
    SELECT *,
      CASE
        WHEN created_at - LAG(created_at) OVER (
          PARTITION BY ip_address ORDER BY created_at
        ) > p_burst_gap
        THEN 1 ELSE 0
      END AS gap
    FROM failed
  ),
  bursted AS (
    SELECT *,
      SUM(gap) OVER (PARTITION BY ip_address ORDER BY created_at) AS burst_id
    FROM gapped
  )
  SELECT COALESCE(json_agg(row_to_json(b) ORDER BY b.attempts DESC), '[]'::json)
  INTO v_bursts
  FROM (
    SELECT
      host(ip_address)             AS ip_address,
      MIN(created_at)              AS first_seen,
      MAX(created_at)              AS last_seen,
      COUNT(*)::int                AS attempts,
      COUNT(DISTINCT user_id)::int AS distinct_users
    FROM bursted
    GROUP BY ip_address, burst_id
    HAVING COUNT(*) >= p_burst_min_attempts
  ) b;

  RETURN json_build_object(
    'range', json_build_object('start', p_start, 'end', p_end),
    'totals', json_build_object(
      'sign_in_failed',  v_failed,
      'sign_in_success', v_succeeded,
      'bursts',          COALESCE(json_array_length(v_bursts), 0)
    ),
    'bursts', v_bursts,
    'daily_series', (
      SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.day), '[]'::json)
      FROM (
        SELECT
          to_char(days.day, 'YYYY-MM-DD') AS day,
          COALESCE(agg.failed, 0)         AS failed,
          COALESCE(agg.succeeded, 0)      AS succeeded
        FROM generate_series(
          date_trunc('day', p_start),
          date_trunc('day', p_end),
          interval '1 day'
        ) AS days(day)
        LEFT JOIN (
          SELECT
            date_trunc('day', created_at)                                                           AS day,
            COUNT(*) FILTER (WHERE event_type = 'sign_in_failed')                                   AS failed,
            COUNT(*) FILTER (WHERE event_type IN ('sign_in', 'sign_in_success') AND success = TRUE) AS succeeded
          FROM auth_audit_logs
          WHERE created_at >= p_start AND created_at < p_end
          GROUP BY date_trunc('day', created_at)
        ) agg ON agg.day = days.day
      ) d
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_audit_trends(TIMESTAMPTZ, TIMESTAMPTZ, INT, INTERVAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_audit_trends(TIMESTAMPTZ, TIMESTAMPTZ, INT, INTERVAL) TO authenticated;

-- admin_messaging_trends(p_start, p_end, p_top_limit): Messaging volume for admin dashboard
--
-- SECURITY DEFINER: messages RLS is participant-only. Admin is not a
-- participant in most conversations, so counting rows at all requires
-- bypassing RLS. The JWT guard is the only gate.
--
-- THE ENCRYPTION BOUNDARY:
-- messages.encrypted_content and messages.initialization_vector are NEVER
-- named in this function. Column lists are explicit — no SELECT * anywhere.
-- conversation_id is also excluded from output: emitting {user_id,
-- conversation_id, count} would let an admin reconstruct the social graph
-- by correlating rows. {user_id, count} alone is traffic volume, not
-- who-talks-to-whom. Count and trend, not decrypt and display.
--
-- deleted messages are filtered out — a burst of sends-then-deletes is a
-- user decision we shouldn't surface as "volume" in the admin view.
--
-- daily_series is dense (generate_series spine, two LEFT JOINs) so the UI
-- gets a contiguous x-axis even on zero-traffic days.
CREATE OR REPLACE FUNCTION admin_messaging_trends(
  p_start     TIMESTAMPTZ DEFAULT now() - interval '7 days',
  p_end       TIMESTAMPTZ DEFAULT now(),
  p_top_limit INT         DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_messages       BIGINT;
  v_active_senders BIGINT;
  v_convs_created  BIGINT;
BEGIN
  IF NOT is_admin() THEN  -- #240: live column authority (was: JWT claim)
    RETURN '{}'::json;
  END IF;

  -- Message totals: one scan, two facts. Only sender_id/created_at/deleted
  -- touched — the ciphertext columns are not in this query at any layer.
  SELECT COUNT(*), COUNT(DISTINCT sender_id)
  INTO v_messages, v_active_senders
  FROM messages
  WHERE deleted = FALSE
    AND created_at >= p_start AND created_at < p_end;

  SELECT COUNT(*) INTO v_convs_created
  FROM conversations
  WHERE created_at >= p_start AND created_at < p_end;

  RETURN json_build_object(
    'range', json_build_object('start', p_start, 'end', p_end),
    'totals', json_build_object(
      'messages',              v_messages,
      'conversations_created', v_convs_created,
      'active_senders',        v_active_senders
    ),
    'daily_series', (
      SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.day), '[]'::json)
      FROM (
        SELECT
          to_char(days.day, 'YYYY-MM-DD')   AS day,
          COALESCE(m.messages, 0)           AS messages,
          COALESCE(c.conversations_created, 0) AS conversations_created
        FROM generate_series(
          date_trunc('day', p_start),
          date_trunc('day', p_end),
          interval '1 day'
        ) AS days(day)
        LEFT JOIN (
          SELECT date_trunc('day', created_at) AS day, COUNT(*) AS messages
          FROM messages
          WHERE deleted = FALSE
            AND created_at >= p_start AND created_at < p_end
          GROUP BY date_trunc('day', created_at)
        ) m ON m.day = days.day
        LEFT JOIN (
          SELECT date_trunc('day', created_at) AS day, COUNT(*) AS conversations_created
          FROM conversations
          WHERE created_at >= p_start AND created_at < p_end
          GROUP BY date_trunc('day', created_at)
        ) c ON c.day = days.day
      ) d
    ),
    'top_senders', (
      -- user_id + aggregate count only. No conversation_id, no recipient
      -- dimension. The admin sees WHO is noisy, not who they're noisy AT.
      SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
      FROM (
        SELECT
          msg.sender_id  AS user_id,
          p.username     AS username,
          p.display_name AS display_name,
          COUNT(*)::int  AS messages
        FROM messages msg
        JOIN user_profiles p ON p.id = msg.sender_id
        WHERE msg.deleted = FALSE
          AND msg.created_at >= p_start AND msg.created_at < p_end
          AND p.is_admin = FALSE
        GROUP BY msg.sender_id, p.username, p.display_name
        ORDER BY COUNT(*) DESC
        LIMIT p_top_limit
      ) s
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_messaging_trends(TIMESTAMPTZ, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_messaging_trends(TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;

-- admin_conversation_list(p_limit, p_offset): Per-conversation metadata
--
-- The trends RPC above deliberately omits conversation_id to prevent
-- social-graph reconstruction from {sender, conversation, count} tuples.
-- This function crosses that line on purpose — per-row drill-down is
-- needed to spot spam floods and dead channels — but holds a weaker
-- boundary: conversation_id + counts + timestamps, NO participant IDs,
-- NO group_name. The admin sees "conversation abc has 800 messages", not
-- "Alice and Bob have 800 messages".
--
-- participant_count: the check_group_participants constraint guarantees
-- both participant columns are NOT NULL for is_group=FALSE, so direct
-- chats are hard-coded to 2. Groups count active conversation_members.
--
-- message_count: non-deleted, non-system. 'member_joined' etc. are
-- protocol noise, not user traffic.
--
-- SECURITY DEFINER: conversations RLS is participant-only and admins are
-- not participants. Same JWT gate as the other admin functions. The
-- DEFINER privilege is spent only on the SELECTs below, which name
-- metadata columns explicitly — encrypted_content and
-- initialization_vector appear nowhere.
--
-- Returns {total, conversations[]} so the caller gets "showing N of M"
-- without a second round-trip. Same shape as admin_list_users.
CREATE OR REPLACE FUNCTION admin_conversation_list(
  p_limit  INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN  -- #240: live column authority (was: JWT claim)
    RETURN '{}'::json;
  END IF;

  RETURN json_build_object(
    'total', (SELECT COUNT(*) FROM conversations),
    'conversations', (
      SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json)
      FROM (
        SELECT
          conv.id                                         AS conversation_id,
          conv.is_group                                   AS is_group,
          CASE
            WHEN conv.is_group THEN COALESCE(cm.active_members, 0)::int
            ELSE 2
          END                                             AS participant_count,
          COALESCE(m.message_count, 0)::int               AS message_count,
          COALESCE(conv.last_message_at, conv.created_at) AS last_activity,
          conv.created_at                                 AS created_at
        FROM conversations conv
        LEFT JOIN (
          SELECT conversation_id, COUNT(*) AS message_count
          FROM messages
          WHERE deleted = FALSE AND is_system_message = FALSE
          GROUP BY conversation_id
        ) m ON m.conversation_id = conv.id
        LEFT JOIN (
          SELECT conversation_id, COUNT(*) AS active_members
          FROM conversation_members
          WHERE left_at IS NULL
          GROUP BY conversation_id
        ) cm ON cm.conversation_id = conv.id
        ORDER BY COALESCE(conv.last_message_at, conv.created_at) DESC
        LIMIT p_limit OFFSET p_offset
      ) c
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_conversation_list(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_conversation_list(INT, INT) TO authenticated;

-- admin_overview(p_start, p_end): Composite dashboard payload — one round-trip, all four domains
--
-- Calls the four existing *_stats() functions server-side rather than
-- re-aggregating. Those functions are SECURITY INVOKER, but auth.jwt()
-- reads from request context not function security mode, so their JWT
-- guards still gate correctly when called from inside this DEFINER body.
-- The win: when admin_payment_stats changes, the overview inherits it.
--
-- sparks: four integer arrays, one point per day in [v_start, v_end],
-- oldest → newest, zero-filled. Plain arrays (not [{day, value}] objects)
-- because the sparkline SVG index-maps x — it doesn't need the dates.
-- Default 7 ticks; a 30-day range produces 30-element arrays and the
-- Sparkline just draws a denser polyline. One generate_series spine,
-- four LEFT JOINs.
--
-- DEFINER because the messages spark crosses RLS. user_profiles spark
-- (signups) and payment_results spark would work under INVOKER with the
-- admin's RLS policies, but making the whole function DEFINER keeps the
-- composition uniform. The JWT check is the only gate.
--
-- DROP the zero-arg overload first. PG identifies functions by name+argtypes,
-- so CREATE OR REPLACE admin_overview(p_start, p_end) doesn't touch
-- admin_overview(). With both in pg_proc, PostgREST returns 300 Multiple
-- Choices when called with {} since both overloads satisfy all-defaults.
DROP FUNCTION IF EXISTS admin_overview();

CREATE OR REPLACE FUNCTION admin_overview(
  p_start TIMESTAMPTZ DEFAULT NULL,
  p_end   TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end   TIMESTAMPTZ;
BEGIN
  IF NOT is_admin() THEN  -- #240: live column authority (was: JWT claim)
    RETURN '{}'::json;
  END IF;

  -- Day-truncate whatever bounds we got so the spine walks whole days.
  -- NULL defaults COALESCE to the original [today-6, today] 7-tick window
  -- — NOT the *_trends pattern of now()-7d..now() which truncates to 8
  -- ticks depending on time-of-day. v_end resolves before v_start reads it.
  v_end   := date_trunc('day', COALESCE(p_end, now()));
  v_start := date_trunc('day', COALESCE(p_start, v_end - interval '6 days'));

  RETURN json_build_object(
    -- Echo the window the SQL actually used (post-COALESCE, post-trunc)
    -- so the UI knows what range it's showing when the caller omitted
    -- bounds. Same key as the *_trends RPCs.
    'range', json_build_object('start', v_start, 'end', v_end),

    'payments',  admin_payment_stats(),
    'auth',      admin_auth_stats(),
    'users',     admin_user_stats(),
    'messaging', admin_messaging_stats(),

    'sparks', (
      -- Half-open range on each subquery: [day, day+1). Next-day traffic
      -- doesn't bleed into today's bucket. ORDER BY days.day is load-bearing
      -- — json_agg without it would emit whatever hash order the joins land
      -- in and the sparkline would render scrambled.
      SELECT json_build_object(
        'payments', json_agg(COALESCE(p.n, 0)  ORDER BY days.day),
        'logins',   json_agg(COALESCE(a.n, 0)  ORDER BY days.day),
        'signups',  json_agg(COALESCE(u.n, 0)  ORDER BY days.day),
        'messages', json_agg(COALESCE(m.n, 0)  ORDER BY days.day)
      )
      FROM generate_series(v_start, v_end, interval '1 day') AS days(day)
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS n
        FROM payment_results
        WHERE status = 'succeeded'
          AND created_at >= v_start AND created_at < v_end + interval '1 day'
        GROUP BY 1
      ) p ON p.day = days.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS n
        FROM auth_audit_logs
        WHERE event_type IN ('sign_in', 'sign_in_success') AND success = TRUE
          AND created_at >= v_start AND created_at < v_end + interval '1 day'
        GROUP BY 1
      ) a ON a.day = days.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS n
        FROM user_profiles
        WHERE is_admin = FALSE
          AND created_at >= v_start AND created_at < v_end + interval '1 day'
        GROUP BY 1
      ) u ON u.day = days.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS n
        FROM messages
        WHERE deleted = FALSE
          AND created_at >= v_start AND created_at < v_end + interval '1 day'
        GROUP BY 1
      ) m ON m.day = days.day
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_overview(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_overview(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- PART 7: GRANT PERMISSIONS
-- ============================================================================

-- Authenticated users

-- NO `UPDATE` ON payment_intents, and the REVOKE is deliberate (#565).
--
-- The "Payment intents are immutable" policy above is `FOR UPDATE USING (false)`,
-- so an UPDATE grant here can never be exercised by anyone. It read as a live
-- capability and was not one — which is the category of thing that misleads the
-- next reader about what the security posture actually is.
--
-- The REVOKE matters as much as dropping it from the GRANT: this file is
-- re-runnable against an EXISTING database, and simply narrowing the GRANT would
-- leave the privilege in place on every database that already ran the old line.
-- Correcting the file without correcting the databases it already provisioned is
-- the "a migration file is not a migration" trap CLAUDE.md records.
GRANT SELECT, INSERT ON payment_intents TO authenticated;
-- #897: the GRANT above describes the INTENT, never the effective state. Supabase's
-- platform defaults hand `anon` and `authenticated` ALL privileges on every table in
-- `public`, granted by the platform rather than by this file, so a narrower GRANT here
-- adds nothing and removes nothing. Measured on production 2026-08-21, BOTH roles held
-- DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE and UPDATE.
--
-- Every privilege revoked below was already unusable, which is exactly why it had to go:
--   UPDATE / DELETE       RLS policies are USING (false) for PUBLIC — never succeeded
--   TRUNCATE              not RLS-gated, but PostgREST does not expose it
--   TRIGGER / REFERENCES  DDL privileges no application role uses
--   anon INSERT           WITH CHECK (auth.uid() = template_user_id); anon has no uid
--
-- #565 made this argument for `authenticated`'s UPDATE and acted on it. It stopped one
-- role short, and — because a migration file is not a migration — the revoke it wrote
-- had still not reached production three weeks later. Both were executed against prod
-- via the Management API on 2026-08-21; these lines are what a FRESH database gets.
-- `tests/rls/payment-intents-grants.test.ts` asserts the effective grants rather than
-- trusting these lines, since trusting the file is what hid this for so long.
REVOKE UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON payment_intents FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON payment_intents FROM anon;
GRANT SELECT ON payment_results TO authenticated;
GRANT SELECT, INSERT, UPDATE ON subscriptions TO authenticated;
GRANT SELECT ON payment_provider_config TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;
GRANT SELECT, INSERT ON auth_audit_logs TO authenticated;
GRANT SELECT ON products TO authenticated;
GRANT SELECT ON orders TO authenticated;

-- Anonymous visitors browsing /pricing before any sign-in. RLS alone is not
-- enough: a policy says WHICH rows, a grant says whether the role may touch the
-- table at all. There is no other GRANT ... TO anon in this file, so this is
-- deliberate and narrow — SELECT on the catalog, nothing else.
GRANT SELECT ON products TO anon;

-- Service role (full access)
GRANT ALL ON payment_intents TO service_role;
GRANT ALL ON payment_results TO service_role;
GRANT ALL ON subscriptions TO service_role;
GRANT ALL ON webhook_events TO service_role;
GRANT ALL ON payment_provider_config TO service_role;
GRANT ALL ON user_profiles TO service_role;
GRANT ALL ON auth_audit_logs TO service_role;
GRANT ALL ON products TO service_role;
GRANT ALL ON orders TO service_role;

-- ============================================================================
-- PART 8: SEED TEST USER (Primary)
-- ============================================================================
-- Creates: test@example.com / TestPassword123!
-- Email is already confirmed (bypasses verification requirement)
-- Note: User was deleted at start of script for idempotency
--
-- Local-profile caveat: this whole block is wrapped in a DO/EXCEPTION guard.
-- On Supabase Cloud it runs exactly as before -- nothing throws, the handler
-- never fires. On a fresh local initdb it soft-skips, because at this point
-- in the boot GoTrue has not yet connected and run its ~40 numbered runtime
-- migrations. Two things are missing that this INSERT needs:
--
--   (1) auth.users.email_confirmed_at and .email_change_token_new -- the base
--       image ships the original 2016-era column names (confirmed_at,
--       email_change_token). GoTrue's migrations rename/add these later.
--   (2) auth.identities -- the whole table. Zero hits for "identities" in the
--       base image's initdb.d/. GoTrue creates it on first connect.
--
-- Unlike the storage.buckets and auth.jwt() forward-fills elsewhere in this
-- file, forward-filling here would BREAK GoTrue: its numbered migrations are
-- tracked in auth.schema_migrations and have no IF NOT EXISTS guards, so a
-- pre-existing email_confirmed_at column or identities table makes GoTrue's
-- own ADD COLUMN / CREATE TABLE crash on 42701/42P07. The DO/EXCEPTION wrap
-- is the only shape that is a no-op in both directions.
--
-- Local seeding is handled post-boot by scripts/seed-test-users.ts via the
-- admin API, after GoTrue has migrated itself. Nothing is lost.

DO $seed_test_user$
BEGIN
  -- Create the user in auth.users with confirmed email
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  )
  VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'test@example.com',
    crypt('TestPassword123!', gen_salt('bf')),  -- Hashed password using bcrypt
    now(),  -- Email already confirmed
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    ''
  );

  -- Create identity record (required for Supabase Auth)
  INSERT INTO auth.identities (
    provider_id,
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  SELECT
    id,
    gen_random_uuid(),
    id,
    jsonb_build_object('sub', id::text, 'email', email),
    'email',
    now(),
    now(),
    now()
  FROM auth.users
  WHERE email = 'test@example.com';

EXCEPTION
  WHEN undefined_column OR undefined_table THEN
    RAISE NOTICE
      'Skipping test-user seed (GoTrue has not migrated auth schema yet: %). '
      'On the local profile this is expected -- run scripts/seed-test-users.ts '
      'after the stack is healthy.', SQLERRM;
END
$seed_test_user$;

-- ============================================================================
-- PART 9: USER MESSAGING SYSTEM (PRP-023)
-- ============================================================================
-- End-to-end encrypted messaging with friend requests
-- Features: Zero-knowledge E2E encryption, real-time delivery, typing indicators
-- Tables: 6 (user_connections, conversations, messages, user_encryption_keys, conversation_keys, typing_indicators)

-- Table 1: user_connections (Friend requests)
CREATE TABLE IF NOT EXISTS user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_connection CHECK (requester_id != addressee_id),
  CONSTRAINT unique_connection UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_user_connections_requester ON user_connections(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_user_connections_addressee ON user_connections(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_user_connections_status ON user_connections(status);

ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own connections" ON user_connections;
CREATE POLICY "Users can view own connections" ON user_connections
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "Users can create friend requests" ON user_connections;
CREATE POLICY "Users can create friend requests" ON user_connections
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Addressee can update connection status" ON user_connections;
CREATE POLICY "Addressee can update connection status" ON user_connections
  FOR UPDATE USING (auth.uid() = addressee_id) WITH CHECK (auth.uid() = addressee_id);

DROP POLICY IF EXISTS "Users can delete own sent requests" ON user_connections;
CREATE POLICY "Users can delete own sent requests" ON user_connections
  FOR DELETE USING (auth.uid() = requester_id AND status = 'pending');

COMMENT ON TABLE user_connections IS 'Friend request management with status tracking';

-- Table 2: conversations (1-to-1 chats)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  archived_by_participant_1 BOOLEAN NOT NULL DEFAULT FALSE,
  archived_by_participant_2 BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_conversation CHECK (participant_1_id != participant_2_id),
  CONSTRAINT canonical_ordering CHECK (participant_1_id < participant_2_id),
  CONSTRAINT unique_conversation UNIQUE (participant_1_id, participant_2_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_participant_1 ON conversations(participant_1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2 ON conversations(participant_2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(participant_1_id, archived_by_participant_1, participant_2_id, archived_by_participant_2);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

DROP POLICY IF EXISTS "Users can create conversations with connections" ON conversations;
CREATE POLICY "Users can create conversations with connections" ON conversations
  FOR INSERT WITH CHECK (
    (auth.uid() = participant_1_id OR auth.uid() = participant_2_id) AND
    EXISTS (
      SELECT 1 FROM user_connections
      WHERE status = 'accepted' AND (
        (requester_id = participant_1_id AND addressee_id = participant_2_id) OR
        (requester_id = participant_2_id AND addressee_id = participant_1_id)
      )
    )
  );

-- Admin can create conversations with any user (Feature 002 - welcome messages)
DROP POLICY IF EXISTS "Admin can create any conversation" ON conversations;
CREATE POLICY "Admin can create any conversation" ON conversations
  FOR INSERT WITH CHECK (
    auth.uid() = '00000000-0000-0000-0000-000000000001'::uuid
  );

-- Users can create conversations with admin for welcome messages (Feature 004)
-- This allows the client-side welcome service to create the conversation
DROP POLICY IF EXISTS "Users can create conversation with admin" ON conversations;
CREATE POLICY "Users can create conversation with admin" ON conversations
  FOR INSERT WITH CHECK (
    (auth.uid() = participant_1_id OR auth.uid() = participant_2_id) AND
    (participant_1_id = '00000000-0000-0000-0000-000000000001'::uuid OR
     participant_2_id = '00000000-0000-0000-0000-000000000001'::uuid)
  );

DROP POLICY IF EXISTS "System can update last_message_at" ON conversations;
CREATE POLICY "System can update last_message_at" ON conversations
  FOR UPDATE TO service_role USING (true);

-- Allow users to archive/unarchive their own conversations
DROP POLICY IF EXISTS "Users can update own conversation archive status" ON conversations;
CREATE POLICY "Users can update own conversation archive status" ON conversations
  FOR UPDATE USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id)
  WITH CHECK (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

COMMENT ON TABLE conversations IS '1-to-1 conversations with canonical ordering';

-- Table 3: messages (Encrypted content)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,
  initialization_vector TEXT NOT NULL,
  sequence_number BIGINT NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT false,
  edited BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Note: sender_is_participant validation enforced by RLS policy, not CHECK constraint
  -- (PostgreSQL doesn't allow subqueries in CHECK constraints)
  CONSTRAINT unique_sequence UNIQUE (conversation_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, sequence_number DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(read_at) WHERE read_at IS NULL;

-- #245: exactly-once delivery for the offline queue. A message queued offline is
-- flushed on reconnect; because the queued row carried no server-visible dedupe
-- key, every reconnect (online / visibilitychange / focus / poll / mount, and
-- any flush that inserted server-side but died before writing synced:1 locally)
-- re-inserted a fresh row → the recipient saw the message 2-3×. The client
-- already mints a stable UUID at enqueue; carry it as client_generated_id and
-- make the flush an upsert(onConflict=client_generated_id, ignoreDuplicates) so
-- a replay is a no-op. A PLAIN (non-partial) unique index: Postgres treats NULLs
-- as distinct, so the many live sends that leave client_generated_id NULL all
-- coexist, while non-NULL keys dedupe. (A PARTIAL index would NOT work — an
-- `ON CONFLICT (client_generated_id)` inference can't match a partial index's
-- predicate, so supabase-js's upsert(onConflict) would error 42P10.)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_generated_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_messages_client_generated_id
  ON messages(client_generated_id);
COMMENT ON COLUMN messages.client_generated_id IS
  'Client-minted idempotency key for offline-queue replays (#245); NULL for live sends. Deduped by uniq_messages_client_generated_id.';

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages in own conversations" ON messages;
CREATE POLICY "Users can view messages in own conversations" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can send messages to own conversations" ON messages;
CREATE POLICY "Users can send messages to own conversations" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
  );

-- Users can insert welcome messages from admin (Feature 004)
-- Allows client-side welcome service to insert message with sender_id = admin
-- Only allowed in conversations where user is a participant with admin
DROP POLICY IF EXISTS "Users can insert welcome message from admin" ON messages;
CREATE POLICY "Users can insert welcome message from admin" ON messages
  FOR INSERT WITH CHECK (
    sender_id = '00000000-0000-0000-0000-000000000001'::uuid AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id AND (
        (conversations.participant_1_id = auth.uid() AND
         conversations.participant_2_id = '00000000-0000-0000-0000-000000000001'::uuid) OR
        (conversations.participant_2_id = auth.uid() AND
         conversations.participant_1_id = '00000000-0000-0000-0000-000000000001'::uuid)
      )
    )
  );

DROP POLICY IF EXISTS "Users can edit own messages" ON messages;
CREATE POLICY "Users can edit own messages" ON messages
  FOR UPDATE USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() AND created_at > now() - INTERVAL '15 minutes');

-- Allow recipients to mark messages as read (update read_at field)
-- This is separate from edit policy because recipients need to update messages they didn't send
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON messages;
CREATE POLICY "Recipients can mark messages as read" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
    AND sender_id != auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
    AND sender_id != auth.uid()
  );

DROP POLICY IF EXISTS "Users cannot delete messages" ON messages;
CREATE POLICY "Users cannot delete messages" ON messages
  FOR DELETE USING (false);

-- Admin dashboard read-only policies for the three messaging tables. These
-- belong semantically with the other admin policies up in PART 7 (~line 608)
-- but can't live there: user_connections / conversations / messages are
-- forward references until this point. On Cloud nobody noticed because the
-- tables persist across re-runs; on a fresh local initdb this was crash #3.
DROP POLICY IF EXISTS "Admin can view all connections" ON user_connections;
CREATE POLICY "Admin can view all connections" ON user_connections
  FOR SELECT USING (
    is_admin()  -- #240: live column authority (was: JWT claim, which could drift/linger)
  );

DROP POLICY IF EXISTS "Admin can view conversation metadata" ON conversations;
CREATE POLICY "Admin can view conversation metadata" ON conversations
  FOR SELECT USING (
    is_admin()  -- #240: live column authority (was: JWT claim, which could drift/linger)
  );

DROP POLICY IF EXISTS "Admin can view message metadata" ON messages;
CREATE POLICY "Admin can view message metadata" ON messages
  FOR SELECT USING (
    is_admin()  -- #240: live column authority (was: JWT claim, which could drift/linger)
  );

COMMENT ON TABLE messages IS 'E2E encrypted messages with 15-minute edit window';

-- Table 4: user_encryption_keys (Public ECDH keys + password-derived salt)
-- encryption_salt: Base64-encoded 16-byte Argon2 salt for password-derived keys
-- NULL salt indicates legacy random-generated keys requiring migration (Feature 032)
CREATE TABLE IF NOT EXISTS user_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  public_key JSONB NOT NULL,
  encryption_salt TEXT, -- Base64 Argon2 salt (NULL = legacy keys)
  device_id TEXT,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_encryption_keys_user ON user_encryption_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_encryption_keys_active ON user_encryption_keys(user_id, revoked, expires_at)
  WHERE revoked = false;
CREATE INDEX IF NOT EXISTS idx_user_encryption_keys_salt ON user_encryption_keys(user_id)
  WHERE encryption_salt IS NOT NULL;

ALTER TABLE user_encryption_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view public keys" ON user_encryption_keys;
CREATE POLICY "Anyone can view public keys" ON user_encryption_keys
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create own keys" ON user_encryption_keys;
CREATE POLICY "Users can create own keys" ON user_encryption_keys
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can revoke own keys" ON user_encryption_keys;
CREATE POLICY "Users can revoke own keys" ON user_encryption_keys
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users cannot delete keys" ON user_encryption_keys;
CREATE POLICY "Users cannot delete keys" ON user_encryption_keys
  FOR DELETE USING (false);

COMMENT ON TABLE user_encryption_keys IS 'Public ECDH keys - private keys NEVER in database';

-- Table 5: conversation_keys (Encrypted shared secrets)
CREATE TABLE IF NOT EXISTS conversation_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_shared_secret TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_conversation_user_version UNIQUE (conversation_id, user_id, key_version)
);

CREATE INDEX IF NOT EXISTS idx_conversation_keys_conversation ON conversation_keys(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_keys_user ON conversation_keys(user_id);

ALTER TABLE conversation_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversation keys" ON conversation_keys;
CREATE POLICY "Users can view own conversation keys" ON conversation_keys
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create conversation keys" ON conversation_keys;
CREATE POLICY "Users can create conversation keys" ON conversation_keys
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users cannot update keys" ON conversation_keys;
CREATE POLICY "Users cannot update keys" ON conversation_keys
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Users cannot delete keys" ON conversation_keys;
CREATE POLICY "Users cannot delete keys" ON conversation_keys
  FOR DELETE USING (false);

COMMENT ON TABLE conversation_keys IS 'Immutable encrypted shared secrets';

-- Table 6: typing_indicators (Real-time typing status)
CREATE TABLE IF NOT EXISTS typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  is_typing BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_conversation_user UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_typing_indicators_conversation ON typing_indicators(conversation_id, updated_at DESC);

ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view typing in own conversations" ON typing_indicators;
CREATE POLICY "Users can view typing in own conversations" ON typing_indicators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = typing_indicators.conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own typing status" ON typing_indicators;
CREATE POLICY "Users can insert own typing status" ON typing_indicators
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own typing status" ON typing_indicators;
CREATE POLICY "Users can update own typing status" ON typing_indicators
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "System can clean up old indicators" ON typing_indicators;
CREATE POLICY "System can clean up old indicators" ON typing_indicators
  FOR DELETE TO service_role USING (updated_at < now() - INTERVAL '5 seconds');

COMMENT ON TABLE typing_indicators IS 'Real-time typing with auto-expire after 5 seconds';

-- Messaging Triggers
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_inserted ON messages;
CREATE TRIGGER on_message_inserted
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();

CREATE OR REPLACE FUNCTION assign_sequence_number()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE next_seq BIGINT;
BEGIN
  -- #244: serialize sequence assignment PER CONVERSATION. The plain MAX+1 below
  -- is a read-modify-write: two concurrent inserts into the same conversation
  -- both read the same MAX, compute the same next_seq, and the loser violates
  -- unique_sequence (23505) — the message is dropped, and a client retry just
  -- re-enters this same race. A transaction-scoped advisory lock keyed on the
  -- conversation makes the MAX+1 atomic: the second insert BLOCKS (not errors)
  -- until the first commits, then reads the now-correct MAX. Auto-released at
  -- COMMIT/ROLLBACK — no unlock bookkeeping, no leak on error.
  --
  -- Key: two int4s carved from the conversation UUID's hex, using the
  -- pg_advisory_xact_lock(int4,int4) overload (a distinct lock space from the
  -- single-bigint form). Effective entropy ~60 bits (a UUID-v4 has a fixed
  -- version nibble inside the first 16 hex chars) — a cross-conversation key
  -- collision only makes two UNRELATED conversations briefly serialize (benign,
  -- vanishingly rare: ~C^2/2^61), never a wrong sequence. Only same-conversation
  -- inserts actually contend, which is exactly what we want.
  PERFORM pg_advisory_xact_lock(
    ('x' || substr(replace(NEW.conversation_id::text, '-', ''), 1, 8))::bit(32)::int,
    ('x' || substr(replace(NEW.conversation_id::text, '-', ''), 9, 8))::bit(32)::int
  );

  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO next_seq
  FROM messages WHERE conversation_id = NEW.conversation_id;
  NEW.sequence_number := next_seq;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_message_insert ON messages;
CREATE TRIGGER before_message_insert
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION assign_sequence_number();

COMMENT ON FUNCTION update_conversation_timestamp() IS 'Auto-update conversation.last_message_at';
COMMENT ON FUNCTION assign_sequence_number() IS 'Auto-increment message sequence numbers';

-- ============================================================================
-- #281: Column-level UPDATE guard on public.messages (BEFORE UPDATE row trigger)
-- ----------------------------------------------------------------------------
-- RLS gates ROWS, not COLUMNS. The two permissive UPDATE policies on messages
-- ("Users can edit own messages" + "Recipients can mark messages as read")
-- OR-combine, and authenticated/anon hold table-level UPDATE with no column
-- grants. So a non-sender participant who satisfies the mark-read policy could
-- rewrite ANY column (ciphertext, IV, key_version, edited, deleted) — forging
-- another user's message. Reproduced live with a raw anon client (#281). This
-- trigger enforces the column-level contract RLS structurally cannot express;
-- the two RLS policies stay unchanged (they still gate rows + the 15-min edit
-- window in "Users can edit own messages" WITH CHECK — do NOT delete them).
--
-- EXEMPTION (verified live): auth.uid()/auth.role() read the request.jwt.claims
-- GUC, which SURVIVES unchanged into a SECURITY DEFINER body — DEFINER swaps the
-- executing ROLE, not the request GUC. So an authenticated end-user ALWAYS has a
-- non-null uid here; "auth.uid() IS NULL" alone is NOT a system-context signal.
-- We exempt ONLY when uid IS NULL *and* the role is a trusted service/system role
-- (or absent) — a combination reachable solely by service_role and no-JWT admin
-- contexts, never by an authenticated or anon attacker (who always carries a sub,
-- so a forged "role":"service_role" claim can never reach the early return).
--
-- Idempotent (CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS + CREATE
-- TRIGGER); mirrors the assign_sequence_number() house pattern.
-- ============================================================================
CREATE OR REPLACE FUNCTION enforce_message_update_columns()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid  uuid := auth.uid();   -- JWT sub; NULL only when no sub claim is present
  v_role text := auth.role();  -- JWT role; NULL when no role claim is present
BEGIN
  -- Privileged/system contexts bypass RLS entirely; let them bypass this guard
  -- too. Requires BOTH a NULL uid AND a trusted role (or no role) so a real
  -- end-user who forges "role":"service_role" (still carrying their sub) can
  -- NEVER reach this early return.
  IF v_uid IS NULL
     AND (v_role IS NULL
          OR v_role IN ('service_role', 'supabase_admin', 'supabase_auth_admin', 'postgres'))
  THEN
    RETURN NEW;
  END IF;

  -- Structurally-immutable columns: NO end-user (sender OR recipient) may ever
  -- change these. IS DISTINCT FROM is NULL-safe. No legit app UPDATE writes them.
  IF NEW.id                  IS DISTINCT FROM OLD.id
     OR NEW.conversation_id     IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id           IS DISTINCT FROM OLD.sender_id
     OR NEW.created_at          IS DISTINCT FROM OLD.created_at
     OR NEW.sequence_number     IS DISTINCT FROM OLD.sequence_number
     OR NEW.client_generated_id IS DISTINCT FROM OLD.client_generated_id
     OR NEW.is_system_message   IS DISTINCT FROM OLD.is_system_message
     OR NEW.system_message_type IS DISTINCT FROM OLD.system_message_type
  THEN
    RAISE EXCEPTION
      'messages: immutable column changed (id/conversation_id/sender_id/created_at/sequence_number/client_generated_id/system flags)'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  -- SENDER path: may change content columns. The 15-minute window (C10) stays
  -- enforced by the unchanged "Users can edit own messages" WITH CHECK.
  IF v_uid = OLD.sender_id THEN
    RETURN NEW;
  END IF;

  -- NON-SENDER (recipient) path: may change ONLY read_at and/or delivered_at.
  IF NEW.encrypted_content       IS DISTINCT FROM OLD.encrypted_content
     OR NEW.initialization_vector IS DISTINCT FROM OLD.initialization_vector
     OR NEW.key_version           IS DISTINCT FROM OLD.key_version
     OR NEW.edited                IS DISTINCT FROM OLD.edited
     OR NEW.edited_at             IS DISTINCT FROM OLD.edited_at
     OR NEW.deleted               IS DISTINCT FROM OLD.deleted
  THEN
    RAISE EXCEPTION
      'messages: non-sender may update only read_at/delivered_at (#281)'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION enforce_message_update_columns() IS
  '#281: column-level UPDATE guard. RLS gates rows not columns and the two permissive UPDATE policies OR-combine, so a non-sender participant could rewrite ciphertext. Non-senders may change only read_at/delivered_at; nobody may change immutable id/conversation_id/sender_id/created_at/sequence_number/client_generated_id/system flags; exempt only when auth.uid() IS NULL AND role is service/admin (never an authenticated or anon attacker, since they always carry a JWT sub).';

DROP TRIGGER IF EXISTS before_message_update_column_guard ON messages;
CREATE TRIGGER before_message_update_column_guard
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION enforce_message_update_columns();

-- Grant permissions for messaging tables
GRANT ALL ON user_connections TO authenticated, service_role;
GRANT ALL ON conversations TO authenticated, service_role;
GRANT ALL ON messages TO authenticated, service_role;
GRANT ALL ON user_encryption_keys TO authenticated, service_role;
GRANT ALL ON conversation_keys TO authenticated, service_role;
GRANT ALL ON typing_indicators TO authenticated, service_role;

-- ── Least-privilege role for the .NET messaging backend (#321) ──────────────
-- The ASP.NET Core backend (dotnet-messaging/) must connect as a NON-superuser,
-- NON-owner role so RLS + the #281 column-guard trigger apply as a live backstop
-- behind its C# checks (the postgres superuser/owner bypasses both, which is why
-- the C# checks were previously the sole guard). Per request it runs
-- `SET LOCAL ROLE authenticated` + sets request.jwt.claims (the PostgREST model),
-- so auth.uid() resolves in-DB and the participant-scoped RLS policies + the
-- trigger enforce. It is granted ONLY `authenticated` (NOT service_role), so it
-- cannot SET ROLE into a BYPASSRLS role. NOINHERIT so it gains authenticated's
-- privileges only via the explicit per-request SET ROLE. The password is set
-- per-environment (docker/supabase/roles.sql locally; injected in prod) — never
-- committed here.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dotnet_app') THEN
    CREATE ROLE dotnet_app LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
GRANT authenticated TO dotnet_app;

-- ============================================================================
-- PART 10.5: GROUP CHAT SUPPORT (Feature 010)
-- ============================================================================
-- Symmetric key encryption for group messages
-- Features: Up to 200 members, key versioning, history restriction, key rotation
-- Tables modified: conversations, messages
-- Tables new: conversation_members, group_keys

-- T006: Add group columns to conversations table
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS group_name TEXT CHECK (length(group_name) <= 100),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS current_key_version INTEGER NOT NULL DEFAULT 1;

-- Make participant columns nullable for groups (they must be NULL for is_group=true)
ALTER TABLE conversations
  ALTER COLUMN participant_1_id DROP NOT NULL,
  ALTER COLUMN participant_2_id DROP NOT NULL;

-- CHK023: Enforce is_group validation via CHECK constraint
-- Drop existing constraint if it exists (for idempotency)
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS check_group_participants;
ALTER TABLE conversations ADD CONSTRAINT check_group_participants CHECK (
  (is_group = false AND participant_1_id IS NOT NULL AND participant_2_id IS NOT NULL)
  OR
  -- #247: created_by may be NULL for a group whose creator has been deleted
  -- (right-to-erasure). The group survives for its remaining members; the
  -- creator FK is SET NULL below rather than blocking the delete. RLS access
  -- to such a group falls back to membership (is_conversation_member), so a
  -- null creator never locks members out.
  (is_group = true AND participant_1_id IS NULL AND participant_2_id IS NULL)
);

-- #247: account deletion was BLOCKED for any user who created a group or
-- distributed group keys, because conversations.created_by and
-- group_keys.created_by were ON DELETE NO ACTION (the default) — a
-- right-to-erasure request could not be fulfilled. Re-point both FKs to
-- ON DELETE SET NULL: deleting the creator preserves the group and every
-- OTHER member's key rows (created_by is only an audit pointer), while the
-- rest of the user's data still cascades away via the CASCADE FKs
-- (participant_*, user_id, sender_id). SET NULL (not CASCADE) is deliberate —
-- CASCADE on created_by would delete other members' group_keys and destroy the
-- group for everyone. Idempotent: drop the NO-ACTION constraint, re-add as SET NULL.
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_created_by_fkey;
ALTER TABLE conversations
  ADD CONSTRAINT conversations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL;

-- T007: Add key_version column to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS key_version INTEGER NOT NULL DEFAULT 1;

-- T008: Add system message columns to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_system_message BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS system_message_type TEXT;

-- CHK027: Validate system_message_type enum values
ALTER TABLE messages DROP CONSTRAINT IF EXISTS check_system_message_type;
ALTER TABLE messages ADD CONSTRAINT check_system_message_type CHECK (
  system_message_type IS NULL
  OR system_message_type IN (
    'member_joined',
    'member_left',
    'member_removed',
    'group_created',
    'group_renamed',
    'ownership_transferred'
  )
);

-- T009: Create conversation_members junction table
CREATE TABLE IF NOT EXISTS conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  key_version_joined INTEGER NOT NULL DEFAULT 1,
  key_status TEXT NOT NULL DEFAULT 'active' CHECK (key_status IN ('active', 'pending')),
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  muted BOOLEAN NOT NULL DEFAULT FALSE
);

-- CHK025: Unique active membership per user per conversation
-- This constraint allows same user_id + conversation_id only if one has left_at set
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_membership
  ON conversation_members(conversation_id, user_id) WHERE left_at IS NULL;

-- #247: prevent OWNER-LESS orphaned groups. When #247 made account deletion
-- possible for group creators, a new hole opened: deleting a group's sole owner
-- cascade-deletes their conversation_members row (user_id FK is ON DELETE
-- CASCADE), leaving the group with surviving members but NO owner. Every
-- owner-gated op (rename / remove-member / delete-group / transfer-ownership,
-- all gated on role='owner' in group-service.ts) then fails for every survivor,
-- and ownership can never be re-established — the group is permanently stuck.
-- The app's leaveGroup() blocks a sole owner from leaving without transferring,
-- but a raw `DELETE FROM user_profiles` (the erasure path, gdpr-service.ts:437)
-- bypasses that guard. Enforce the invariant at the DB layer so EVERY deletion
-- path is covered: when an active owner's membership row is removed, if the
-- group still has other active members and no other active owner, promote the
-- earliest-joined survivor to owner.
CREATE OR REPLACE FUNCTION reassign_group_owner_on_member_removal()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only act when an ACTIVE OWNER is leaving (hard delete OR soft-leave).
  IF OLD.role <> 'owner' OR OLD.left_at IS NOT NULL THEN
    RETURN OLD;
  END IF;

  -- If another active owner still exists, nothing to do.
  IF EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = OLD.conversation_id
      AND user_id <> OLD.user_id
      AND role = 'owner'
      AND left_at IS NULL
  ) THEN
    RETURN OLD;
  END IF;

  -- Promote the earliest-joined remaining active member (if any).
  UPDATE conversation_members
  SET role = 'owner'
  WHERE id = (
    SELECT id FROM conversation_members
    WHERE conversation_id = OLD.conversation_id
      AND user_id <> OLD.user_id
      AND left_at IS NULL
    ORDER BY joined_at ASC, id ASC
    LIMIT 1
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS before_owner_membership_removed ON conversation_members;
CREATE TRIGGER before_owner_membership_removed
  BEFORE DELETE ON conversation_members
  FOR EACH ROW EXECUTE FUNCTION reassign_group_owner_on_member_removal();

-- T010: Create group_keys table
CREATE TABLE IF NOT EXISTS group_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  key_version INTEGER NOT NULL DEFAULT 1,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- #247: nullable on fresh DBs; the created_by FK is SET NULL (see below) so a
  -- creator can be erased without deleting other members' key rows.
  created_by UUID REFERENCES user_profiles(id),
  CONSTRAINT unique_group_key_version UNIQUE (conversation_id, user_id, key_version)
);

-- #247: on EXISTING DBs the created_by column is NOT NULL + the FK is NO ACTION,
-- which blocks erasing a user who distributed group keys. Make it nullable and
-- re-point the FK to ON DELETE SET NULL so deleting the distributor nulls only
-- the audit pointer and preserves every member's key row (the group keeps
-- working). Idempotent.
ALTER TABLE group_keys ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE group_keys DROP CONSTRAINT IF EXISTS group_keys_created_by_fkey;
ALTER TABLE group_keys
  ADD CONSTRAINT group_keys_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL;

-- #243: the group key is ECDH-wrapped using the creator's key pair at wrap time.
-- Unwrapping requires the creator's public key FROM THAT MOMENT — but the reader
-- used getUserPublicKey (current, non-revoked) key, so once the creator rotated
-- their personal keys the ECDH secret no longer matched and group history bricked
-- for EVERY member ("Encrypted with previous keys"). Capture the creator's public
-- JWK on the row at wrap time and unwrap against it. Nullable: legacy rows (and
-- any where created_by was later SET NULL by #247 erasure) fall back to a
-- time-window resolver over the retained key history. A one-shot backfill
-- (run via the Management API, since the "Keys are immutable" UPDATE policy
-- blocks client updates) repairs already-bricked rows.
ALTER TABLE group_keys ADD COLUMN IF NOT EXISTS creator_public_key JSONB;
COMMENT ON COLUMN group_keys.creator_public_key IS
  'Public ECDH JWK of created_by at wrap time; unwrap against THIS, not the creator''s current (possibly rotated) key (#243). Nullable for legacy rows.';

-- T011: Add indexes for conversation_members and group_keys tables
-- CHK026: Indexes for fast member list lookup
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation
  ON conversation_members(conversation_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_members_user
  ON conversation_members(user_id) WHERE left_at IS NULL;

-- Indexes for group_keys
CREATE INDEX IF NOT EXISTS idx_group_keys_conversation
  ON group_keys(conversation_id, key_version DESC);
CREATE INDEX IF NOT EXISTS idx_group_keys_user
  ON group_keys(user_id, conversation_id);

-- T012: Enable RLS on conversation_members and group_keys tables
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_keys ENABLE ROW LEVEL SECURITY;

-- T013: RLS policies for conversation_members

-- FIX: Create SECURITY DEFINER function to check membership without triggering RLS
-- This prevents infinite recursion when RLS policies query conversation_members
CREATE OR REPLACE FUNCTION is_conversation_member(conv_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = conv_id
      AND user_id = check_user_id
      AND left_at IS NULL
  );
$$;

-- FIX: Check if user is owner of conversation (for permission checks)
CREATE OR REPLACE FUNCTION is_conversation_owner(conv_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = conv_id
      AND user_id = check_user_id
      AND role = 'owner'
      AND left_at IS NULL
  );
$$;

-- SECURITY (#34): check whether a user CREATED a conversation, reading
-- conversations.created_by directly. SECURITY DEFINER because the
-- conversations SELECT policy only exposes 1-to-1 participant rows, so a
-- group's creator cannot see their own group row through RLS — an inline
-- EXISTS sub-select against conversations returns nothing for a group and
-- would wrongly reject the creator. This helper is the creator-scoped
-- counterpart to is_conversation_member(), and unlike is_conversation_owner()
-- it does not depend on a membership row existing yet, so it also authorizes
-- the very first owner-row insert during group creation.
CREATE OR REPLACE FUNCTION is_conversation_creator(conv_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = conv_id
      AND created_by = check_user_id
  );
$$;

-- Group-conversation policies RELOCATED here from the 1:1 conversations policy
-- block (#286). They reference is_group / created_by (added to conversations
-- below the base table) and is_conversation_member() (defined just above), so
-- on a fresh single-transaction init they must run AFTER those definitions, not
-- alongside the other conversations policies. The "1:1 policies earlier" they
-- mention are the participant-based SELECT/INSERT policies before the base table.

-- Users can view GROUP conversations they belong to (Feature 010 / #182).
-- Access = the creator OR any member. The `created_by` clause is load-bearing
-- for createGroup(): its INSERT ... RETURNING reads the new row back BEFORE the
-- creator is added to conversation_members, so a membership-only check would
-- 403 the returning select and break creation.
DROP POLICY IF EXISTS "Members can view group conversations" ON conversations;
CREATE POLICY "Members can view group conversations" ON conversations
  FOR SELECT USING (
    is_group = true
    AND (created_by = auth.uid() OR is_conversation_member(id))
  );

-- Users can create GROUP conversations they own (Feature 010 / #182).
-- Groups have participant_1_id/participant_2_id NULL (CHK023), so the 1:1
-- "auth.uid() = participant_N" policies earlier can never authorize a group
-- INSERT. The creator must be the owner (created_by); per-member access is
-- enforced by the conversation_members policies.
DROP POLICY IF EXISTS "Users can create group conversations" ON conversations;
CREATE POLICY "Users can create group conversations" ON conversations
  FOR INSERT WITH CHECK (
    is_group = true AND created_by = auth.uid()
  );

-- SELECT: Members can see other members of their conversations
DROP POLICY IF EXISTS "Members can view conversation members" ON conversation_members;
CREATE POLICY "Members can view conversation members" ON conversation_members
  FOR SELECT USING (
    is_conversation_member(conversation_id)
    -- The creator must also read member rows they're inserting during
    -- createGroup(): the INSERT ... RETURNING on conversation_members runs
    -- while membership is still being established, so a membership-only check
    -- races (is_conversation_member can't see the just-inserted rows yet) and
    -- the returning read intermittently 403s → "Failed to add group members".
    OR is_conversation_creator(conversation_id)
  );

-- INSERT: existing members can add others (connection validation in the
-- service layer), and the conversation's CREATOR can seat the initial roster.
--
-- SECURITY (#34): the self-join branch was `user_id = auth.uid()`, which let
-- ANY authenticated user insert a membership row for themselves into ANY
-- group — a privilege escalation, since conversation_members / group_keys /
-- messages all gate reads through is_conversation_member(). Scoping the
-- second branch to the conversation's creator closes that: only the creator
-- can seed a group (covers createGroup's owner + member batch insert), while
-- an outsider self-insert now fails both branches.
DROP POLICY IF EXISTS "Members can add to their conversations" ON conversation_members;
CREATE POLICY "Members can add to their conversations" ON conversation_members
  FOR INSERT WITH CHECK (
    is_conversation_member(conversation_id)
    OR is_conversation_creator(conversation_id)
  );

-- UPDATE: Members can update own preferences, owners can update others
DROP POLICY IF EXISTS "Members can update membership" ON conversation_members;
CREATE POLICY "Members can update membership" ON conversation_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR is_conversation_owner(conversation_id)
  );

-- DELETE: No direct deletes - use soft delete via left_at
DROP POLICY IF EXISTS "No direct member deletes" ON conversation_members;
CREATE POLICY "No direct member deletes" ON conversation_members
  FOR DELETE USING (false);

-- T014: RLS policies for group_keys

-- SELECT: Users can only see their own encrypted keys (and must be active member)
DROP POLICY IF EXISTS "Users can view their own keys" ON group_keys;
CREATE POLICY "Users can view their own keys" ON group_keys
  FOR SELECT USING (
    user_id = auth.uid()
    AND is_conversation_member(conversation_id)
  );

-- INSERT: Active members can distribute keys
DROP POLICY IF EXISTS "Members can distribute keys" ON group_keys;
CREATE POLICY "Members can distribute keys" ON group_keys
  FOR INSERT WITH CHECK (
    is_conversation_member(conversation_id)
  );

-- UPDATE: No updates allowed - keys are immutable
DROP POLICY IF EXISTS "Keys are immutable" ON group_keys;
CREATE POLICY "Keys are immutable" ON group_keys
  FOR UPDATE USING (false);

-- DELETE: No direct deletes - orphaned keys are harmless
DROP POLICY IF EXISTS "No direct key deletes" ON group_keys;
CREATE POLICY "No direct key deletes" ON group_keys
  FOR DELETE USING (false);

-- T014a: Update messages table RLS for group membership

-- Drop and recreate SELECT policy to support both 1-to-1 and groups
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON messages;
CREATE POLICY "Users can view messages in own conversations" ON messages
  FOR SELECT USING (
    -- 1-to-1 conversations: check participant columns
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND c.is_group = false
        AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
    )
    OR
    -- Group conversations: check membership via SECURITY DEFINER function
    is_conversation_member(conversation_id)
  );

-- Drop and recreate INSERT policy to support both 1-to-1 and groups
DROP POLICY IF EXISTS "Users can send messages to own conversations" ON messages;
CREATE POLICY "Users can send messages to own conversations" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND (
      -- 1-to-1: existing logic
      EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = conversation_id
          AND c.is_group = false
          AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
          -- C30 (#352): a block stops future contact, in BOTH directions.
          --
          -- Sending was gated on PARTICIPANT, never on connection status, so once a
          -- 1-to-1 conversation existed a blocked user kept messaging the person who
          -- blocked them. All nine `messages` policies were connection-blind — the
          -- word 'blocked' appeared only in the status CHECK constraint and an admin
          -- count.
          --
          -- BOTH ORDERINGS ARE TESTED ON PURPOSE. `unique_connection` is
          -- (requester_id, addressee_id) and is NOT symmetric, so exactly one row
          -- exists and it may name the pair either way round. Checking one ordering
          -- would enforce the block only when the blocker happened to be the
          -- requester — half a fix, and the half that fails is invisible.
          --
          -- It is written against the CONVERSATION's participants rather than
          -- auth.uid() so it holds whichever of the two is sending, which is what
          -- makes it symmetric in effect as well as in lookup.
          --
          -- No SECURITY DEFINER needed: user_connections SELECT is
          -- `auth.uid() = requester_id OR auth.uid() = addressee_id`, and the sender
          -- is always one of the two, so the row is visible to the query that must
          -- see it. If that policy ever narrows, this silently stops enforcing —
          -- tests/rls/blocked-cannot-send.test.ts is what would catch it.
          AND NOT EXISTS (
            SELECT 1 FROM user_connections uc
            WHERE uc.status = 'blocked'
              AND (
                (uc.requester_id = c.participant_1_id AND uc.addressee_id = c.participant_2_id)
                OR
                (uc.requester_id = c.participant_2_id AND uc.addressee_id = c.participant_1_id)
              )
          )
      )
      OR
      -- Group: check active membership via SECURITY DEFINER function.
      -- Deliberately NOT block-aware (#352 decision 5): filtering a blocked member's
      -- messages inside a group leaks the block to everyone else, whose view of the
      -- thread then has holes in it. Group moderation is its own authority.
      is_conversation_member(conversation_id)
    )
  );

-- Grant permissions for new tables
GRANT ALL ON conversation_members TO authenticated, service_role;
GRANT ALL ON group_keys TO authenticated, service_role;

-- Enable realtime for group tables
ALTER TABLE conversation_members REPLICA IDENTITY FULL;
ALTER TABLE group_keys REPLICA IDENTITY FULL;

COMMENT ON TABLE conversation_members IS 'Junction table linking users to group conversations with membership metadata';
COMMENT ON TABLE group_keys IS 'Encrypted symmetric group keys per member per version';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Created:
--   ✅ Payment tables: payment_intents, payment_results, subscriptions, webhook_events, payment_provider_config
--   ✅ Commerce tables: products, orders (Feature 050 Phase 1, #557)
--   ✅ Auth tables: user_profiles, auth_audit_logs
--   ✅ Security tables: rate_limit_attempts
--   ✅ Messaging tables: user_connections, conversations, messages, user_encryption_keys, conversation_keys, typing_indicators
--   ✅ Group chat tables: conversation_members, group_keys (Feature 010)
--   ✅ Storage buckets: avatars (5MB limit, public read)
--   ✅ Functions: update_updated_at_column, create_user_profile, cleanup_old_audit_logs, check_rate_limit, record_failed_attempt, update_conversation_timestamp, assign_sequence_number
--   ✅ Admin RPC functions: admin_payment_stats, admin_auth_stats, admin_user_stats, admin_messaging_stats, admin_payment_trends, admin_audit_trends, admin_list_users, admin_messaging_trends, admin_overview
--   ✅ Triggers: on_auth_user_created, update_user_profiles_updated_at, on_message_inserted, before_message_insert, update_products_updated_at, update_orders_updated_at
--   ✅ RLS policies: All tables + storage.objects protected with auth.uid() (35 + 9 admin policies)
--   ✅ Admin RLS policies: 9 read-only policies for admin dashboard (is_admin check)
--   ✅ Avatar policies: 4 policies (user isolation + public read)
--   ✅ Messaging policies: 17 policies (E2E encryption, user isolation, 15-min edit window)
--   ✅ Group chat policies: 8 policies (membership access, key distribution)
--   ✅ Permissions: Authenticated users + service role (all tables)
--   ✅ Test user: test@example.com (primary, email confirmed)
--   ✅ Admin user: scripthammer (Feature 002 - welcome messages, is_admin = TRUE)
-- ============================================================================

-- Admin profile for system welcome messages (Feature 002)
-- Fixed UUID: 00000000-0000-0000-0000-000000000001
-- NOTE: Admin RLS policies use JWT claims from auth.users.raw_app_meta_data, NOT this column.
-- To grant admin access to a real user, run:
--   UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb WHERE id = '<user-uuid>';
-- The is_admin column on user_profiles is for application-level queries only.
--
-- Local-profile caveat, same story as PART 8: user_profiles.id has an FK to
-- auth.users(id). On Cloud the admin auth.users row already exists, so this
-- INSERT is fine. On a fresh local initdb the admin row is created post-boot
-- by scripts/seed-test-users.ts -- which then fires the on_auth_user_created
-- trigger to make a bare user_profiles row, at which point re-running this
-- file (or just this one statement) hits the ON CONFLICT DO UPDATE branch and
-- fills in username / is_admin. Either way, crashing initdb over it means
-- postinit never runs and the whole stack stays on 28P01. Soft-skip instead.
DO $seed_admin_profile$
BEGIN
  INSERT INTO user_profiles (id, username, display_name, welcome_message_sent, is_admin)
  VALUES ('00000000-0000-0000-0000-000000000001', 'scripthammer', 'ScriptHammer', TRUE, TRUE)
  ON CONFLICT (id) DO UPDATE SET is_admin = TRUE;
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE
      'Skipping admin profile seed (no auth.users row ...001 yet: %). '
      'On the local profile this is expected -- scripts/seed-test-users.ts '
      'creates the admin user, then the on_auth_user_created trigger makes a '
      'bare profile row, then re-running this statement fills in is_admin.',
      SQLERRM;
END
$seed_admin_profile$;

-- ============================================================================
-- Feature 004 / Issue #29: Populate OAuth user profiles (one-time backfill)
-- Only updates NULL display_name for OAuth users.
-- Idempotent: Safe to run multiple times (FR-006).
--
-- Cascade mirrors src/lib/auth/oauth-utils.ts extractOAuthDisplayName():
--   full_name > name > user_name > preferred_username > email prefix > 'Anonymous User'
--
-- Provider notes:
--   - Google sets full_name AND name
--   - GitHub sets name (display name) AND user_name (the @handle) — without
--     user_name in the cascade, GitHub users with no GitHub display name
--     would fall through to email prefix even though the @handle is a
--     better identifier
--   - Other OIDC providers may set preferred_username
--
-- Note on runtime behavior: create_user_profile() (the on_auth_user_created
-- trigger) does NOT set display_name — it inserts only (id, created_at,
-- updated_at). So at signup display_name is NULL, and the runtime
-- populateOAuthProfile() in src/lib/auth/oauth-utils.ts is the sole
-- authoritative populator going forward. This UPDATE handles only the
-- one-time bootstrap for users who existed before that runtime path landed.
-- ============================================================================
UPDATE public.user_profiles p
SET
  display_name = COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'user_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'preferred_username'), ''),
    NULLIF(split_part(u.email, '@', 1), ''),
    'Anonymous User'
  ),
  avatar_url = COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
FROM auth.users u
WHERE p.id = u.id
  AND p.display_name IS NULL
  AND u.raw_app_meta_data->>'provider' IS DISTINCT FROM 'email';

-- ============================================================================
-- PART 10: REALTIME CONFIGURATION
-- Enable realtime subscriptions for messaging tables
-- ============================================================================
--
-- Ported from SpokeToWork fork. Required for:
--   - useUnreadCount hook (subscribes to messages INSERT/UPDATE/DELETE)
--   - real-time conversation list updates
--   - typing indicator presence
--   - group membership changes
--   - friend request status changes
--
-- REPLICA IDENTITY FULL makes UPDATE/DELETE events carry the full row
-- payload (not just the primary key), so Realtime clients can inspect
-- what changed without a follow-up query.
--
-- ALTER PUBLICATION ADD TABLE is idempotent-guarded via pg_publication_tables
-- checks — running this migration twice won't double-add.

-- Create supabase_realtime publication if it doesn't exist.
-- Supabase Cloud normally provisions this, but the guard makes the
-- migration portable to self-hosted Postgres.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- REPLICA IDENTITY FULL is required for Realtime UPDATE/DELETE events
-- to include the full row payload.
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE conversation_members REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE typing_indicators REPLICA IDENTITY FULL;
ALTER TABLE user_connections REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication.
-- Each ADD is guarded by a pg_publication_tables check so this block
-- is safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'typing_indicators'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_connections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_connections;
  END IF;

  -- Payment surfaces: live-update the /payment hub (PaymentHistory +
  -- SubscriptionManager) via postgres_changes. Without publication membership
  -- the realtime channel subscribes but never receives INSERT/UPDATE events.
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'payment_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_results;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'subscriptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
  END IF;
END $$;

-- ============================================================================
-- PART 11: LEGACY CLEANUP (#49 / #170)
-- ============================================================================
-- Pre-#49 leftovers from an old conflicting `00000000000000_rls_foundation.sql`
-- migration (since deleted): the legacy `profiles` / `audit_logs` tables and
-- the old `handle_new_user()` signup trigger function that fed them (plus its
-- `handle_updated_at()` helper + `profiles_updated_at` trigger). The canonical
-- schema uses `user_profiles` / `auth_audit_logs` written by
-- `create_user_profile()` (see PART 8 + the on_auth_user_created trigger).
--
-- A fresh install from this file never creates these objects, so this block is
-- ONLY to converge existing databases (prod) with a clean install. Verified
-- safe on prod 2026-07-04 by the schema-drift audit (#170): both tables held
-- ZERO real-user rows (audit_logs = 8263 legacy `user.signup` events, all
-- null/E2E; profiles = 16 E2E throwaways), no view/FK/canonical-function
-- referenced them, and handle_new_user was orphaned (no trigger fired it).
-- Dropping handle_new_user/handle_updated_at also clears their
-- function_search_path_mutable security-advisor flags.
-- NOTE (#286): no explicit `DROP TRIGGER ... ON public.profiles` here — its
-- IF EXISTS guards the TRIGGER, not the TABLE, so it ERRORs on a fresh install
-- where public.profiles never exists (aborting the single-transaction init).
-- DROP TABLE ... CASCADE below removes the legacy table and any trigger on it
-- on an existing (prod) DB.
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

-- Commit the transaction - everything succeeded
COMMIT;
