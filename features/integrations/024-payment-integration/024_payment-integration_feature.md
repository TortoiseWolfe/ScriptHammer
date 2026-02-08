# Feature: Payment Integration System

**Feature ID**: 024
**Category**: integrations
**Source**: ScriptHammer_v_001/docs/specs/015-payment-integration
**Status**: Ready for SpecKit

## Description

Payment integration system with Supabase backend for GitHub Pages static sites. Supports Stripe and PayPal payments with Edge Functions for webhook handling and PostgreSQL for payment tracking. Includes GDPR-compliant consent flow and offline-first queuing.

## User Scenarios

### US-1: One-Time Payment (P1)

A customer makes a one-time payment through Stripe or PayPal for a donation or product purchase.

**Acceptance Criteria**:

1. Given payment button clicked, when consent granted, then redirected to payment page
2. Given payment completed, when webhook received, then payment marked as verified
3. Given payment failed, when error returned, then user sees clear error with retry option

### US-2: Subscription Payment (P1)

A customer subscribes to a recurring monthly or yearly plan.

**Acceptance Criteria**:

1. Given subscription selected, when payment authorized, then recurring billing is set up
2. Given subscription active, when billing date arrives, then payment is automatically charged
3. Given payment fails, when retry schedule triggers, then retries on days 1, 3, 7

### US-3: Consent Flow (P1)

Users must consent before any payment provider scripts are loaded (GDPR compliance).

**Acceptance Criteria**:

1. Given first visit, when payment page loads, then consent modal appears
2. Given consent granted, when modal closed, then payment scripts load
3. Given consent declined, when viewing options, then Cash App/Chime links shown as fallback

### US-4: Webhook Verification (P2)

Payment confirmations are verified through secure webhook signatures.

**Acceptance Criteria**:

1. Given webhook received, when signature validated, then payment is processed
2. Given invalid signature, when webhook received, then it is rejected
3. Given duplicate webhook, when processing, then it is handled idempotently

### US-5: Offline Queuing (P3)

Payment operations are queued when Supabase is temporarily unavailable.

**Acceptance Criteria**:

1. Given Supabase unavailable, when payment initiated, then operation is queued client-side
2. Given connectivity restored, when queue syncs, then operations are processed
3. Given offline mode, when viewing UI, then offline indicator is shown

## Requirements

### Functional

**Payment Processing**

- FR-001: Accept one-time payments through Stripe (credit card)
- FR-002: Accept one-time payments through PayPal
- FR-003: Support recurring subscription payments (monthly and yearly)
- FR-004: Validate payment amounts (min $1.00, max $999.99)
- FR-005: Support multiple currencies (USD, EUR, GBP, CAD, AUD)
- FR-006: Provide direct payment links for Cash App and Chime

**Payment Verification**

- FR-007: Verify payments through webhook notifications
- FR-008: Check webhook signatures to prevent fraud
- FR-009: Store payment records with status (pending, succeeded, failed)
- FR-010: Mark payments "verified" only after webhook confirmation
- FR-011: Prevent duplicate webhook processing (idempotency)

**Subscription Management**

- FR-012: Track active subscriptions with next billing date
- FR-013: Handle failed subscription payments with automatic retry
- FR-014: Implement configurable retry schedule (default: days 1, 3, 7)
- FR-015: Enter grace period after exhausting retries (default: 7 days)
- FR-016: Auto-cancel subscriptions after grace period expires

**Privacy & Consent**

- FR-017: Request consent before loading payment provider scripts
- FR-018: Show Cash App/Chime links if consent declined
- FR-019: Retry consent modal on next visit if declined

**Notifications**

- FR-020: Send email notifications for payment events
- FR-021: Provide in-app dashboard for payment activity

### Non-Functional

- NFR-001: Support up to 10,000 payments per month
- NFR-002: Handle up to 500 concurrent customers
- NFR-003: Continue accepting payments during Supabase outages (client-side queue)
- NFR-004: Persist queued operations across browser sessions

### Key Entities

- **Payment Intent**: Amount, currency, type (one-time/recurring), customer email
- **Payment Result**: Transaction ID, status, webhook verification status
- **Webhook Event**: Provider, event type, signature, processing status
- **Subscription**: Plan, interval, status, next billing date, retry policy
- **Provider Configuration**: Enabled providers, failover priority

### Edge Functions: Payment Webhooks

**Static Export Compliance**: Stripe and PayPal webhook verification requires server-side secret access. All webhook handling MUST use Supabase Edge Functions.

```typescript
// supabase/functions/stripe-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14';

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2023-10-16',
  });
  const sig = req.headers.get('stripe-signature')!;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    );
  } catch (err) {
    return new Response('Invalid signature', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Idempotency: Check if event already processed
  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('event_id', event.id)
    .single();

  if (existing) {
    return new Response('Already processed', { status: 200 });
  }

  // Process payment events
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    await supabase.from('payments').upsert(
      {
        transaction_id: session.id,
        amount: session.amount_total! / 100,
        currency: session.currency,
        status: 'succeeded',
        provider: 'stripe',
        customer_email: session.customer_email,
        verified: true,
      },
      { onConflict: 'transaction_id' }
    );
  }

  // Mark event as processed
  await supabase
    .from('webhook_events')
    .insert({ event_id: event.id, provider: 'stripe' });

  return new Response('OK', { status: 200 });
});
```

```typescript
// supabase/functions/paypal-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const body = await req.json();
  const transmissionId = req.headers.get('paypal-transmission-id');

  // Verify PayPal webhook signature
  const verifyUrl =
    'https://api-m.paypal.com/v1/notifications/verify-webhook-signature';
  const verifyRes = await fetch(verifyUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await getPayPalToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: req.headers.get('paypal-auth-algo'),
      cert_url: req.headers.get('paypal-cert-url'),
      transmission_id: transmissionId,
      transmission_sig: req.headers.get('paypal-transmission-sig'),
      transmission_time: req.headers.get('paypal-transmission-time'),
      webhook_id: Deno.env.get('PAYPAL_WEBHOOK_ID'),
      webhook_event: body,
    }),
  });

  const { verification_status } = await verifyRes.json();
  if (verification_status !== 'SUCCESS') {
    return new Response('Invalid signature', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Idempotency check
  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('event_id', body.id)
    .single();

  if (existing) return new Response('Already processed', { status: 200 });

  // Process payment events
  if (body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    const capture = body.resource;
    await supabase.from('payments').upsert(
      {
        transaction_id: capture.id,
        amount: parseFloat(capture.amount.value),
        currency: capture.amount.currency_code,
        status: 'succeeded',
        provider: 'paypal',
        verified: true,
      },
      { onConflict: 'transaction_id' }
    );
  }

  await supabase
    .from('webhook_events')
    .insert({ event_id: body.id, provider: 'paypal' });
  return new Response('OK', { status: 200 });
});

async function getPayPalToken() {
  const auth = btoa(
    `${Deno.env.get('PAYPAL_CLIENT_ID')}:${Deno.env.get('PAYPAL_SECRET')}`
  );
  const res = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  return (await res.json()).access_token;
}
```

### Database: Payment Tables

```sql
-- supabase/migrations/024_payment_integration.sql
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  customer_email TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: Service role only for webhooks
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments (matched by email)
CREATE POLICY "Users view own payments" ON payments
  FOR SELECT USING (customer_email = auth.jwt()->>'email');
```

### Out of Scope

- Inventory management
- Shipping integration
- Tax calculation
- Invoice generation
- Refund automation

## Success Criteria

- SC-001: One-time payments complete successfully via Stripe and PayPal
- SC-002: Subscription billing works with automatic retry on failure
- SC-003: Consent flow prevents script loading without permission
- SC-004: Webhooks are verified and processed idempotently
- SC-005: Offline queuing preserves operations during outages
- SC-006: Template users receive notifications for all payment events
