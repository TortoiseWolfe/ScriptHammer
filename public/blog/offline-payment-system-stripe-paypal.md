---
title: 'Offline Payment: Stripe, PayPal & GDPR'
author: TortoiseWolfe
date: 2025-10-09
slug: offline-payment-system-stripe-paypal
tags:
  - payments
  - stripe
  - paypal
  - supabase
  - edge-functions
  - offline-first
  - gdpr
categories:
  - tutorials
  - monetization
excerpt: Learn how to build offline-first payments on GitHub Pages with Supabase Edge Functions, Stripe, PayPal, GDPR consent, and IndexedDB resilience.
featuredImage: /blog-images/offline-payment-system-stripe-paypal/featured-og.svg
featuredImageAlt: Offline-First Payment System with Stripe, PayPal, Supabase Edge Functions, and GDPR Consent
ogImage: /blog-images/offline-payment-system-stripe-paypal/featured-og.png
ogTitle: Offline-First Payment System - Stripe, PayPal & Static Sites
ogDescription: Complete guide to implementing payments on GitHub Pages using Supabase Edge Functions, multiple providers, GDPR compliance, and offline-first architecture with IndexedDB.
twitterCard: summary_large_image
---

# Offline-First Payment System: Stripe, PayPal & GDPR on Static Sites

Static sites (like GitHub Pages) don't have servers. So how do you accept payments without a backend? You can't run payment webhooks, you can't hide API (Application Programming Interface) keys, and you definitely can't store customer data in static files.

This post documents our solution: an offline-first payment system using [Supabase Edge Functions](https://supabase.com/docs/guides/functions), multiple payment providers (Stripe, PayPal, Cash App, Chime), General Data Protection Regulation (GDPR) consent management, and [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) queuing for network resilience. This isn't a Stripe checkout tutorial—this is production-grade monetization for static sites.

## 💳 The Static Site Payment Problem

Static sites can't:

1. **Process webhooks**: No server = no endpoint for Stripe/PayPal to POST payment confirmations
2. **Hide secrets**: All JavaScript code is public, exposing API keys
3. **Store payment data**: No database = payment records disappear on page refresh
4. **Handle network failures**: Payment initiated offline has nowhere to go

Traditional solutions like Stripe Checkout Links work for one-time payments but can't:

- Track payment history per user
- Handle subscriptions with retry logic
- Verify webhook signatures (critical for security)
- Queue operations when offline

We needed a real backend that doesn't require maintaining servers.

## 🗄️ Why Supabase Edge Functions?

After evaluating Vercel Functions, Netlify Functions, and AWS Lambda, we chose Supabase for four reasons:

1. **Database Included**: PostgreSQL (Structured Query Language) for payment records, Row-Level Security (RLS) for data isolation, built-in authentication
2. **Webhook-Ready**: Persistent endpoints that don't cold-start (Stripe requires <5s response time)
3. **Type Safety**: Share TypeScript types between frontend and Edge Functions
4. **No Vendor Lock-In**: Runs on Deno, open-source runtime

Vercel Functions are great for Next.js but require their hosting. AWS Lambda is enterprise-grade but complex. Supabase gives us enterprise features with static site simplicity.

## 🔨 What We Built: Architecture Overview

Here's the complete payment system architecture:

### Payment Providers

- **Stripe**: Credit card payments (one-time + subscriptions)
- **PayPal**: PayPal balance + credit cards (one-time + subscriptions)
- **Cash App**: Direct `$cashtag` links (no external scripts)
- **Chime**: Direct `$chimesign` links (no external scripts)

### Core Features

- **One-Time Payments**: $1.00 - $999.99 with 5 currency support (USD, EUR, GBP, CAD, AUD)
- **Recurring Subscriptions**: Monthly/yearly billing with automatic retry on failure
- **Failed Payment Handling**: 3-day retry schedule with 7-day grace period
- **Payment History**: Real-time dashboard with transaction details
- **Webhook Verification**: Signature validation prevents fraudulent notifications

### Privacy & GDPR Compliance

- **Consent Modal**: Request permission before loading Stripe/PayPal scripts
- **Data Transparency**: Explain what data is collected and by whom
- **Consent Decline Fallback**: Show Cash App/Chime links (no scripts needed)

### Offline-First Architecture

- **IndexedDB Queue**: Store payment intents when offline
- **Background Sync**: Automatic upload when connection returns
- **Optimistic UI**: Instant feedback, sync in background

Let's build it.

## 🔧 Part 1: Payment Provider Setup

### Stripe Configuration

First, create a Stripe account at [stripe.com/dashboard](https://stripe.com/dashboard). Grab your **publishable key** (public) and **secret key** (private).

```bash
# .env (NEVER commit this file)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...  # Used in Edge Functions only
STRIPE_WEBHOOK_SECRET=whsec_...  # For webhook signature verification
```

The publishable key goes in frontend JavaScript. The secret key lives in Supabase Edge Functions (server-side).

### PayPal Configuration

PayPal is more complex—you need both REST API credentials AND a client-side SDK:

1. Create app at [developer.paypal.com/dashboard/applications](https://developer.paypal.com/dashboard/applications)
2. Get Client ID (public) and Secret (private)
3. Enable "Subscriptions" product in app settings

```bash
# .env
NEXT_PUBLIC_PAYPAL_CLIENT_ID=AX... # Public
PAYPAL_SECRET=EK...  # Edge Functions only
PAYPAL_WEBHOOK_ID=WH-...  # For signature verification
```

### Cash App & Chime

Cash App and Chime use direct links—no API keys, no consent modals, no external scripts:

```tsx
// Direct payment links
const cashAppLink = `https://cash.app/$${CASHTAG}/${amount}`;
const chimeLink = `https://chime.com/pay/${CHIMESIGN}?amount=${amount}`;
```

These are perfect GDPR-compliant fallbacks when users decline JavaScript consent.

## 🔒 Part 2: GDPR Consent Modal

Before loading Stripe or PayPal JavaScript, we **must** ask for consent (GDPR Article 7 requirement):

```tsx
// src/components/payment/PaymentConsentModal/PaymentConsentModal.tsx
import { useState } from 'react';

export function PaymentConsentModal({
  provider,
  onAccept,
  onDecline,
}: {
  provider: 'stripe' | 'paypal';
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const providerInfo = {
    stripe: {
      name: 'Stripe',
      url: 'https://stripe.com',
      data: 'Payment card details, email address, billing address',
      purpose: 'Process credit card payments securely',
    },
    paypal: {
      name: 'PayPal',
      url: 'https://paypal.com',
      data: 'PayPal account information, email address',
      purpose: 'Process PayPal and credit card payments',
    },
  };

  const info = providerInfo[provider];

  const handleAccept = async () => {
    setLoading(true);
    // Store consent in localStorage (not a cookie - user preference)
    localStorage.setItem(`${provider}_consent`, 'granted');
    onAccept();
  };

  const handleDecline = () => {
    localStorage.setItem(`${provider}_consent`, 'denied');
    onDecline();
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="text-lg font-bold">Payment Provider Consent</h3>

        <div className="py-4">
          <p className="mb-4">
            To process payments via <strong>{info.name}</strong>, we need to
            load their payment scripts. This will share some data with{' '}
            {info.name}.
          </p>

          <div className="alert alert-info">
            <svg className="h-6 w-6 shrink-0 stroke-current">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold">Data Shared with {info.name}:</p>
              <p className="text-sm">{info.data}</p>
            </div>
          </div>

          <p className="mt-4 text-sm">
            <strong>Purpose:</strong> {info.purpose}
            <br />
            <strong>Third Party:</strong>{' '}
            <a
              href={info.url}
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              {info.name} Privacy Policy
            </a>
          </p>

          <p className="text-base-content/70 mt-4 text-sm">
            <strong>Alternative:</strong> If you decline, you can still pay via
            Cash App or Chime (no external scripts required).
          </p>
        </div>

        <div className="modal-action">
          <button onClick={handleDecline} className="btn btn-ghost">
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Accept & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

This modal:

1. **Explains what data is shared** (GDPR transparency requirement)
2. **Links to provider's privacy policy** (GDPR Article 13)
3. **Offers alternative payment methods** (Cash App/Chime)
4. **Stores consent in localStorage** (user preference, not tracking cookie)

## 💰 Part 3: Payment Intent Creation

A **payment intent** represents the user's intention to pay before redirecting to Stripe/PayPal.

### Frontend: Create Intent

```tsx
// src/lib/payments/payment-service.ts
import { supabase } from '@/lib/supabase/client';
import { validateMetadata } from '@/lib/payments/metadata-validator';

export async function createPaymentIntent({
  amount,
  currency = 'usd',
  type,
  interval,
  description,
  metadata = {},
}: {
  amount: number;
  currency?: 'usd' | 'eur' | 'gbp' | 'cad' | 'aud';
  type: 'one_time' | 'recurring';
  interval?: 'month' | 'year';
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Must be authenticated to create payment');
  }

  // Validate metadata to prevent prototype pollution
  const validatedMetadata = validateMetadata(metadata);

  // Insert payment intent into database
  const { data, error } = await supabase
    .from('payment_intents')
    .insert({
      template_user_id: user.id, // Row-Level Security enforces this matches auth.uid()
      amount, // Amount in cents (e.g., 1000 = $10.00)
      currency,
      type,
      interval: type === 'recurring' ? interval : null,
      description,
      customer_email: user.email,
      metadata: validatedMetadata,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }

  return data;
}
```

### Metadata Validation

User-provided metadata can't contain dangerous keys like `__proto__` or `constructor`, and must fit within size limits:

```typescript
// src/lib/payments/metadata-validator.ts
const DANGEROUS_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

const MAX_METADATA_SIZE = 1024; // 1KB total
const MAX_NESTING_DEPTH = 2;

export function validateAndSanitizeMetadata(
  metadata: unknown
): Record<string, unknown> {
  // Must be a plain object
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('Metadata must be a plain object');
  }

  // Check for prototype pollution at all levels
  const pollutionError = checkPrototypePollution(metadata);
  if (pollutionError) {
    throw new Error(pollutionError);
  }

  // Check for circular references
  if (hasCircularReferences(metadata)) {
    throw new Error('Metadata cannot contain circular references');
  }

  // Check nesting depth (max 2 levels)
  const nestingDepth = getNestingDepth(metadata);
  if (nestingDepth > MAX_NESTING_DEPTH) {
    throw new Error(`Metadata nesting exceeds ${MAX_NESTING_DEPTH} levels`);
  }

  // Check array limits (max 100 items per array)
  const arrayError = checkArrayLimits(metadata);
  if (arrayError) {
    throw new Error(arrayError);
  }

  // Check total size limit (1KB for entire metadata object)
  const serialized = JSON.stringify(metadata);
  if (serialized.length > MAX_METADATA_SIZE) {
    throw new Error(`Metadata exceeds 1KB limit`);
  }

  // Sanitize by removing dangerous keys
  return sanitizeMetadata(metadata as Record<string, unknown>);
}
```

This prevents attacks like:

```javascript
// ❌ Attempt to pollute Object.prototype
createPaymentIntent({
  amount: 1000,
  metadata: {
    __proto__: { isAdmin: true }, // BLOCKED by validator
  },
});
```

## 💳 Part 4: Stripe Payment Flow

### Frontend: Redirect to Stripe Checkout

```tsx
// src/components/payment/PaymentButton/PaymentButton.tsx
import { loadStripe } from '@stripe/stripe-js';
import { createPaymentIntent } from '@/lib/payments/payment-service';

export function PaymentButton({
  amount,
  type,
}: {
  amount: number;
  type: 'one_time' | 'recurring';
}) {
  const [loading, setLoading] = useState(false);

  const handleStripePayment = async () => {
    setLoading(true);

    try {
      // Check consent
      const consent = localStorage.getItem('stripe_consent');
      if (consent !== 'granted') {
        // Show consent modal first
        return;
      }

      // Create payment intent in database
      const intent = await createPaymentIntent({
        amount,
        type,
        currency: 'usd',
      });

      // Call Edge Function to create Stripe session
      const { data, error } = await supabase.functions.invoke(
        'stripe-create-payment',
        {
          body: { intent_id: intent.id },
        }
      );

      if (error) throw error;

      // Redirect to Stripe Checkout
      const stripe = await loadStripe(
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
      );
      const { error: redirectError } = await stripe!.redirectToCheckout({
        sessionId: data.session_id,
      });

      if (redirectError) throw redirectError;
    } catch (error) {
      console.error('Stripe payment error:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleStripePayment}
      disabled={loading}
      className="btn btn-primary"
    >
      {loading ? 'Processing...' : `Pay $${amount / 100} with Stripe`}
    </button>
  );
}
```

### Edge Function: Stripe Checkout

**⚠️ Note**: This is an example implementation. ScriptHammer currently uses `stripe-webhook` for webhook handling. You'll need to create this Edge Function in your own project and adapt it to your specific requirements.

```typescript
// supabase/functions/stripe-create-payment/index.ts (example implementation)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  try {
    const { intent_id } = await req.json();

    // Get payment intent from database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Service role bypasses RLS
    );

    const { data: intent, error } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', intent_id)
      .single();

    if (error || !intent) {
      return new Response(
        JSON.stringify({ error: 'Payment intent not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: intent.currency,
            unit_amount: intent.amount,
            product_data: {
              name: intent.description || 'Payment',
            },
          },
          quantity: 1,
        },
      ],
      mode: intent.type === 'one_time' ? 'payment' : 'subscription',
      success_url: `${req.headers.get('origin')}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/payment-demo`,
      customer_email: intent.customer_email,
      metadata: {
        intent_id: intent.id, // Link back to our database
      },
    });

    return new Response(JSON.stringify({ session_id: session.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Stripe create payment error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

## 🔐 Part 5: Webhook Verification

Webhooks are **the only trustworthy payment confirmation**. Redirect callbacks can be faked—webhooks can't (if you verify signatures).

### Stripe Webhook Handler

```typescript
// supabase/functions/stripe-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

serve(async (req) => {
  try {
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    // CRITICAL: Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature!, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Store webhook event (idempotency - prevent duplicate processing)
    const { error: eventError } = await supabase.from('webhook_events').insert({
      provider: 'stripe',
      provider_event_id: event.id,
      event_type: event.type,
      event_data: event.data,
      signature: signature!,
      signature_verified: true,
    });

    if (eventError) {
      // Duplicate event ID - already processed
      if (eventError.code === '23505') {
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw eventError;
    }

    // Process event based on type
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Record payment result
        await supabase.from('payment_results').insert({
          intent_id: session.metadata?.intent_id,
          provider: 'stripe',
          transaction_id: session.id,
          status: 'succeeded',
          charged_amount: session.amount_total,
          charged_currency: session.currency,
          webhook_verified: true,
          verification_method: 'webhook',
        });

        // Mark webhook as processed
        await supabase
          .from('webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('provider_event_id', event.id);

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;

        // Increment failed payment counter for subscription
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('failed_payment_count')
          .eq('provider_subscription_id', invoice.subscription as string)
          .single();

        if (subscription) {
          const failedCount = (subscription.failed_payment_count || 0) + 1;

          // Update retry schedule
          await supabase
            .from('subscriptions')
            .update({
              failed_payment_count: failedCount,
              status: failedCount >= 3 ? 'grace_period' : 'past_due',
              grace_period_expires:
                failedCount >= 3
                  ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                  : null,
            })
            .eq('provider_subscription_id', invoice.subscription as string);
        }

        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

### Webhook Security Checklist

✅ **Verify signature** before processing (prevents fake webhooks)
✅ **Store event ID** to prevent duplicate processing (idempotency)
✅ **Return 200 quickly** (<5 seconds or Stripe retries)
✅ **Process asynchronously** if operations take >5 seconds
✅ **Log failures** for manual retry

## 📦 Part 6: Offline-First with IndexedDB

Network failures happen. Users click "Pay" on the subway, at coffee shops, on airplanes. We queue operations locally and sync when connection returns.

### IndexedDB Queue Setup

```typescript
// src/lib/payments/offline-queue.ts
import Dexie, { type Table } from 'dexie';

export interface QueuedPayment {
  id?: number;
  intent_id: string;
  provider: 'stripe' | 'paypal';
  amount: number;
  currency: string;
  created_at: number;
  retry_count: number;
}

class OfflineQueue extends Dexie {
  payments!: Table<QueuedPayment>;

  constructor() {
    super('PaymentQueue');
    this.version(1).stores({
      payments: '++id, intent_id, provider, created_at',
    });
  }
}

const db = new OfflineQueue();

export async function queuePayment(
  payment: Omit<QueuedPayment, 'id' | 'created_at' | 'retry_count'>
) {
  await db.payments.add({
    ...payment,
    created_at: Date.now(),
    retry_count: 0,
  });
}

export async function processQueue() {
  const queuedPayments = await db.payments.toArray();

  for (const payment of queuedPayments) {
    try {
      // Attempt to sync with backend
      const { error } = await supabase.functions.invoke(
        `${payment.provider}-create-payment`,
        {
          body: { intent_id: payment.intent_id },
        }
      );

      if (!error) {
        // Success - remove from queue
        await db.payments.delete(payment.id!);
      } else {
        // Increment retry count
        await db.payments.update(payment.id!, {
          retry_count: payment.retry_count + 1,
        });

        // Delete after 3 failed retries
        if (payment.retry_count >= 3) {
          await db.payments.delete(payment.id!);
        }
      }
    } catch (error) {
      console.error('Failed to process queued payment:', error);
    }
  }
}

// Listen for online event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Network reconnected - processing payment queue');
    processQueue();
  });
}
```

### Usage in Payment Button

```tsx
const handlePayment = async () => {
  try {
    // Create payment intent
    const intent = await createPaymentIntent({ amount, type, currency });

    // Check if online
    if (!navigator.onLine) {
      // Queue for later
      await queuePayment({
        intent_id: intent.id,
        provider: 'stripe',
        amount,
        currency,
      });

      alert('You are offline. Payment will process when connection returns.');
      return;
    }

    // Online - process immediately
    const { data } = await supabase.functions.invoke('stripe-create-payment', {
      body: { intent_id: intent.id },
    });

    // Redirect to checkout
    const stripe = await loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
    );
    await stripe!.redirectToCheckout({ sessionId: data.session_id });
  } catch (error) {
    console.error('Payment error:', error);
  }
};
```

## 🔄 Part 7: Subscription Retry Logic

When a subscription payment fails, Stripe retries automatically. We enhance this with custom retry schedules and grace periods:

### Failed Payment Retry Schedule

```typescript
// Retry schedule: Day 1, Day 3, Day 7
const RETRY_SCHEDULE = {
  day_1: 1 * 24 * 60 * 60 * 1000, // 1 day in milliseconds
  day_3: 3 * 24 * 60 * 60 * 1000,
  day_7: 7 * 24 * 60 * 60 * 1000,
};

// When payment fails (from webhook)
async function handlePaymentFailure(subscriptionId: string) {
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('provider_subscription_id', subscriptionId)
    .single();

  if (!subscription) return;

  const failedCount = subscription.failed_payment_count + 1;

  // Update retry tracking
  const retrySchedule = subscription.retry_schedule || {
    day_1: false,
    day_3: false,
    day_7: false,
  };

  if (failedCount === 1) {
    retrySchedule.day_1 = true;
  } else if (failedCount === 2) {
    retrySchedule.day_3 = true;
  } else if (failedCount === 3) {
    retrySchedule.day_7 = true;
  }

  await supabase
    .from('subscriptions')
    .update({
      failed_payment_count: failedCount,
      retry_schedule: retrySchedule,
      status: failedCount >= 3 ? 'grace_period' : 'past_due',
      grace_period_expires:
        failedCount >= 3
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : null,
    })
    .eq('id', subscription.id);

  // Send notification to user
  await sendPaymentFailureEmail(subscription.customer_email, failedCount);
}
```

After 3 failed retries, the subscription enters a **7-day grace period**. If payment succeeds during grace, resume subscription. If grace expires, cancel subscription.

## 💡 Part 8: What We Learned

### Lesson 1: Webhook Idempotency Required

Stripe sends duplicate webhooks. Without idempotency checks, you'll double-charge customers or double-credit accounts.

**Solution**: Store `provider_event_id` with UNIQUE constraint:

```sql
CREATE UNIQUE INDEX idx_webhook_events_provider_event_id
  ON webhook_events(provider, provider_event_id);
```

When inserting fails with error code `23505` (duplicate key), **return 200** to Stripe (event already processed).

### Lesson 2: Use Webhook Forwarding

Stripe can't POST to `localhost:3000`. Use [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward webhooks during development:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks to local Supabase function
stripe listen --forward-to https://your-project.supabase.co/functions/v1/stripe-webhook
```

This gives you **real webhook events** in development, exposing edge cases you'd miss with mocked data.

### Lesson 3: GDPR Fallback Options

You can't force users to accept JavaScript. If they decline Stripe/PayPal consent, **you must provide alternatives**:

- Cash App links (no scripts)
- Chime links (no scripts)
- Bank transfer instructions
- Crypto payment addresses

Without fallbacks, declining consent = no payment = lost revenue.

### Lesson 4: Validate Metadata Security

User-provided metadata goes into JSON columns. Without validation, attackers can inject:

```javascript
// ❌ Prototype pollution attack
{
  "__proto__": {
    "isAdmin": true
  }
}
```

**Solution**: Reject dangerous keys (`__proto__`, `constructor`, `prototype`) and limit metadata size.

### Lesson 5: Handle Partial Failures

Network can fail mid-request. IndexedDB queue must handle:

1. **Payment intent created** but Edge Function call failed → Queue with intent ID
2. **Edge Function succeeded** but Stripe API failed → Retry with same intent ID (Stripe handles duplicates)
3. **Stripe succeeded** but webhook lost → Webhook retry handles this

**Never delete from queue until webhook confirms payment.**

## ✅ Conclusion: Payments Without Servers

Static sites can't run servers, but they can:

1. **Delegate backend to Supabase Edge Functions** (webhook endpoints, database storage)
2. **Queue operations offline with IndexedDB** (network resilience)
3. **Verify webhooks cryptographically** (prevent fake confirmations)
4. **Comply with GDPR** (consent modals, privacy-preserving fallbacks)

The result? A production-grade payment system that works on GitHub Pages, scales to thousands of transactions, and respects user privacy.

For authentication to protect these payments, read: [Production-Ready Authentication with Supabase](/blog/authentication-supabase-oauth).

---

**Want to see the full implementation?** Check out the [ScriptHammer GitHub repository](https://github.com/TortoiseWolfe/ScriptHammer).
