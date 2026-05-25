# Payment Integration Deployment Guide

This guide helps template forkers deploy the payment integration system to their own Supabase project. It assumes you have already followed the standard fork setup (`docs/FORKING.md`) and have a working `docker compose up`.

## Status of the integration

| Component                                                                                 | Status                                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Database schema (`payment_intents`, `payment_results`, `subscriptions`, `webhook_events`) | ✅ shipped in the monolithic migration                                                                                                    |
| RLS policies (20+ across the 4 tables)                                                    | ✅ verified by `pnpm test:rls`                                                                                                            |
| Service layer (`src/lib/payments/payment-service.ts`)                                     | ✅ shipped                                                                                                                                |
| Components (`PaymentButton`, `PaymentStatusDisplay`, `SubscriptionManager`, etc.)         | ✅ shipped (full 5-file pattern)                                                                                                          |
| `/payment-demo` and `/payment-result` routes                                              | ✅ shipped                                                                                                                                |
| **Outbound Edge Functions** (browser → provider checkout creation)                        | ⏳ **Partially shipped** — Phase 0a (Stripe one-off) ✅; rest tracked in [#100](https://github.com/TortoiseWolfe/ScriptHammer/issues/100) |
| **Inbound Edge Functions** (provider webhooks → DB)                                       | ✅ shipped (`stripe-webhook`, `paypal-webhook`, `send-payment-email`)                                                                     |

**Operator note:** Phase 0a (Stripe one-off) ships in [PR #99 + #d0ba029] — clicking "Pay" on `/payment-demo` with the **Stripe tab** works once sandbox keys are configured. The **PayPal tab** and the subscription paths still fail with 404 until the remaining phases ship (tracked in [#100](https://github.com/TortoiseWolfe/ScriptHammer/issues/100), sub-issues [#102](https://github.com/TortoiseWolfe/ScriptHammer/issues/102)–[#106](https://github.com/TortoiseWolfe/ScriptHammer/issues/106)). Setting API keys alone is no longer enough on its own for everything — Phase 0a is the minimum for Stripe one-off payments.

## Prerequisites

- A forked ScriptHammer repo, configured per `docs/FORKING.md`
- A Supabase project (free tier works for development)
- A Stripe account (for Stripe payments — sandbox to start)
- A PayPal Business account (for PayPal payments — sandbox to start)
- The Supabase CLI installed **on your host** (not inside the container — the CLI needs to authenticate via browser flow):

  ```bash
  # macOS
  brew install supabase/tap/supabase

  # Linux / WSL2
  curl -L https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz
  sudo mv supabase /usr/local/bin/
  ```

## Step 1 — Link your Supabase project

### 1.1 Create the project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project Ref** (Project Settings → General → Reference ID)
3. Note the **Project URL** and **anon key** (Project Settings → API)
4. Generate a **service role key** (same page) — treat this as a secret

### 1.2 Link locally

```bash
# Authenticate (opens a browser)
supabase login

# Link to your project
supabase link --project-ref your-project-ref
```

## Step 2 — Apply the database migration

```bash
supabase db push
```

This applies `supabase/migrations/20251006_complete_monolithic_setup.sql`, which creates:

- `payment_intents` (with `idempotency_key`, `parent_intent_id` columns; provider correlation lives on `payment_results.transaction_id`)
- `payment_results`
- `subscriptions`
- `webhook_events`
- All RLS policies
- Required indexes

### Verify

In Supabase Dashboard → Table Editor, confirm all four tables exist. Run `pnpm test:rls` locally to confirm policies pass.

## Step 3 — Environment variables

The template splits variables into two groups, and **conflating them is a security violation**:

### 3.1 Browser-safe vars → `.env` (committed-shaped but `.env` itself is gitignored)

These get exposed in the browser bundle and are safe to be public. Set in your `.env` file (copy from `.env.example`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your-paypal-client-id
```

### 3.2 Secrets → Supabase Vault (NEVER in `.env`)

This template deploys to GitHub Pages (static export). **There is no Next.js server runtime that can read non-NEXT*PUBLIC* vars at request time.** Server-side logic runs in Supabase Edge Functions, which read secrets via `Deno.env.get(...)` after they're set in Supabase Vault.

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_actual_key
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_actual_secret
supabase secrets set PAYPAL_CLIENT_SECRET=your_paypal_secret
supabase secrets set PAYPAL_WEBHOOK_ID=your_paypal_webhook_id
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Verify with `supabase secrets list` — you should see 5 entries (the values are masked).

### 3.3 Quick verification

The template ships a verifier script:

```bash
./scripts/check-payment-config.sh
```

It reads your `.env`, queries `supabase secrets list`, and reports which of the 9 required values are missing.

## Step 4 — Deploy Edge Functions

### 4.1 Inbound webhooks (currently shipped)

```bash
supabase functions deploy stripe-webhook
supabase functions deploy paypal-webhook
supabase functions deploy send-payment-email
```

Each command prints the deployed URL (form: `https://<project-ref>.supabase.co/functions/v1/<name>`). Save these — they go into the provider dashboards in Step 5.

### 4.2 Outbound checkout creators

Phase 0a ✅ shipped (Stripe one-off):

```bash
supabase functions deploy create-stripe-checkout
supabase functions deploy verify-stripe-session
```

Remaining (tracked in [#100](https://github.com/TortoiseWolfe/ScriptHammer/issues/100)):

```bash
# Phase 0b (#102) — Stripe subscription
supabase functions deploy create-stripe-subscription

# Phase 0c (#103) — PayPal one-off
supabase functions deploy create-paypal-order
supabase functions deploy capture-paypal-order

# Phase 0d (#104) — PayPal subscription
supabase functions deploy create-paypal-subscription

# Phase 0e (#105) — Subscription lifecycle
supabase functions deploy cancel-subscription
supabase functions deploy resume-subscription
```

Until all 8 ship, browser code that calls a non-shipped function will fail at the fetch step with a 404. **Phase 0a alone unlocks the one-off Stripe checkout flow** — `/payment-demo` Stripe tab works end-to-end once sandbox keys are configured.

## Step 5 — Register webhooks in provider dashboards

### 5.1 Stripe

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. **Endpoint URL**: the URL printed by `supabase functions deploy stripe-webhook` in Step 4
3. **Events to send**:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `invoice.payment_failed`
   - `charge.refunded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. After saving, copy the **signing secret** (`whsec_...`)
5. Update Supabase Vault: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`

### 5.2 PayPal

1. PayPal Developer Dashboard → your sandbox app → Webhooks → Add Webhook
2. **Webhook URL**: the URL printed by `supabase functions deploy paypal-webhook` in Step 4
3. **Event types**:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `BILLING.SUBSCRIPTION.CREATED`
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.UPDATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
4. After saving, copy the **Webhook ID** (a UUID-shaped string)
5. Update Supabase Vault: `supabase secrets set PAYPAL_WEBHOOK_ID=...`

> Note: The earlier `PAYMENT.SALE.COMPLETED` event family is PayPal's classic API and only fires for certain legacy flows. The modern PayPal Orders v2 API uses `PAYMENT.CAPTURE.*` events. The `stripe-webhook` source still listens for both for legacy compatibility, but new integrations should subscribe to the modern names only.

## Step 6 — Smoke-test locally (after Phase 0 ships)

```bash
docker compose up
# (container runs `pnpm dev` automatically via the entrypoint)
```

Then in your browser:

1. Navigate to `/payment-demo`
2. Accept the GDPR consent modal
3. **Stripe path**: select Stripe tab, click Pay $20.00, use test card `4242 4242 4242 4242`, any future expiry, any CVC
   - Expected: redirect to Stripe Checkout, complete purchase, return to `/payment-result?status=succeeded`
   - Verify: `payment_intents` row with `provider='stripe'` and `status='succeeded'`
4. **PayPal path**: select PayPal tab, use a sandbox buyer account (PayPal Developer → Sandbox → Accounts)
   - Expected: PayPal approval popup → return to demo → `/payment-result?status=succeeded`
   - Verify: `payment_intents` row with `provider='paypal'`
5. **Decline path**: use Stripe test card `4000 0000 0000 0002`
   - Expected: `/payment-result` shows "Card declined" with Retry button
   - Verify: Retry uses the same `idempotency_key` (no double-charge)

## Step 7 — Test webhooks with Stripe CLI

To verify webhook delivery while developing locally:

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux / WSL2
curl -L https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_x86_64.tar.gz | tar -xz
sudo mv stripe /usr/local/bin/

# Authenticate
stripe login

# Forward events to your deployed function
stripe listen --forward-to https://your-project.supabase.co/functions/v1/stripe-webhook
```

Trigger a test event:

```bash
stripe trigger payment_intent.succeeded
```

Verify a row appears in `webhook_events`.

## Step 8 — Go live

After sandbox smoke-test passes:

1. **Stripe**: Toggle from Test → Live mode in the dashboard. The keys regenerate — re-grab `pk_live_...`, `sk_live_...`, and create a new live webhook endpoint to grab its `whsec_...`.
2. **PayPal**: Repeat Step 5 in the Live (not Sandbox) dashboard.
3. **Update** `.env` and `supabase secrets set ...` with live values.
4. **Smoke-test** a $1 real charge on your own card via `/payment-demo`, then refund it from the provider dashboard. Confirm:
   - Money lands in Stripe / PayPal
   - `payment_intents.status = 'succeeded'`
   - Refund → `charge.refunded` webhook → `payment_results.refund_status` updated

## Monitoring

- Supabase Dashboard → Table Editor → `payment_intents` for recent payments
- Supabase Dashboard → Table Editor → `webhook_events` for inbound webhook delivery
- Supabase Dashboard → Edge Functions → Logs for function execution traces
- Provider dashboards (Stripe / PayPal) for the source-of-truth ledger

## Common issues

| Symptom                                               | Cause                                                                    | Fix                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Pay button fails with 404                             | Outbound Edge Functions not deployed (Phase 0 work)                      | Wait for Phase 0 to land, or implement the missing functions                             |
| Webhook signature failed                              | `STRIPE_WEBHOOK_SECRET` doesn't match the live endpoint's signing secret | Re-fetch from Stripe Dashboard → Webhooks → Signing secret, `supabase secrets set` again |
| RLS policy denied                                     | `SUPABASE_SERVICE_ROLE_KEY` not set in Vault                             | `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`                                     |
| Payment not appearing in DB                           | Webhook not registered or pointing at wrong URL                          | Verify Step 5; in Stripe Dashboard → Events you should see deliveries                    |
| Stripe checkout returns user to dev URL in production | `success_url` / `cancel_url` not set per-environment                     | The outbound function should read `NEXT_PUBLIC_SITE_URL` to construct return URLs        |

## Security checklist

- ✅ `SUPABASE_SERVICE_ROLE_KEY` is in Vault, not in `.env`
- ✅ `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are in Vault
- ✅ `PAYPAL_CLIENT_SECRET` / `PAYPAL_WEBHOOK_ID` are in Vault
- ✅ Only `NEXT_PUBLIC_*` prefixed vars are in `.env`
- ✅ `.env` is in `.gitignore` (check `git check-ignore .env`)
- ✅ Stripe / PayPal sandbox keys never deployed to production-domain Supabase project
- ✅ HTTPS enforced (Supabase functions are HTTPS by default)

## Testing

```bash
docker compose exec scripthammer pnpm exec playwright test tests/e2e/payment/
```

Most tests are currently `test.skip()`'d because they require either Phase 0 to ship OR sandbox keys to be configured. The skip reasons are inline in each spec file.

## Reference

- **Architecture**: `docs/features/payment-integration.md`
- **Service contracts**: `src/types/payment.ts` (PaymentIntent, Currency, etc.)
- **Browser SDK shims**: `src/lib/payments/stripe.ts`, `src/lib/payments/paypal.ts`
- **DB-side lifecycle**: `src/lib/payments/payment-service.ts`
- **Tests**: `tests/e2e/payment/*.spec.ts`
- **Open issues tracking missing work**: [#3](https://github.com/TortoiseWolfe/ScriptHammer/issues/3), [#4](https://github.com/TortoiseWolfe/ScriptHammer/issues/4), [#5](https://github.com/TortoiseWolfe/ScriptHammer/issues/5), [#43](https://github.com/TortoiseWolfe/ScriptHammer/issues/43)
