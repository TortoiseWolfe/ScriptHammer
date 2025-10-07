# Product Requirements Prompt (PRP)

**Feature Name**: Payment Integration System (Supabase Backend)
**Priority**: P1 (Template Enhancement)
**Version**: 0.0.1
**Status**: 📥 Inbox
**Created**: 2025-10-03
**Author**: ScriptHammer Development Team

---

## 1. Product Requirements

### What We're Building

A production-ready payment integration system with **Supabase backend** supporting multiple payment providers (Stripe, PayPal, Cash App, Chime). Uses Supabase Edge Functions for webhooks and PostgreSQL for payment tracking, while maintaining static site deployment to GitHub Pages.

###Why We're Building It

- **Static Site Constraint**: GitHub Pages requires external backend for webhooks/server logic
- **Supabase Solution**: Serverless Edge Functions + PostgreSQL without server maintenance
- **Template Completeness**: Enable donations, digital products, subscriptions
- **Best Practices**: Webhook verification, payment tracking, subscription management
- **GDPR Compliance**: Privacy-first script loading with consent
- **Production-Ready**: Secure, scalable, well-documented

### Success Criteria

- [ ] Supabase project setup with PostgreSQL database
- [ ] Edge Functions for Stripe webhook handling (signature verification)
- [ ] Edge Functions for PayPal webhook handling
- [ ] Edge Functions for payment creation (checkout/subscriptions)
- [ ] Database tables: payment_intents, payment_results, webhook_events, subscriptions
- [ ] Stripe integration (one-time + recurring)
- [ ] PayPal integration (one-time payments)
- [ ] Cash App & Chime payment links
- [ ] GDPR-compliant consent modal
- [ ] Payment status tracking with webhook verification
- [ ] Idempotency for webhook events
- [ ] Subscription retry logic with grace periods
- [ ] Client-side React components (DonateButton, CheckoutButton, SubscribeButton)
- [ ] Comprehensive test coverage (>90% for payment logic)
- [ ] Template user setup guide (15-minute Supabase onboarding)

### Out of Scope

- Physical product inventory
- Shipping address collection
- Tax calculation (use Stripe Tax as future enhancement)
- Invoice generation (basic receipts only)
- Multi-currency conversion (use provider defaults)
- Cryptocurrency payments

---

## 2. Context & Codebase Intelligence

### ScriptHammer Architecture Constraint

**Static Export for GitHub Pages:**

```typescript
// next.config.ts
const nextConfig = {
  output: 'export', // Static HTML export - NO server-side code
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
};
```

**The Challenge:**

- ❌ No Next.js API routes (require Node.js server)
- ❌ No server-side rendering
- ❌ No webhook endpoints (can't receive POST requests)

**The Solution: Supabase Backend**

- ✅ Edge Functions (Deno-based serverless)
- ✅ PostgreSQL database (managed)
- ✅ Real-time subscriptions
- ✅ Row Level Security
- ✅ Free tier (500MB DB, 2M Edge Function invocations/month)

### Supabase Backend Pattern

**Architecture:**

```
Browser (Static Site) → Supabase Client → Edge Functions → Database
                                    ↓
                          Stripe/PayPal APIs
                                    ↓
                          Webhooks → Edge Functions → Database
```

**Edge Function Example:**

```typescript
// supabase/functions/stripe-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.0.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')!
  const body = await req.text()

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)

  // Verify signature
  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    Deno.env.get('STRIPE_WEBHOOK_SECRET')!
  )

  // Store in database with idempotency check
  const supabase = createClient(...)
  await supabase.from('webhook_events').insert({
    provider: 'stripe',
    event_id: event.id,
    event_type: event.type,
    payload: event.data.object
  })

  // Process event (update payment status, etc.)

  return new Response(JSON.stringify({ received: true }))
})
```

### Existing Patterns to Follow

#### Provider Pattern (PRP-010 Email Service)

```typescript
// Similar pattern for payment providers
export class StripeProvider {
  async createCheckout(amount, currency) {
    // Call Supabase Edge Function
    const { data } = await supabase.functions.invoke('stripe-create-payment', {
      body: { amount, currency, type: 'one_time' },
    });
    return data;
  }
}
```

#### Consent Modal Pattern (PRP-007, PRP-013)

```typescript
// GDPR consent before loading Stripe/PayPal scripts
const { hasConsent } = usePaymentConsent();

if (!hasConsent) {
  await requestConsent(); // Show modal
}

// Load payment scripts only after consent
```

### Dependencies & Libraries

#### Supabase

```bash
pnpm add @supabase/supabase-js  # Client library
pnpm add -D supabase             # CLI for migrations & deployment
```

#### Stripe

```bash
pnpm add @stripe/stripe-js  # Client-side (browser)
# stripe SDK used in Edge Functions (Deno import)
```

#### PayPal

```bash
pnpm add @paypal/react-paypal-js  # React components
# PayPal SDK used in Edge Functions
```

### File Structure

```
ScriptHammer/
├── supabase/
│   ├── config.toml                              # Supabase config
│   ├── migrations/
│   │   └── 20250103_payment_tables.sql          # Database schema
│   └── functions/
│       ├── stripe-create-payment/index.ts        # Create checkout session
│       ├── stripe-webhook/index.ts               # Handle Stripe webhooks
│       ├── paypal-create-order/index.ts          # Create PayPal order
│       ├── paypal-webhook/index.ts               # Handle PayPal webhooks
│       └── payment-status/index.ts               # Query payment status
├── src/
│   ├── lib/
│   │   └── supabase/
│   │       └── client.ts                         # Supabase client singleton
│   ├── utils/payment/
│   │   ├── validation.ts                         # Amount/currency validation
│   │   └── providers/
│   │       ├── stripe-client.ts                  # Stripe wrapper (calls Edge Functions)
│   │       ├── paypal-client.ts                  # PayPal wrapper
│   │       ├── cashapp-client.ts                 # Cash App links
│   │       └── chime-client.ts                   # Chime links
│   ├── hooks/
│   │   ├── usePayment.ts                         # Payment processing
│   │   ├── usePaymentConsent.ts                  # GDPR consent
│   │   └── usePaymentStatus.ts                   # Real-time status polling
│   ├── components/payment/
│   │   ├── DonateButton/                         # 5-file pattern
│   │   ├── CheckoutButton/                       # 5-file pattern
│   │   ├── SubscribeButton/                      # 5-file pattern
│   │   └── PaymentConsentModal/                  # 5-file pattern
│   ├── app/payment/
│   │   ├── success/page.tsx                      # Payment success handler
│   │   └── cancel/page.tsx                       # Payment cancellation
│   ├── types/payment.ts                          # TypeScript interfaces
│   └── config/payment.ts                         # Client-safe config
└── docs/
    └── supabase-setup.md                         # Template user guide
```

---

## 3. Technical Specifications

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                   Browser (GitHub Pages)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ DonateButton │  │CheckoutButton│  │SubscribeButton│       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘       │
│         │                  │                  │                │
│         └──────────────────┴──────────────────┘                │
│                            │                                   │
│                  ┌─────────▼─────────┐                        │
│                  │ Supabase Client   │                        │
│                  │ (@supabase/       │                        │
│                  │  supabase-js)     │                        │
│                  └─────────┬─────────┘                        │
└────────────────────────────┼──────────────────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────────────┐
│                   Supabase Backend                             │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Edge Functions (Deno Runtime)                       │    │
│  │  ┌────────────────────┐  ┌────────────────────────┐  │    │
│  │  │ stripe-create-     │  │ stripe-webhook         │  │    │
│  │  │ payment            │  │ (signature verify)     │  │    │
│  │  └─────────┬──────────┘  └────────┬───────────────┘  │    │
│  │  ┌─────────▼──────────┐  ┌────────▼───────────────┐  │    │
│  │  │ paypal-create-     │  │ paypal-webhook         │  │    │
│  │  │ order              │  │                        │  │    │
│  │  └─────────┬──────────┘  └────────┬───────────────┘  │    │
│  │           │                       │                   │    │
│  │           └───────────┬───────────┘                   │    │
│  └───────────────────────┼───────────────────────────────┘    │
│                          │                                     │
│  ┌───────────────────────▼───────────────────────────────┐    │
│  │  PostgreSQL Database (Row Level Security)            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │    │
│  │  │ payment_     │  │ payment_     │  │ webhook_    │ │    │
│  │  │ intents      │  │ results      │  │ events      │ │    │
│  │  └──────────────┘  └──────────────┘  └─────────────┘ │    │
│  │  ┌──────────────┐                                     │    │
│  │  │subscriptions │                                     │    │
│  │  └──────────────┘                                     │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
          │               │
          ▼               ▼
   ┌──────────┐    ┌──────────┐
   │  Stripe  │    │  PayPal  │
   │   API    │    │   API    │
   └──────────┘    └──────────┘
```

### Database Schema (PostgreSQL)

```sql
-- Migration: supabase/migrations/20250103_payment_tables.sql

-- Payment Intents
CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  type TEXT NOT NULL CHECK (type IN ('one_time', 'recurring')),
  description TEXT,
  metadata JSONB,
  customer_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment Results
CREATE TABLE payment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID REFERENCES payment_intents(id),
  transaction_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal', 'venmo', 'cashapp', 'chime')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  error_message TEXT,
  checkout_url TEXT,
  receipt_url TEXT,
  webhook_verified BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(transaction_id, provider)
);

-- Webhook Events (Idempotency)
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature TEXT,
  signature_verified BOOLEAN DEFAULT FALSE,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('pending', 'processed', 'failed')),
  processing_attempts INTEGER DEFAULT 0,
  last_processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE(provider, event_id)
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  customer_id TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  plan_amount INTEGER NOT NULL,
  plan_currency TEXT NOT NULL,
  plan_interval TEXT NOT NULL CHECK (plan_interval IN ('month', 'year')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'grace_period')),
  next_billing_date TIMESTAMPTZ,
  failed_attempt_count INTEGER DEFAULT 0,
  last_failed_attempt_date TIMESTAMPTZ,
  grace_period_start_date TIMESTAMPTZ,
  grace_period_end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  canceled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payment_results_intent_id ON payment_results(intent_id);
CREATE INDEX idx_payment_results_transaction_id ON payment_results(transaction_id);
CREATE INDEX idx_webhook_events_event_id ON webhook_events(provider, event_id);
CREATE INDEX idx_subscriptions_subscription_id ON subscriptions(subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Row Level Security
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies (read-only for authenticated, service role for writes)
CREATE POLICY "Enable read for authenticated users" ON payment_results
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
```

### Environment Variables

**Supabase (Client-Side - NEXT*PUBLIC*):**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

**Stripe (Client-Side):**

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

**PayPal (Client-Side):**

```bash
NEXT_PUBLIC_PAYPAL_CLIENT_ID=xxx
NEXT_PUBLIC_VENMO_ENABLED=true
```

**Cash App & Chime (Client-Side):**

```bash
NEXT_PUBLIC_CASHAPP_CASHTAG=$YourCashTag
NEXT_PUBLIC_CHIME_SIGN=$YourChimeSign
```

**Server-Side Secrets (Edge Function Environment):**

```bash
# Set in Supabase Dashboard → Edge Functions → Secrets
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...  # For database writes
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
PAYPAL_CLIENT_SECRET=xxx
PAYPAL_WEBHOOK_ID=xxx
```

---

## 4. Implementation Runbook

### Step 1: Setup Supabase Project (15 minutes)

**1.1 Create Supabase Account**

```bash
# 1. Go to https://supabase.com
# 2. Sign up (free, no credit card)
# 3. Create new project
# 4. Wait 2 minutes for provisioning
# 5. Copy Project URL and anon key
```

**1.2 Install Supabase CLI**

```bash
docker compose exec scripthammer pnpm add @supabase/supabase-js
docker compose exec scripthammer pnpm add -D supabase
```

**1.3 Initialize Supabase**

```bash
docker compose exec scripthammer npx supabase init
docker compose exec scripthammer npx supabase link --project-ref YOUR_PROJECT_REF
```

**1.4 Create Database Schema**

```bash
# Migration file created in specs/015-payment-integration/
docker compose exec scripthammer npx supabase db push
```

### Step 2: Setup Payment Providers

**Stripe:**

1. Create account at https://dashboard.stripe.com/register
2. Get test API keys
3. Configure webhook: `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
4. Events: `checkout.session.completed`, `customer.subscription.created`, `invoice.payment_failed`

**PayPal:**

1. Create developer account at https://developer.paypal.com
2. Create sandbox app
3. Get client ID and secret
4. Configure webhook: `https://YOUR_PROJECT.supabase.co/functions/v1/paypal-webhook`

### Step 3: Deploy Edge Functions

```bash
# Set secrets first in Supabase Dashboard
docker compose exec scripthammer npx supabase functions deploy stripe-create-payment
docker compose exec scripthammer npx supabase functions deploy stripe-webhook
docker compose exec scripthammer npx supabase functions deploy paypal-create-order
docker compose exec scripthammer npx supabase functions deploy paypal-webhook
docker compose exec scripthammer npx supabase functions deploy payment-status
```

### Step 4: Build Client Components

```bash
# Use component generator (5-file pattern mandatory)
docker compose exec scripthammer pnpm run generate:component --name DonateButton --category atomic --hasProps true
docker compose exec scripthammer pnpm run generate:component --name CheckoutButton --category atomic --hasProps true
docker compose exec scripthammer pnpm run generate:component --name SubscribeButton --category atomic --hasProps true
docker compose exec scripthammer pnpm run generate:component --name PaymentConsentModal --category molecular --hasProps true
```

### Step 5: Testing

```bash
# Local Supabase development
docker compose exec scripthammer npx supabase start

# Test Edge Functions locally
docker compose exec scripthammer npx supabase functions serve stripe-webhook

# Unit tests
docker compose exec scripthammer pnpm test src/utils/payment
docker compose exec scripthammer pnpm test src/components/payment

# E2E tests with Stripe test mode
docker compose exec scripthammer pnpm exec playwright test
```

---

## 5. Validation Loops

### Pre-Implementation Checks

- [ ] Supabase account created (free tier)
- [ ] Payment provider test accounts created
- [ ] Environment variables documented
- [ ] Database schema reviewed
- [ ] Edge Function architecture understood

### During Implementation

**After Each Task:**

- [ ] Type checking passes
- [ ] Edge Functions deploy successfully
- [ ] Database queries work
- [ ] Client-side can call Edge Functions
- [ ] Webhook signatures verify correctly

### Post-Implementation Verification

- [ ] Stripe one-time payment works end-to-end
- [ ] Stripe subscription creation works
- [ ] PayPal payment works
- [ ] Webhooks process correctly (idempotency)
- [ ] Payment status updates in database
- [ ] Subscription retry logic functions
- [ ] GDPR consent modal shows before payment scripts
- [ ] Test coverage >90% for payment logic
- [ ] Template user can set up in 15 minutes

---

## 6. Risk Mitigation

### Risk 1: Supabase Dependency

**Impact**: Medium - Template users must create Supabase account
**Probability**: High - Required for functionality
**Mitigation**:

- Free tier generous (500MB DB, 2M function calls/month)
- No credit card required
- 15-minute setup with clear documentation
- Alternative: Document client-only mode (limited features)

### Risk 2: Edge Function Cold Starts

**Impact**: Low - First request may be slower
**Probability**: Medium - After inactivity
**Mitigation**:

- Cold start ~1-2 seconds (acceptable)
- Functions warm up quickly
- Can use Supabase cron jobs to keep warm

### Risk 3: Webhook Signature Verification

**Impact**: High - Security vulnerability if broken
**Probability**: Low - Stripe/PayPal SDKs handle this
**Mitigation**:

- Use official SDK verification methods
- 100% test coverage for webhook handlers
- Comprehensive error logging

### Risk 4: Database Storage Limits

**Impact**: Low - Free tier has limits
**Probability**: Low - Payment data is small
**Mitigation**:

- 500MB free tier = ~100K payment records
- Auto-cleanup of old webhook events
- Clear upgrade path if needed

---

## 7. References

### Supabase

- [Supabase Documentation](https://supabase.com/docs)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Database Migrations](https://supabase.com/docs/guides/cli/local-development)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

### Stripe

- [Stripe.js Reference](https://stripe.com/docs/js)
- [Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Webhooks Guide](https://stripe.com/docs/webhooks)
- [Testing with Stripe CLI](https://stripe.com/docs/stripe-cli)

### PayPal

- [PayPal Checkout Integration](https://developer.paypal.com/docs/checkout/)
- [Webhook Events](https://developer.paypal.com/api/rest/webhooks/)
- [Sandbox Testing](https://developer.paypal.com/tools/sandbox/)

### Related PRPs

- **PRP-007**: Cookie Consent & GDPR
- **PRP-010**: EmailJS Integration (provider pattern)
- **PRP-013**: Calendar Integration (consent pattern)

---

## PRP Workflow Status

### Review Checklist (Inbox → Ready)

- [ ] Supabase architecture approved
- [ ] Database schema reviewed
- [ ] Edge Function approach confirmed
- [ ] Security requirements clear
- [ ] Template user setup time acceptable (<30 min)
- [ ] Approved by: [PENDING]

### Processing Status (Ready → Completed)

- [ ] Feature branch created (`015-payment-integration`)
- [ ] Supabase project initialized
- [ ] Database schema deployed
- [ ] Edge Functions implemented
- [ ] Client components created
- [ ] Tests passing (>90% coverage)
- [ ] Template user guide complete
- [ ] Completed on: [PENDING]

---

<!--
PRP-015: Payment Integration System (Supabase Backend)
Production-ready payment processing for static sites using Supabase Edge
Functions for webhooks and PostgreSQL for payment tracking. Supports Stripe,
PayPal, Cash App, and Chime with GDPR compliance and comprehensive testing.
-->
