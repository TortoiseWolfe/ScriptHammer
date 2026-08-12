# Payment Integration Deployment Guide

This guide helps template forkers deploy the payment integration system to their own Supabase project. It assumes you have already followed the standard fork setup (`docs/FORKING.md`) and have a working `docker compose up`.

## Status of the integration

| Component                                                                                 | Status                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database schema (`payment_intents`, `payment_results`, `subscriptions`, `webhook_events`) | ✅ shipped in the monolithic migration                                                                                                                                                               |
| RLS policies (20+ across the 4 tables)                                                    | ✅ verified by `pnpm test:rls`                                                                                                                                                                       |
| Service layer (`src/lib/payments/payment-service.ts`)                                     | ✅ shipped                                                                                                                                                                                           |
| Components (`PaymentButton`, `PaymentStatusDisplay`, `SubscriptionManager`, etc.)         | ✅ shipped (full 5-file pattern)                                                                                                                                                                     |
| `/payment-demo` and `/payment-result` routes                                              | ✅ shipped                                                                                                                                                                                           |
| **Outbound Edge Functions** (browser → provider checkout creation)                        | ✅ all 8 deployed + live-proven: Stripe one-off (PR #155), PayPal one-off (PR #160), Stripe subscription + cancel/resume (PR #167), PayPal subscription (PR #171). Full payment epic (#100) complete |
| **Inbound Edge Functions** (provider webhooks → DB)                                       | ✅ shipped (`stripe-webhook`, `paypal-webhook`, `send-payment-email`); `stripe-webhook` live-proven end-to-end (PR #167). `send-payment-email` stays inert until `RESEND_API_KEY` is set             |

**Operator note:** every payment leg works once sandbox keys are configured — Stripe tab (one-off + Subscribe), PayPal tab (one-off + Subscribe), and subscription cancel/resume on `/payment?tab=subscriptions` — each driven against the real sandbox. PayPal subscriptions need `NEXT_PUBLIC_PAYPAL_PLAN_ID` set to a PayPal billing Plan; without it the recurring PayPal button shows a clear "not configured" error instead of falling back to a one-time order.

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
NEXT_PUBLIC_STRIPE_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your-paypal-client-id
```

**`NEXT_PUBLIC_STRIPE_PRICE_ID`** powers the recurring Subscribe flow: the plan
amount and interval live on an operator-created Stripe **Price** object, not in
code. Create it in the Stripe dashboard (test mode → Product catalog → add a
recurring price), or via the API with an idempotent lookup key:

```bash
curl -u "sk_test_…:" https://api.stripe.com/v1/prices \
  -d "unit_amount=999" -d "currency=usd" -d "recurring[interval]=month" \
  -d "product_data[name]=My Subscription" -d "lookup_key=my_monthly"
```

Also add these `NEXT_PUBLIC_*` values as **GitHub Actions secrets** — the
deploy workflow (`.github/workflows/deploy.yml`) bakes them into the
production build; without them, the deployed site renders payments as "not
configured".

### 3.2 Secrets → Supabase Vault (NEVER in `.env`)

This template deploys to GitHub Pages (static export). **There is no Next.js server runtime that can read non-NEXT*PUBLIC* vars at request time.** Server-side logic runs in Supabase Edge Functions, which read secrets via `Deno.env.get(...)` after they're set in Supabase Vault.

**Recommended — CLI-free, via the Management API** (this repo forbids installing the Supabase CLI locally; see the root `CLAUDE.md`). The setter reads its allow-listed Edge Function values from `.env` by default:

```bash
# 1. Fill the payment-provider values in .env. On macOS/Linux, make the
# secret-bearing file owner-only. Gitignore prevents commits; chmod prevents other
# local accounts from reading it. The setter refuses an unsafe mode.
chmod 600 .env

# 2. Dry-run (name-level diff; values never printed), then apply:
docker compose exec scripthammer pnpm supabase:secrets
docker compose exec scripthammer pnpm supabase:secrets --apply
```

This uses the `SUPABASE_ACCESS_TOKEN` + project ref already in `.env` to call `POST /v1/projects/{ref}/secrets`. It sends only the allow-listed provider secrets plus the function-side site URL:

```
STRIPE_SECRET_KEY        sk_test_…
STRIPE_WEBHOOK_SECRET    whsec_…
PAYPAL_CLIENT_SECRET     …
PAYPAL_WEBHOOK_ID        …
NEXT_PUBLIC_SITE_URL     https://yourdomain.com
```

> **`NEXT_PUBLIC_SITE_URL` (as a FUNCTION secret) is required before live
> traffic.** The checkout functions build `success_url`/`cancel_url` from it
> (unset ⇒ they default to `http://localhost:3000`), and `_shared/cors.ts`
> derives the allowed browser origin from it. It may carry a basePath for
> GitHub Pages project sites (e.g. `https://user.github.io/MyFork`) — CORS
> compares origins only, so the path is safe.

> **Do NOT set `SUPABASE_SERVICE_ROLE_KEY` (or any `SUPABASE_*` var) as an Edge Function secret.** The platform auto-injects them, and the Management API rejects any secret name starting with `SUPABASE_`. The functions read the service-role key from the injected env.

An existing JSON sidecar remains supported, but it is not the default. Pass it
explicitly and make it owner-only before use:

```bash
chmod 600 scripts/supabase/edge-function-secrets.json
docker compose exec scripthammer pnpm supabase:secrets --config \
  scripts/supabase/edge-function-secrets.json
```

**Alternatives:** `supabase secrets set NAME=value` (CLI) or the Supabase dashboard → Project Settings → Edge Functions → Secrets.

### 3.3 Quick verification

The template ships a verifier script:

```bash
./scripts/check-payment-config.sh
```

It reads your `.env`, queries `supabase secrets list`, and reports which of the 9 required values are missing.

## Step 4 — Deploy Edge Functions

> **All 11 functions are already deployed to this project's prod** (via the
> Management API `POST /v1/projects/{ref}/functions/deploy`, CLI-free — the same
> token used for secrets in §3.2). The `supabase functions deploy` commands below
> are the CLI equivalent, kept for forkers deploying to a fresh project. Verify
> what's live with the dashboard → Edge Functions, or
> `GET /v1/projects/{ref}/functions`.

### 4.1 Inbound webhooks

```bash
supabase functions deploy stripe-webhook
supabase functions deploy paypal-webhook
supabase functions deploy send-payment-email
```

Each command prints the deployed URL (form: `https://<project-ref>.supabase.co/functions/v1/<name>`). Save these — they go into the provider dashboards in Step 5.

### 4.2 Outbound checkout / subscription functions

```bash
# Stripe one-off + subscription
supabase functions deploy create-stripe-checkout
supabase functions deploy verify-stripe-session
supabase functions deploy create-stripe-subscription

# PayPal one-off (#103)
supabase functions deploy create-paypal-order
supabase functions deploy capture-paypal-order

# PayPal subscription (#104)
supabase functions deploy create-paypal-subscription

# Subscription lifecycle (#105)
supabase functions deploy cancel-subscription
supabase functions deploy resume-subscription
```

**Subscription operator note:** Phase 0b assumes you've created a recurring `Price` object in the Stripe dashboard ahead of time. The `price_id` (e.g. `price_1AbCdEf...`) gets passed to `create-stripe-subscription` by the browser. The `subscriptions` table row is **inserted by the existing `stripe-webhook` handler** when `customer.subscription.created` fires — not by `create-stripe-subscription` itself. The two are paired: the subscription session sets `subscription_data.metadata.template_user_id` so the webhook can satisfy the table's NOT NULL constraint. Re-deploy `stripe-webhook` after Phase 0b lands (the handler logic was updated in the same PR).

All functions above are deployed to this project's prod (see the Step 4 note). On a fresh fork, browser code that calls a not-yet-deployed function fails at the fetch step with a 404, so deploy the full set before driving the UI. Once they're deployed **and** sandbox keys are set (§3.2), `/payment` works end-to-end.

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
