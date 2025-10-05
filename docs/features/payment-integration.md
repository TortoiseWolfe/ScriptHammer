# Payment Integration Setup Guide

**Feature**: Payment Integration System
**Last Updated**: 2025-10-03
**Prerequisites**: GitHub account, Docker installed

---

## Overview

This guide walks you through setting up the complete payment integration system from scratch, including:

1. Supabase backend (database + Edge Functions)
2. Payment provider accounts (Stripe, PayPal)
3. Email notifications (Resend)
4. Environment configuration

**Estimated Time**: 30-45 minutes

---

## Step 1: Create Supabase Project

### 1.1 Sign Up for Supabase

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign in with GitHub (recommended)

### 1.2 Create New Project

1. Click "New project"
2. Fill in details:
   - **Name**: `scripthammer-payments` (or your project name)
   - **Database Password**: Generate strong password (save this!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier (sufficient for 10k payments/month)
3. Click "Create new project"
4. Wait 2-3 minutes for project to provision

### 1.3 Get Supabase Credentials

**On the main project dashboard** (the page you land on after creating your project):

1. Scroll to the bottom right - find the **"Project API"** section
2. Copy the **Project URL**: `https://xxxxx.supabase.co` (click Copy button)
3. Copy the **anon public** API Key (starts with `eyJh...`) - click Copy button

**Get the service_role key (REQUIRED - it's NOT on the main dashboard):**

4. Click **Settings** (gear icon) in the left sidebar
5. Under "DATA API" section, click **"API Keys"** (has "NEW" badge)
6. Find **service_role** key, click **"Reveal"** then click Copy (starts with `eyJh...`)

**Get the Project ID:**

7. In the left Settings sidebar, click **General**
8. Copy **Project ID** (alphanumeric code like `vswxgxbjodpgwfgsjrhq`)

**Database Password:**

9. The password you created in Step 1.2 (you saved it, right?)

### 1.4 Add Credentials to .env

Edit `/home/turtle_wolfe/repos/ScriptHammer/.env` and add:

```bash
# Supabase Project Configuration
SUPABASE_PROJECT_REF=abcdefgh
SUPABASE_DB_PASSWORD=your-database-password

# Supabase API Keys
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJh...your-service-role-key
```

**Security Note**: `.env` is gitignored. Never commit these keys!

---

## Step 2: Link Local Project to Supabase

### 2.1 Install Supabase CLI (if not already done)

The CLI was already installed in Phase 1, but verify:

```bash
docker compose exec scripthammer supabase --version
# Should show: 2.48.3 or similar
```

### 2.2 Link to Cloud Project

Now that credentials are in `.env`, link your local project:

```bash
# Link to your Supabase project (reads SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD from .env)
docker compose exec scripthammer supabase link --project-ref $SUPABASE_PROJECT_REF --password $SUPABASE_DB_PASSWORD
```

**Expected Output**:

```
Finished supabase link.
Local config differs from linked project. Try updating with supabase db pull.
```

**What just happened**: Supabase CLI created `supabase/.temp` directory and linked your local migrations to the cloud project.

### 2.3 Push Migrations to Supabase

Apply all 6 database migrations to your cloud project:

```bash
# Push migrations
docker compose exec scripthammer supabase db push

# Expected output shows 6 migrations applied:
# - 001_payment_intents
# - 002_payment_results
# - 003_webhook_events
# - 004_subscriptions
# - 005_payment_provider_config
# - 006_rls_policies
```

### 2.4 Generate TypeScript Types

Generate types from your live database schema:

```bash
# Generate types file
docker compose exec scripthammer sh -c 'supabase gen types typescript --linked > /app/src/lib/supabase/types.ts'

# Verify file created
docker compose exec scripthammer ls -lh /app/src/lib/supabase/types.ts
```

---

## Step 3: Set Up Stripe (Optional)

### 3.1 Create Stripe Account

1. Go to [stripe.com](https://stripe.com)
2. Sign up for an account
3. Activate account (requires business details)
4. Switch to **Test Mode** (toggle in top-right)

### 3.2 Get Stripe API Keys

1. Dashboard → **Developers** → **API keys**
2. Copy:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: Click "Reveal test key token" → `sk_test_...`

3. Add to `.env`:
   ```bash
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
   STRIPE_SECRET_KEY=sk_test_xxxxx
   ```

### 3.3 Set Up Stripe Webhook

**Note**: Webhook secret will be configured after deploying Edge Functions (Step 6)

For now, just note where webhooks are configured:

- Dashboard → **Developers** → **Webhooks** → **Add endpoint**

You'll add the endpoint URL after deploying Edge Functions.

---

## Step 4: Set Up PayPal (Optional)

### 4.1 Create PayPal Developer Account

1. Go to [developer.paypal.com](https://developer.paypal.com)
2. Log in or create account
3. Go to **Dashboard** → **My Apps & Credentials**
4. Switch to **Sandbox** mode

### 4.2 Create App

1. Click **Create App**
2. App Name: `ScriptHammer Payments`
3. Select **Merchant** account type
4. Click **Create App**

### 4.3 Get PayPal Credentials

From your app page, copy:

- **Client ID**: `AXXXxxxxx`
- **Secret**: Click "Show" → copy value

Add to `.env`:

```bash
NEXT_PUBLIC_PAYPAL_CLIENT_ID=AXXXxxxxx
PAYPAL_CLIENT_SECRET=your-secret
```

### 4.4 Configure PayPal Webhook (Later)

Webhook configuration happens after Edge Function deployment (Step 6).

---

## Step 5: Set Up Email Notifications (Resend)

### 5.1 Create Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up (free tier: 3,000 emails/month)
3. Verify your email address

### 5.2 Add Domain or Use Testing Domain

**Option A: Use Testing Domain** (for development):

- Resend provides `onboarding@resend.dev` for testing
- No configuration needed
- Emails only sent to your verified email

**Option B: Add Custom Domain** (for production):

1. API Keys → **Domains** → **Add Domain**
2. Enter your domain: `yourdomain.com`
3. Add DNS records (SPF, DKIM, DMARC) to your domain provider
4. Wait for verification (~5-10 minutes)

### 5.3 Get API Key

1. **API Keys** → **Create API Key**
2. Name: `ScriptHammer Payments`
3. Permission: **Full access** (or **Sending access** only)
4. Copy the API key (starts with `re_`)

Add to `.env`:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
```

---

## Step 6: Configure Cash App & Chime (Optional)

### 6.1 Cash App

1. Download Cash App mobile app
2. Create account if needed
3. Get your `$cashtag` (Settings → Cashtag)

Add to `.env`:

```bash
NEXT_PUBLIC_CASHAPP_CASHTAG=$yourcashtag
```

### 6.2 Chime

1. Download Chime mobile app
2. Create account
3. Get your `$ChimeSign` (Profile → ChimeSign)

Add to `.env`:

```bash
NEXT_PUBLIC_CHIME_SIGN=$yourchimesign
```

---

## Step 7: Deploy Edge Functions

### 7.1 Deploy Webhook Handlers

After Phase 3 implementation (not yet done), you'll deploy:

```bash
# Deploy all Edge Functions to Supabase
docker compose exec scripthammer supabase functions deploy stripe-webhook
docker compose exec scripthammer supabase functions deploy paypal-webhook
docker compose exec scripthammer supabase functions deploy send-payment-email
```

### 7.2 Get Edge Function URLs

```bash
docker compose exec scripthammer supabase functions list
```

Your webhook URLs will be:

- Stripe: `https://your-project.supabase.co/functions/v1/stripe-webhook`
- PayPal: `https://your-project.supabase.co/functions/v1/paypal-webhook`

### 7.3 Configure Stripe Webhook

1. Stripe Dashboard → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://your-project.supabase.co/functions/v1/stripe-webhook`
4. Events to send:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
5. Click **Add endpoint**
6. Copy **Signing secret** (starts with `whsec_`)

Add to `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### 7.4 Configure PayPal Webhook

1. PayPal Developer Dashboard → **Apps & Credentials**
2. Click your app → **Webhooks**
3. Click **Add Webhook**
4. Webhook URL: `https://your-project.supabase.co/functions/v1/paypal-webhook`
5. Event types:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `BILLING.SUBSCRIPTION.CREATED`
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.UPDATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `PAYMENT.SALE.COMPLETED`
6. Click **Save**
7. Copy **Webhook ID** (shown on webhook details page)

Add to `.env`:

```bash
PAYPAL_WEBHOOK_ID=your-webhook-id
```

---

## Step 8: Verify Configuration

### 8.1 Check All Environment Variables

Your `.env` should now have:

```bash
# Docker
UID=1000
GID=1000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
NEXT_PUBLIC_PAYPAL_CLIENT_ID=AXXXxxxxx
PAYPAL_CLIENT_SECRET=secret
PAYPAL_WEBHOOK_ID=webhook-id

# Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# Cash App / Chime
NEXT_PUBLIC_CASHAPP_CASHTAG=$yourcashtag
NEXT_PUBLIC_CHIME_SIGN=$yourchimesign
```

### 8.2 Test Configuration

```bash
# Restart dev server to load new env vars
docker compose restart scripthammer

# Verify Supabase connection
docker compose exec scripthammer pnpm run dev
# Visit http://localhost:3000
# Check browser console for errors
```

---

## Step 9: Seed Test Data (Optional)

### 9.1 Insert Payment Provider Config

In Supabase Dashboard → **SQL Editor**, run:

```sql
INSERT INTO payment_provider_config (provider, enabled, config_status, priority, features)
VALUES
  ('stripe', true, 'configured', 10, '{"one_time": true, "recurring": true, "requires_consent": true}'::jsonb),
  ('paypal', true, 'configured', 9, '{"one_time": true, "recurring": true, "requires_consent": true}'::jsonb),
  ('cashapp', true, 'configured', 5, '{"one_time": true, "recurring": false, "requires_consent": false}'::jsonb),
  ('chime', true, 'configured', 5, '{"one_time": true, "recurring": false, "requires_consent": false}'::jsonb);
```

---

## Troubleshooting

### Supabase Link Fails

**Error**: `failed to link project`

**Solution**: Verify project reference ID and database password are correct.

### Migrations Don't Apply

**Error**: `migration failed`

**Solution**:

```bash
# Reset local database
docker compose exec scripthammer supabase db reset

# Re-push migrations
docker compose exec scripthammer supabase db push
```

### Environment Variables Not Loading

**Solution**:

```bash
# Restart Docker container
docker compose restart scripthammer

# Verify .env file exists and has correct values
cat .env | grep SUPABASE
```

### Webhook Signature Verification Fails

**Error**: `Invalid signature` in webhook logs

**Solution**:

- Verify webhook secret in `.env` matches Stripe/PayPal dashboard
- Check Edge Function has access to `STRIPE_WEBHOOK_SECRET` env var
- Ensure webhook URL points to correct Edge Function

---

## Next Steps

✅ **Setup Complete!** You're ready to:

1. Continue with **Phase 3**: Implement Edge Functions (webhook handlers)
2. Continue with **Phase 4**: Build client library (offline queue, React hooks)
3. Continue with **Phase 5**: Create UI components (PaymentButton, ConsentModal, Dashboard)

See [tasks.md](./tasks.md) for full implementation plan.

---

## Security Checklist

- [ ] `.env` is in `.gitignore` (already done)
- [ ] Never commit API keys to git
- [ ] Use test keys for development
- [ ] Enable Supabase RLS policies (already done in migrations)
- [ ] Verify webhook signatures in Edge Functions
- [ ] Use HTTPS for all webhook endpoints
- [ ] Rotate API keys if compromised

---

**Need Help?** Check [quickstart.md](./quickstart.md) for integration test scenarios.
