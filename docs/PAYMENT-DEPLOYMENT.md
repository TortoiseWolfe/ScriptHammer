# Payment Integration Deployment Guide

This guide helps template users deploy the payment integration system to their own Supabase project.

## Prerequisites

- Supabase account and project
- Stripe account (for Stripe payments)
- PayPal Business account (for PayPal payments)
- Node.js 18+ and pnpm installed locally
- Supabase CLI installed: `npm install -g supabase`

## Step 1: Supabase Project Setup

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings → API
3. Generate a service role key (keep this secret!)

### 1.2 Link Local Project

```bash
# Login to Supabase CLI
supabase login

# Link your project (replace with your project ref)
supabase link --project-ref your-project-ref
```

## Step 2: Database Setup

### 2.1 Run Migrations

Apply all payment-related database migrations:

```bash
# From project root
supabase db push
```

This creates:

- `payment_intents` table
- `payment_results` table
- `webhook_events` table
- `subscriptions` table
- Row Level Security (RLS) policies
- Database indexes for performance

### 2.2 Verify Tables

Check that tables exist in Supabase Dashboard → Table Editor:

- ✅ payment_intents
- ✅ payment_results
- ✅ webhook_events
- ✅ subscriptions

## Step 3: Environment Variables

### 3.1 Create `.env.local`

Copy from `.env.example` and fill in your values:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-secret

# Email (EmailJS)
NEXT_PUBLIC_EMAILJS_SERVICE_ID=your-service-id
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your-template-id
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your-public-key
```

### 3.2 Add to Supabase Edge Functions

```bash
# Set secrets for Edge Functions
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set PAYPAL_CLIENT_ID=your-client-id
supabase secrets set PAYPAL_CLIENT_SECRET=your-secret
supabase secrets set EMAILJS_SERVICE_ID=your-service-id
supabase secrets set EMAILJS_TEMPLATE_ID=your-template-id
supabase secrets set EMAILJS_PUBLIC_KEY=your-public-key
```

## Step 4: Deploy Edge Functions

### 4.1 Deploy All Functions

```bash
# From project root
supabase functions deploy stripe-create-payment
supabase functions deploy stripe-webhook
supabase functions deploy paypal-create-subscription
supabase functions deploy paypal-webhook
supabase functions deploy send-receipt-email
```

### 4.2 Verify Deployment

Check Supabase Dashboard → Edge Functions:

- ✅ All 5 functions should be listed
- ✅ Status: Active
- ✅ Last deployed: Today

## Step 5: Webhook Configuration

### 5.1 Stripe Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://your-project.supabase.co/functions/v1/stripe-webhook`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy webhook signing secret to `.env.local` as `STRIPE_WEBHOOK_SECRET`

### 5.2 PayPal Webhooks

1. Go to PayPal Developer Dashboard → Apps & Credentials
2. Select your app
3. Scroll to "Webhooks"
4. Add webhook URL: `https://your-project.supabase.co/functions/v1/paypal-webhook`
5. Subscribe to events:
   - `BILLING.SUBSCRIPTION.CREATED`
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `PAYMENT.SALE.COMPLETED`
   - `PAYMENT.SALE.REFUNDED`

## Step 6: Test in Development

### 6.1 Start Dev Server

```bash
docker compose up
docker compose exec scripthammer pnpm run dev
```

### 6.2 Test Payment Flow

1. Navigate to `/payment-demo`
2. Grant payment consent
3. Click "Pay $20.00"
4. Use Stripe test card: `4242 4242 4242 4242`
5. Verify payment succeeds
6. Check Supabase → payment_results table

### 6.3 Test Webhooks Locally

Use Stripe CLI to forward webhooks:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward events to local Edge Function
stripe listen --forward-to https://your-project.supabase.co/functions/v1/stripe-webhook
```

## Step 7: Production Deployment

### 7.1 Update Environment

Switch to production keys in `.env.production`:

```bash
# Use live Stripe keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...

# Use live PayPal keys
NEXT_PUBLIC_PAYPAL_CLIENT_ID=live-client-id
PAYPAL_CLIENT_SECRET=live-secret
```

### 7.2 Update Webhook URLs

1. Stripe: Update webhook URL to production domain
2. PayPal: Update webhook URL to production domain

### 7.3 Deploy to Vercel/Netlify

```bash
# Build and export
pnpm run build

# Deploy to your platform
# Vercel: vercel deploy
# Netlify: netlify deploy
```

## Step 8: Monitoring

### 8.1 Check Payment Status

Monitor via Supabase Dashboard:

- Table Editor → payment_results (recent payments)
- Table Editor → webhook_events (webhook delivery)
- Logs → Edge Functions (function execution logs)

### 8.2 Error Handling

Common issues:

- **Webhook signature failed**: Check `STRIPE_WEBHOOK_SECRET` matches
- **RLS policy denied**: Ensure service role key is set
- **Payment not appearing**: Check Supabase realtime subscriptions enabled

## Security Checklist

✅ Service role key is secret (never in frontend code)
✅ Webhook secrets are configured correctly
✅ RLS policies are enabled on all tables
✅ HTTPS enforced for all webhook endpoints
✅ Test mode keys used in development
✅ Production keys used only in production

## Support

For issues:

1. Check Supabase Edge Function logs
2. Check Stripe Dashboard → Events for webhook delivery
3. Review `/docs/prp-docs/payment-integration-prp.md` for architecture details
4. Check `/e2e/payment/*.spec.ts` for expected behavior

## Testing

Run integration tests:

```bash
docker compose exec scripthammer pnpm exec playwright test e2e/payment
```

**Note**: Some tests require `SUPABASE_SERVICE_ROLE_KEY` environment variable.
