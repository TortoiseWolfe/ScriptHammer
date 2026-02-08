# Feature: PayPal Subscription Management

**Feature ID**: 041
**Category**: payments
**Source**: ScriptHammer README (SPEC-057)
**Status**: Ready for SpecKit

## Description

Active subscriptions list, cancel/pause functionality, and billing cycle display for PayPal subscriptions. Provides comprehensive subscription management for users who pay via PayPal.

## User Scenarios

### US-1: Active Subscriptions List (P1)

Users view all their active PayPal subscriptions.

**Acceptance Criteria**:

1. Given active subscriptions, when viewing, then all listed
2. Given subscription details, when displayed, then plan name and price shown
3. Given subscription status, when shown, then current status clear
4. Given no subscriptions, when viewing, then empty state displayed

### US-2: Cancel Subscription (P1)

Users can cancel their PayPal subscriptions.

**Acceptance Criteria**:

1. Given active subscription, when cancel clicked, then confirmation shown
2. Given cancellation confirmed, when processed, then subscription cancelled
3. Given cancellation complete, when done, then end date displayed
4. Given cancellation failed, when error occurs, then error message shown

### US-3: Pause Subscription (P2)

Users can pause their subscriptions temporarily.

**Acceptance Criteria**:

1. Given pausable subscription, when pause clicked, then duration options shown
2. Given duration selected, when confirmed, then subscription paused
3. Given paused subscription, when viewing, then resume date shown
4. Given resume clicked, when processed, then subscription reactivated

### US-4: Billing Cycle Display (P1)

Users see their billing cycle information clearly.

**Acceptance Criteria**:

1. Given subscription, when viewing, then billing frequency shown
2. Given next billing date, when displayed, then accurate date shown
3. Given billing amount, when shown, then includes taxes/fees
4. Given billing history, when viewed, then past charges listed

## Requirements

### Functional

**Subscriptions List**

- FR-001: Fetch active subscriptions from PayPal API
- FR-002: Display subscription plan details
- FR-003: Show subscription status (active, paused, cancelled)
- FR-004: Display subscription ID for reference
- FR-005: Link to PayPal subscription management

**Cancel Flow**

- FR-006: Show cancellation confirmation dialog
- FR-007: Explain cancellation implications
- FR-008: Process cancellation via PayPal API
- FR-009: Update local subscription status
- FR-010: Send cancellation confirmation email

**Pause/Resume**

- FR-011: Check if subscription supports pausing
- FR-012: Offer pause duration options
- FR-013: Process pause via PayPal API
- FR-014: Display resume date
- FR-015: Implement resume functionality

**Billing Information**

- FR-016: Display billing frequency (monthly, yearly)
- FR-017: Show next billing date
- FR-018: Display total amount with breakdown
- FR-019: Show payment method info
- FR-020: Link to billing history

### Non-Functional

**Integration**

- NFR-001: Sync with PayPal within 5 minutes
- NFR-002: Handle PayPal API rate limits (429 responses trigger exponential backoff)
- NFR-003: Cache subscription data with 5-minute TTL in `paypal_subscriptions_cache` table

**Static Export Compliance**

- NFR-007: All PayPal API calls MUST go through `supabase/functions/paypal-subscriptions` Edge Function
- NFR-008: PAYPAL_CLIENT_ID and PAYPAL_SECRET stored in Supabase Vault, never exposed to browser

**User Experience**

- NFR-004: Actions complete within 10 seconds
- NFR-005: Clear loading states for all operations
- NFR-006: Mobile-friendly subscription cards

### Components

```
src/components/payments/
├── PayPalSubscriptions/
│   ├── PayPalSubscriptions.tsx
│   ├── PayPalSubscriptions.test.tsx
│   ├── SubscriptionCard.tsx
│   ├── CancelDialog.tsx
│   ├── PauseDialog.tsx
│   └── BillingCycle.tsx
```

### API Integration

```typescript
interface PayPalSubscription {
  id: string;
  planId: string;
  planName: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  startDate: Date;
  nextBillingDate: Date;
  billingInfo: {
    amount: number;
    currency: string;
    frequency: 'MONTH' | 'YEAR';
  };
}
```

### Edge Function: PayPal Subscriptions Proxy

**Static Export Compliance**: PayPal API requires `PAYPAL_CLIENT_ID` and `PAYPAL_SECRET` - secrets cannot be exposed to browser. All PayPal API calls MUST go through Supabase Edge Functions.

```typescript
// supabase/functions/paypal-subscriptions/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYPAL_API =
  Deno.env.get('PAYPAL_MODE') === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const auth = btoa(
    `${Deno.env.get('PAYPAL_CLIENT_ID')}:${Deno.env.get('PAYPAL_SECRET')}`
  );
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  return (await res.json()).access_token;
}

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Verify user authentication
  const authHeader = req.headers.get('Authorization');
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(authHeader?.replace('Bearer ', ''));
  if (error || !user) return new Response('Unauthorized', { status: 401 });

  const url = new URL(req.url);
  const subscriptionId = url.searchParams.get('id');
  const action = url.searchParams.get('action'); // get, cancel, suspend, activate
  const token = await getAccessToken();

  if (action === 'get' || action === 'list') {
    const res = await fetch(
      `${PAYPAL_API}/v1/billing/subscriptions/${subscriptionId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return new Response(await res.text(), { status: res.status });
  }

  if (['cancel', 'suspend', 'activate'].includes(action!)) {
    const res = await fetch(
      `${PAYPAL_API}/v1/billing/subscriptions/${subscriptionId}/${action}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'User requested via dashboard' }),
      }
    );
    return new Response(await res.text(), { status: res.status });
  }

  return new Response('Invalid action', { status: 400 });
});
```

### Client Usage

```typescript
// Client-side: Call Edge Function instead of PayPal directly
const { data, error } = await supabase.functions.invoke(
  'paypal-subscriptions',
  {
    body: { id: subscriptionId, action: 'get' },
  }
);

// Cancel subscription
await supabase.functions.invoke('paypal-subscriptions', {
  body: { id: subscriptionId, action: 'cancel' },
});
```

### Database: Subscription Cache

```sql
-- supabase/migrations/041_paypal_subscriptions.sql
CREATE TABLE IF NOT EXISTS paypal_subscriptions_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CANCELLED')),
  billing_amount DECIMAL(10,2) NOT NULL,
  billing_currency TEXT NOT NULL DEFAULT 'USD',
  billing_frequency TEXT NOT NULL CHECK (billing_frequency IN ('MONTH', 'YEAR')),
  next_billing_date TIMESTAMPTZ,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cache_ttl CHECK (cached_at > NOW() - INTERVAL '5 minutes')
);

-- RLS: Users can only see their own subscriptions
ALTER TABLE paypal_subscriptions_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscriptions" ON paypal_subscriptions_cache
  FOR SELECT USING (auth.uid() = user_id);

-- Index for user lookup
CREATE INDEX idx_paypal_subs_user ON paypal_subscriptions_cache(user_id);

-- Auto-cleanup expired cache (run via pg_cron or Edge Function)
-- DELETE FROM paypal_subscriptions_cache WHERE cached_at < NOW() - INTERVAL '5 minutes';
```

### Out of Scope

- PayPal subscription creation (handled by checkout)
- Plan upgrade/downgrade via PayPal
- PayPal dispute management
- PayPal payment method management

## Success Criteria

- SC-001: All active subscriptions displayed correctly
- SC-002: Cancel flow completes successfully
- SC-003: Pause/resume functions as expected
- SC-004: Billing information accurate
- SC-005: PayPal API integration reliable
