# Research: Payment Integration System

**Feature**: Payment Integration with Supabase Backend
**Date**: 2025-10-03
**Status**: Phase 0 Complete

## Research Questions & Decisions

### 1. Supabase Edge Functions Runtime

**Question**: Which Edge Functions runtime features are available for webhook processing?

**Decision**: Use Supabase Edge Functions (Deno runtime) with built-in crypto APIs

**Rationale**:

- Deno has native WebCrypto API for HMAC-SHA256 signature verification
- Edge Functions support 2-minute timeout (sufficient for webhook processing)
- Built-in logging via console.log (appears in Supabase dashboard)
- Free tier: 500,000 function invocations/month (far exceeds 10k payments/month)

**Implementation Details**:

```typescript
// Stripe signature verification in Deno
import { crypto } from 'https://deno.land/std/crypto/mod.ts';

const verifyStripeSignature = async (
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  // ... verification logic
};
```

**Alternatives Considered**:

- AWS Lambda: More expensive, complex setup, overkill for static site
- Cloudflare Workers: Good option, but Supabase integration simpler
- Vercel Serverless Functions: Not possible with GitHub Pages static export

**References**:

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno WebCrypto API](https://deno.land/api@v1.37.0?s=Crypto)

---

### 2. Stripe Integration Method

**Question**: Payment Links vs. Checkout Sessions vs. Payment Intents for static sites?

**Decision**: Use Stripe Checkout Sessions (redirect-based)

**Rationale**:

- No server required to create session (can use Supabase Edge Function)
- PCI compliance handled by Stripe (customer never enters card on our site)
- Supports both one-time and recurring payments
- Built-in success/cancel redirect URLs
- Webhooks provide reliable payment confirmation

**Implementation Pattern**:

```typescript
// Client-side: Create checkout session via Supabase Edge Function
const { sessionId } = await supabase.functions.invoke(
  'create-checkout-session',
  {
    body: { amount, currency, type: 'one_time' },
  }
);

// Redirect to Stripe Checkout
const stripe = await loadStripe(STRIPE_PUBLIC_KEY);
await stripe.redirectToCheckout({ sessionId });

// Webhook confirms payment (server-side verification)
```

**Webhook Events Needed**:

- `checkout.session.completed` - Payment succeeded
- `payment_intent.succeeded` - Final confirmation
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Status changes
- `invoice.payment_failed` - Failed subscription payment
- `customer.subscription.deleted` - Cancellation

**Alternatives Considered**:

- Payment Links: Too limited (no custom amounts, no metadata)
- Payment Intents API: Requires server to create intent (chicken-egg problem)
- Stripe Elements: Requires PCI compliance, card handling complexity

**References**:

- [Stripe Checkout Docs](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Webhook Event Reference](https://stripe.com/docs/api/events/types)

---

### 3. PayPal Integration

**Question**: PayPal Buttons vs. Smart Payment Buttons vs. REST API?

**Decision**: Use PayPal Smart Payment Buttons with lazy loading

**Rationale**:

- Smart Buttons handle both one-time and subscriptions
- Consent-aware: Load SDK only after user consent
- Built-in UI (reduces implementation complexity)
- Webhooks for payment confirmation

**Implementation Pattern**:

```typescript
// Load PayPal SDK after consent
const loadPayPalSDK = async () => {
  if (!window.paypal) {
    await loadScript(
      `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`
    );
  }
};

// Render button
paypal
  .Buttons({
    createSubscription: async (data, actions) => {
      return actions.subscription.create({ plan_id: PLAN_ID });
    },
    onApprove: async (data) => {
      // Store subscription ID, webhook will confirm
    },
  })
  .render('#paypal-button-container');
```

**Webhook Events Needed**:

- `PAYMENT.CAPTURE.COMPLETED` - One-time payment succeeded
- `BILLING.SUBSCRIPTION.CREATED` - New subscription
- `BILLING.SUBSCRIPTION.ACTIVATED` - Subscription active
- `BILLING.SUBSCRIPTION.UPDATED` - Status change
- `BILLING.SUBSCRIPTION.CANCELLED` - Cancellation
- `PAYMENT.SALE.COMPLETED` - Recurring payment succeeded

**Signature Verification**:

- PayPal uses custom headers: `PAYPAL-TRANSMISSION-ID`, `PAYPAL-TRANSMISSION-SIG`
- Requires Edge Function to verify using PayPal SDK

**Alternatives Considered**:

- REST API: Too low-level, requires more code
- Hosted Buttons: No webhook support, unreliable
- PayPal Commerce Platform: Overkill for our use case

**References**:

- [PayPal Smart Buttons](https://developer.paypal.com/sdk/js/reference/)
- [PayPal Webhooks](https://developer.paypal.com/api/webhooks/v1/)
- [Webhook Event Types](https://developer.paypal.com/api/webhooks/v1/#events)

---

### 4. Offline Queue Architecture

**Question**: Dexie.js vs. idb vs. native IndexedDB for offline operations?

**Decision**: Use Dexie.js with sync queue pattern

**Rationale**:

- TypeScript-first API (better DX than native IndexedDB)
- Small bundle size: ~20KB gzipped
- Automatic schema migrations
- Promise-based (async/await support)
- Battle-tested (used in ScriptHammer PRP-011 already)

**Queue Schema**:

```typescript
import Dexie, { Table } from 'dexie';

interface QueuedOperation {
  id?: number;
  type: 'payment_intent' | 'subscription_update';
  data: any;
  createdAt: Date;
  attempts: number;
  lastError?: string;
}

class PaymentQueueDB extends Dexie {
  queuedOperations!: Table<QueuedOperation>;

  constructor() {
    super('PaymentQueue');
    this.version(1).stores({
      queuedOperations: '++id, type, createdAt, attempts',
    });
  }
}
```

**Sync Pattern**:

```typescript
// Queue operation when offline
await db.queuedOperations.add({
  type: 'payment_intent',
  data: paymentData,
  createdAt: new Date(),
  attempts: 0,
});

// Sync when online
supabase.on('connection:online', async () => {
  const pending = await db.queuedOperations.toArray();
  for (const op of pending) {
    try {
      await processOperation(op);
      await db.queuedOperations.delete(op.id);
    } catch (error) {
      await db.queuedOperations.update(op.id, {
        attempts: op.attempts + 1,
        lastError: error.message,
      });
    }
  }
});
```

**Conflict Resolution**:

- Webhook events are source of truth
- Client queue operations are "optimistic updates"
- If webhook arrives before queue sync, discard queue item (already processed)

**Alternatives Considered**:

- Native IndexedDB: Too verbose, callback-based API
- idb (by Jake Archibald): Good, but Dexie has better TypeScript support
- localStorage: 5MB limit too small for payment data

**References**:

- [Dexie.js Documentation](https://dexie.org/)
- [PWA Background Sync](https://web.dev/periodic-background-sync/)
- ScriptHammer PRP-011 (existing implementation)

---

### 5. Email Notification Service

**Question**: Resend vs. SendGrid vs. direct SMTP for transactional emails?

**Decision**: Use Resend API via Supabase Edge Function

**Rationale**:

- Free tier: 3,000 emails/month (sufficient for 10k payments with selective notifications)
- Simple REST API (works well in Edge Functions)
- Good deliverability (SPF, DKIM, DMARC support)
- Template support for branded emails
- No SMTP configuration needed

**Implementation Pattern**:

```typescript
// Supabase Edge Function: send-payment-email
import { Resend } from 'https://esm.sh/resend@1.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

await resend.emails.send({
  from: 'payments@yourdomain.com',
  to: templateUserEmail,
  subject: 'Payment Received: $10.00',
  html: renderEmailTemplate('payment_success', { amount, date, txId }),
});
```

**Email Triggers**:

- Payment succeeded (one-time)
- Subscription created
- Subscription payment succeeded
- Subscription payment failed (after retries)
- Subscription canceled
- Subscription entering grace period

**Rate Limiting**:

- Resend: 10 requests/second
- Our scale: ~334 payments/day = <<1 req/sec (safe)

**Alternatives Considered**:

- SendGrid: More expensive ($19.95/month for 50k emails)
- AWS SES: Requires AWS account, more setup
- Direct SMTP: Complex to configure, deliverability issues
- Supabase Auth emails: Not designed for transactional emails

**References**:

- [Resend Documentation](https://resend.com/docs)
- [Resend Pricing](https://resend.com/pricing)
- [Email Templates Best Practices](https://postmarkapp.com/guides/transactional-email-templates)

---

### 6. GDPR Consent UX

**Question**: Modal-first vs. banner-first for payment script consent?

**Decision**: Modal-first with localStorage persistence

**Rationale**:

- Modal is more explicit (GDPR requires "freely given, specific" consent)
- Banner can be ignored/dismissed (not true consent)
- localStorage persists consent across sessions
- Retry on next visit if declined (as clarified in Q3)

**Consent Flow**:

```typescript
// Check consent on mount
const hasConsent = localStorage.getItem('payment_consent') === 'granted';

if (!hasConsent) {
  showConsentModal(); // Blocks payment UI
} else {
  loadPaymentScripts(); // Stripe/PayPal SDKs
}

// On consent granted
const handleConsentGranted = () => {
  localStorage.setItem('payment_consent', 'granted');
  localStorage.setItem('payment_consent_date', new Date().toISOString());
  loadPaymentScripts();
};

// On consent declined
const handleConsentDeclined = () => {
  localStorage.setItem('payment_consent', 'declined');
  showFallbackOptions(); // Cash App/Chime links only
  // Next visit will show modal again (don't persist 'declined')
};
```

**Consent Modal Content** (FR-019):

```
We use Stripe and PayPal to process payments securely.

**Data Collected**:
- Payment amount and currency
- Your email address
- Transaction timestamps

**Third Parties**:
- Stripe (payment processing)
- PayPal (payment processing)
- Supabase (payment tracking)

**Your Rights**:
- Decline consent and use Cash App/Chime links
- Withdraw consent anytime in privacy settings

[Accept] [Decline]
```

**Retry Logic**:

- `payment_consent === 'granted'` → Load scripts immediately
- `payment_consent === 'declined'` OR missing → Show modal
- Modal shown max once per session (avoid annoyance)

**Alternatives Considered**:

- Banner: Too subtle, may violate GDPR "explicit consent"
- Cookie: localStorage simpler, no cookie consent needed
- Persistent decline: Violates "retry next visit" requirement (Q3)

**References**:

- [GDPR Consent Requirements](https://gdpr.eu/consent/)
- [Cookie Consent Best Practices](https://www.cookiebot.com/en/gdpr-consent/)
- ScriptHammer PRP-007 (existing cookie consent system)

---

### 7. Database Schema Optimization

**Question**: Normalized vs. denormalized for 10k payments/month queries?

**Decision**: Hybrid approach with strategic denormalization

**Rationale**:

- Normalize core entities (payment_intents, payment_results, subscriptions)
- Denormalize frequently queried fields (customer_email in multiple tables)
- Use PostgreSQL indexes for fast lookups
- Partition payment_results by month after 100k+ rows

**Indexing Strategy**:

```sql
-- Frequent dashboard queries
CREATE INDEX idx_payment_results_created_at ON payment_results(created_at DESC);
CREATE INDEX idx_payment_results_customer_email ON payment_results((event_data->>'customer_email'));
CREATE INDEX idx_subscriptions_customer_email ON subscriptions(customer_email);

-- Webhook idempotency
CREATE UNIQUE INDEX idx_webhook_events_provider_event_id ON webhook_events(provider, event_id);

-- Payment history queries
CREATE INDEX idx_payment_intents_customer_email ON payment_intents(customer_email);
CREATE INDEX idx_payment_results_status ON payment_results(status);
```

**Row Level Security (RLS)**:

```sql
-- Template users can only see their own payments
ALTER TABLE payment_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments" ON payment_results
  FOR SELECT
  USING (auth.uid() = template_user_id);
```

**Partitioning Strategy** (future optimization):

```sql
-- After 1M+ rows, partition by month
CREATE TABLE payment_results_2025_10 PARTITION OF payment_results
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

**Query Performance Targets**:

- Dashboard load: <500ms (indexed queries)
- Transaction lookup: <100ms (by transaction_id)
- Payment history filter: <1s (10k rows with pagination)

**Alternatives Considered**:

- Full denormalization: Too much duplicate data, hard to maintain consistency
- Full normalization: Requires JOINs for dashboard queries (slower)
- NoSQL (MongoDB): PostgreSQL RLS better for multi-tenant security

**References**:

- [PostgreSQL Indexing Strategies](https://www.postgresql.org/docs/current/indexes.html)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)

---

## Summary of Decisions

| Area         | Decision                       | Key Benefit                                            |
| ------------ | ------------------------------ | ------------------------------------------------------ |
| **Runtime**  | Supabase Edge Functions (Deno) | Native crypto APIs, free tier 500k calls/month         |
| **Stripe**   | Checkout Sessions (redirect)   | No PCI compliance needed, supports recurring           |
| **PayPal**   | Smart Payment Buttons          | Unified API for one-time + subscriptions               |
| **Offline**  | Dexie.js + sync queue          | TypeScript-first, 20KB bundle, proven (PRP-011)        |
| **Email**    | Resend API                     | 3k emails/month free, simple Edge Function integration |
| **Consent**  | Modal-first + localStorage     | GDPR-compliant, retry on decline per Q3                |
| **Database** | Hybrid normalized/denormalized | Fast queries with indexes, RLS for security            |

## Bundle Size Impact

| Dependency              | Size (gzipped) | Load Strategy           |
| ----------------------- | -------------- | ----------------------- |
| @supabase/supabase-js   | ~45KB          | Bundled (critical)      |
| Dexie.js                | ~20KB          | Bundled (offline queue) |
| @stripe/stripe-js       | ~15KB          | Lazy load after consent |
| PayPal SDK              | ~40KB          | Lazy load after consent |
| **Total First Load**    | **~65KB**      | Under 150KB target ✓    |
| **Total After Consent** | **~120KB**     | Lazy-loaded SDKs        |

## Next Steps

✅ **Phase 0 Complete** - All research questions resolved

**Ready for Phase 1**:

1. Create data-model.md (entity schemas from research #7)
2. Generate contracts/ (API specs from research #2, #3)
3. Write quickstart.md (integration test scenarios)
4. Update CLAUDE.md (add Supabase patterns)

---

_Research completed: 2025-10-03_
_Phase 0 → Phase 1 transition approved_
