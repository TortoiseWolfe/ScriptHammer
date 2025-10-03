# Data Model: Payment Integration System

**Feature**: Payment Integration with Supabase Backend
**Date**: 2025-10-03
**Status**: Phase 1 - Database Design

## Overview

This data model supports a payment integration system for static GitHub Pages sites using Supabase as the backend. The schema is designed for:

- 10,000 payments/month scale
- 500 concurrent customers
- Webhook-based payment verification
- Offline-first client architecture
- Multi-provider support (Stripe, PayPal, Cash App, Chime)

## Entity Relationship Diagram

```
┌─────────────────────┐
│  payment_intents    │
│  ─────────────────  │
│  id (PK)            │◄────┐
│  amount             │     │
│  currency           │     │  1:1
│  type               │     │
│  customer_email     │     │
└─────────────────────┘     │
                            │
                            │
┌─────────────────────┐     │
│  payment_results    │─────┘
│  ─────────────────  │
│  id (PK)            │◄────┐
│  intent_id (FK)     │     │
│  provider           │     │  1:N
│  transaction_id     │     │
│  status             │     │
└─────────────────────┘     │
         ▲                  │
         │                  │
         │ N:1              │
         │                  │
┌─────────────────────┐     │
│  webhook_events     │─────┘
│  ─────────────────  │
│  id (PK)            │
│  provider           │
│  event_id (UNIQUE)  │◄──── Idempotency key
│  event_type         │
│  event_data (JSONB) │
└─────────────────────┘
         │
         │ N:1
         ▼
┌─────────────────────┐
│  subscriptions      │
│  ─────────────────  │
│  id (PK)            │
│  provider_sub_id    │
│  customer_email     │
│  status             │
│  next_billing_date  │
└─────────────────────┘

┌──────────────────────────┐
│ payment_provider_config  │ (Standalone)
│ ─────────────────────── │
│ id (PK)                  │
│ provider                 │
│ enabled                  │
│ configured               │
└──────────────────────────┘
```

## Entity Definitions

### 1. payment_intents

**Purpose**: Represents a customer's intention to make a payment (created before provider redirect)

**Schema**:

```sql
CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_user_id UUID NOT NULL REFERENCES auth.users(id),
  amount INTEGER NOT NULL CHECK (amount >= 100 AND amount <= 99999), -- $1.00 to $999.99
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency IN ('usd', 'eur', 'gbp', 'cad', 'aud')),
  type TEXT NOT NULL CHECK (type IN ('one_time', 'recurring')),
  interval TEXT CHECK (interval IN ('month', 'year') OR interval IS NULL), -- Only for recurring
  description TEXT,
  customer_email TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);
```

**Indexes**:

```sql
CREATE INDEX idx_payment_intents_customer_email ON payment_intents(customer_email);
CREATE INDEX idx_payment_intents_created_at ON payment_intents(created_at DESC);
CREATE INDEX idx_payment_intents_user_id ON payment_intents(template_user_id);
```

**Constraints**:

- Amount in cents (100 = $1.00)
- Min $1.00, max $999.99 (FR-004)
- Expires after 24 hours if not completed
- `interval` required if `type = 'recurring'`

**State Lifecycle**:

- Created → Pending (waiting for redirect)
- Pending → Completed (payment_result created)
- Pending → Expired (24 hours, no activity)

### 2. payment_results

**Purpose**: Represents the outcome of a payment attempt (linked to payment_intent)

**Schema**:

```sql
CREATE TABLE payment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  template_user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal', 'cashapp', 'chime')),
  transaction_id TEXT NOT NULL, -- Provider's transaction ID
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  charged_amount INTEGER, -- Actual amount charged (may differ due to fees)
  charged_currency TEXT,
  webhook_verified BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_verified_at TIMESTAMPTZ,
  redirect_verified BOOLEAN NOT NULL DEFAULT FALSE, -- User returned from provider
  redirect_verified_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes**:

```sql
CREATE INDEX idx_payment_results_intent_id ON payment_results(intent_id);
CREATE INDEX idx_payment_results_transaction_id ON payment_results(transaction_id);
CREATE INDEX idx_payment_results_status ON payment_results(status);
CREATE INDEX idx_payment_results_created_at ON payment_results(created_at DESC);
CREATE INDEX idx_payment_results_user_id ON payment_results(template_user_id);
CREATE INDEX idx_payment_results_customer_email ON payment_results((metadata->>'customer_email'));
```

**State Transitions**:

```
pending → succeeded (webhook confirmed)
pending → failed (webhook indicated failure)
succeeded → refunded (refund issued)
```

**Verification Flags** (FR-024):

- `webhook_verified`: Confirmed via webhook (most reliable)
- `redirect_verified`: User returned from provider (less reliable)
- Both should be true for completed payments

**Constraints**:

- `transaction_id` unique per provider
- `charged_amount` may differ from `intent.amount` (currency conversion, fees)
- `status` updated only by webhooks (immutable from client)

### 3. webhook_events

**Purpose**: Represents a webhook notification from payment provider (for idempotency and audit)

**Schema**:

```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  event_id TEXT NOT NULL, -- Provider's unique event ID
  event_type TEXT NOT NULL, -- e.g., 'payment_intent.succeeded', 'PAYMENT.CAPTURE.COMPLETED'
  event_data JSONB NOT NULL, -- Full webhook payload
  signature TEXT NOT NULL, -- Webhook signature for verification
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  signature_verified_at TIMESTAMPTZ,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  processing_attempts INTEGER NOT NULL DEFAULT 0,
  processing_error TEXT,
  related_payment_result_id UUID REFERENCES payment_results(id),
  related_subscription_id UUID REFERENCES subscriptions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes**:

```sql
CREATE UNIQUE INDEX idx_webhook_events_provider_event_id ON webhook_events(provider, event_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed, created_at DESC);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
```

**Idempotency** (FR-011):

- `UNIQUE(provider, event_id)` prevents duplicate processing
- If same event received twice, second INSERT fails (gracefully return 200 OK)

**Processing Workflow**:

1. Webhook received → INSERT into webhook_events
2. Verify signature → update `signature_verified`
3. Process event → create/update payment_result or subscription
4. Mark `processed = true`
5. If processing fails → increment `processing_attempts`, store error

**Retry Strategy** (FR-033, FR-037):

- Exponential backoff: retry in 1m, 5m, 15m, 1h, 6h, 24h
- Match Stripe's 3-day retry window
- After max attempts, flag for manual review

### 4. subscriptions

**Purpose**: Represents a recurring payment agreement (monthly or yearly)

**Schema**:

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  provider_subscription_id TEXT NOT NULL UNIQUE, -- Stripe sub_xxx or PayPal I-xxx
  customer_email TEXT NOT NULL,
  plan_amount INTEGER NOT NULL CHECK (plan_amount >= 100),
  plan_currency TEXT NOT NULL DEFAULT 'usd',
  plan_interval TEXT NOT NULL CHECK (plan_interval IN ('month', 'year')),
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'grace_period', 'canceled', 'expired')),
  current_period_start DATE,
  current_period_end DATE,
  next_billing_date DATE,
  failed_payment_count INTEGER NOT NULL DEFAULT 0,
  retry_schedule JSONB DEFAULT '{"day_1": false, "day_3": false, "day_7": false}'::jsonb,
  grace_period_expires DATE,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes**:

```sql
CREATE INDEX idx_subscriptions_customer_email ON subscriptions(customer_email);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_next_billing_date ON subscriptions(next_billing_date) WHERE status = 'active';
CREATE INDEX idx_subscriptions_user_id ON subscriptions(template_user_id);
CREATE UNIQUE INDEX idx_subscriptions_provider_id ON subscriptions(provider, provider_subscription_id);
```

**State Transitions** (from spec):

```
active ↔ past_due (payment failed, retry in progress)
past_due → grace_period (all retries exhausted, FR-015)
grace_period → canceled (grace period expired, FR-016)
grace_period → active (payment succeeded during grace period)
active → canceled (user cancellation)
```

**Retry Logic** (FR-014):

```json
{
  "day_1": false, // Retry 1 day after failure
  "day_3": false, // Retry 3 days after failure
  "day_7": false // Retry 7 days after failure
}
```

**Grace Period** (FR-015):

- Default: 7 days after final retry
- `grace_period_expires = last_retry_date + 7 days`
- If payment succeeds during grace period → status = 'active'
- If grace period expires → status = 'canceled'

**Notifications** (FR-017, FR-035):

- Status change to 'past_due' → email + dashboard
- Status change to 'grace_period' → email + dashboard
- Status change to 'canceled' → email + dashboard
- Successful payment after failure → email + dashboard

### 5. payment_provider_config

**Purpose**: Stores enabled payment providers and their configuration status

**Schema**:

```sql
CREATE TABLE payment_provider_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal', 'cashapp', 'chime')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  configured BOOLEAN NOT NULL DEFAULT FALSE, -- Credentials validated
  priority INTEGER NOT NULL DEFAULT 0, -- For failover order (higher = try first)
  supports_recurring BOOLEAN NOT NULL, -- Stripe/PayPal = true, Cash App/Chime = false
  supports_webhooks BOOLEAN NOT NULL, -- Stripe/PayPal = true, Cash App/Chime = false
  config_data JSONB, -- Encrypted credentials (Supabase Vault)
  last_validated_at TIMESTAMPTZ,
  validation_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_user_id, provider)
);
```

**Indexes**:

```sql
CREATE INDEX idx_provider_config_user_id ON payment_provider_config(template_user_id);
CREATE INDEX idx_provider_config_enabled ON payment_provider_config(enabled, priority DESC);
```

**Default Configurations**:

```sql
-- Stripe
{ supports_recurring: true, supports_webhooks: true, priority: 10 }

-- PayPal
{ supports_recurring: true, supports_webhooks: true, priority: 9 }

-- Cash App
{ supports_recurring: false, supports_webhooks: false, priority: 5 }

-- Chime
{ supports_recurring: false, supports_webhooks: false, priority: 5 }
```

**Failover Logic** (FR-031):

- Sort by `priority DESC`
- Skip if `enabled = false` or `configured = false`
- If primary fails, try next in priority order

## Row Level Security (RLS) Policies

**Principle**: Template users can only access their own payment data

```sql
-- Enable RLS on all tables
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_provider_config ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view own payment intents
CREATE POLICY "Users view own payment intents" ON payment_intents
  FOR SELECT
  USING (auth.uid() = template_user_id);

-- Policy: Users can create own payment intents
CREATE POLICY "Users create own payment intents" ON payment_intents
  FOR INSERT
  WITH CHECK (auth.uid() = template_user_id);

-- Policy: Users can view own payment results
CREATE POLICY "Users view own payment results" ON payment_results
  FOR SELECT
  USING (auth.uid() = template_user_id);

-- Policy: Users can view own subscriptions
CREATE POLICY "Users view own subscriptions" ON subscriptions
  FOR SELECT
  USING (auth.uid() = template_user_id);

-- Policy: Users can view own provider config
CREATE POLICY "Users view own provider config" ON payment_provider_config
  FOR ALL
  USING (auth.uid() = template_user_id);

-- Policy: Webhook events are read-only for users
CREATE POLICY "Users view related webhook events" ON webhook_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payment_results pr
      WHERE pr.id = webhook_events.related_payment_result_id
      AND pr.template_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.id = webhook_events.related_subscription_id
      AND s.template_user_id = auth.uid()
    )
  );
```

**Service Role Bypass**:

- Edge Functions use `service_role` key (bypasses RLS)
- Webhooks can create/update any record
- RLS protects client-side queries only

## Data Retention & Archival

**Retention Policy**:

- `payment_intents`: 90 days after expiration (for dispute resolution)
- `payment_results`: 7 years (financial compliance)
- `webhook_events`: 1 year (audit trail)
- `subscriptions`: Indefinite (historical subscriptions remain)

**Archival Strategy** (future):

```sql
-- Move old webhook events to cold storage
CREATE TABLE webhook_events_archive (LIKE webhook_events INCLUDING ALL);

-- Monthly cron job
INSERT INTO webhook_events_archive
SELECT * FROM webhook_events
WHERE created_at < NOW() - INTERVAL '1 year';

DELETE FROM webhook_events
WHERE created_at < NOW() - INTERVAL '1 year';
```

## Performance Optimization

**Query Patterns**:

1. **Dashboard: Recent payments** (most frequent)

```sql
SELECT * FROM payment_results
WHERE template_user_id = $1
ORDER BY created_at DESC
LIMIT 50;
-- Uses: idx_payment_results_user_id + idx_payment_results_created_at
```

2. **Transaction lookup** (by customer)

```sql
SELECT * FROM payment_results
WHERE transaction_id = $1;
-- Uses: idx_payment_results_transaction_id (O(1) lookup)
```

3. **Subscription status check**

```sql
SELECT * FROM subscriptions
WHERE customer_email = $1 AND status = 'active';
-- Uses: idx_subscriptions_customer_email
```

4. **Webhook idempotency check**

```sql
SELECT id FROM webhook_events
WHERE provider = $1 AND event_id = $2;
-- Uses: idx_webhook_events_provider_event_id (UNIQUE, O(1))
```

**Expected Performance**:

- Dashboard load: <200ms (indexed, 50 rows)
- Transaction lookup: <50ms (unique index)
- Webhook processing: <100ms (idempotency check + insert)

## Validation Rules Summary

| Entity          | Validation                | Enforcement       |
| --------------- | ------------------------- | ----------------- |
| payment_intents | Amount $1.00-$999.99      | CHECK constraint  |
| payment_intents | Currency in allowed list  | CHECK constraint  |
| payment_results | Status enum               | CHECK constraint  |
| webhook_events  | Unique event per provider | UNIQUE index      |
| subscriptions   | Status transitions        | Application logic |
| subscriptions   | Retry schedule format     | Application logic |

## Next Steps

✅ **Data Model Complete**

**Ready for**:

1. Generate SQL migrations (`supabase/migrations/001_payment_schema.sql`)
2. Create API contracts (`contracts/*.json`)
3. Write contract tests (`tests/contract/*.test.ts`)

---

_Data model designed: 2025-10-03_
_Entity count: 5 tables_
_Supports: 10k payments/month, 500 concurrent customers_
