# Quickstart: Payment Integration Testing

**Feature**: Payment Integration System
**Date**: 2025-10-03
**Purpose**: Integration test scenarios derived from user stories

## Overview

This quickstart guide provides step-by-step integration test scenarios for validating the payment integration system. Each scenario maps directly to user stories from the specification.

**Prerequisites**:

- Supabase project configured
- Stripe test account with webhook endpoint
- PayPal sandbox account with webhook endpoint
- Environment variables configured
- Docker development environment running

## Test Scenario 1: One-Time Payment Flow (Stripe)

**User Story**: Template user accepts a $10 donation via Stripe

**Steps**:

1. **Setup**:

   ```bash
   # Start development environment
   docker compose up

   # Seed test data
   docker compose exec scripthammer pnpm run db:seed
   ```

2. **Customer initiates payment**:
   - Navigate to `/donate`
   - Click "Donate $10" button
   - **Expected**: Consent modal appears

3. **Customer grants consent**:
   - Read consent modal content
   - Click "Accept" button
   - **Expected**: Stripe SDK loads, checkout button appears

4. **Customer completes payment**:
   - Click "Pay with Stripe" button
   - **Expected**: Redirect to `checkout.stripe.com`
   - Enter test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - Click "Pay"
   - **Expected**: Redirect back to success page

5. **Webhook confirms payment**:
   - Stripe sends `payment_intent.succeeded` webhook
   - **Expected**: Edge Function receives webhook
   - **Expected**: Signature verified
   - **Expected**: `payment_results` row created with `webhook_verified = true`

6. **Notifications sent**:
   - **Expected**: Email sent to template user (via Resend)
   - **Expected**: Dashboard shows new payment in real-time

**Validation**:

```sql
-- Check payment intent created
SELECT * FROM payment_intents WHERE customer_email = 'test@example.com';

-- Check payment result verified
SELECT * FROM payment_results
WHERE intent_id = '<intent_id>'
AND status = 'succeeded'
AND webhook_verified = true;

-- Check webhook event recorded
SELECT * FROM webhook_events
WHERE event_type = 'payment_intent.succeeded'
AND processed = true;
```

**Expected Outcome**: Payment completed, verified, and notifications sent

---

## Test Scenario 2: Subscription Creation Flow (PayPal)

**User Story**: Customer subscribes to $5/month plan via PayPal

**Steps**:

1. **Customer initiates subscription**:
   - Navigate to `/subscribe`
   - Select "$5/month" plan
   - Click "Subscribe with PayPal"
   - **Expected**: Consent modal appears

2. **Customer grants consent**:
   - Click "Accept" in consent modal
   - **Expected**: PayPal SDK loads, subscription button appears

3. **Customer completes subscription**:
   - Click "Subscribe" button
   - **Expected**: PayPal popup opens
   - Log in to PayPal sandbox account
   - Approve subscription
   - **Expected**: Popup closes, success message shown

4. **Webhooks confirm subscription**:
   - PayPal sends `BILLING.SUBSCRIPTION.CREATED` webhook
   - **Expected**: Edge Function receives webhook
   - **Expected**: Signature verified
   - **Expected**: `subscriptions` row created with `status = 'active'`

5. **First payment processed**:
   - PayPal sends `PAYMENT.SALE.COMPLETED` webhook
   - **Expected**: `payment_results` row created
   - **Expected**: `subscription.next_billing_date` updated

6. **Notifications sent**:
   - **Expected**: Email sent: "Subscription Created"
   - **Expected**: Dashboard shows active subscription

**Validation**:

```sql
-- Check subscription created
SELECT * FROM subscriptions
WHERE customer_email = 'test@example.com'
AND status = 'active';

-- Check first payment recorded
SELECT * FROM payment_results
WHERE transaction_id = '<paypal_sale_id>'
AND webhook_verified = true;

-- Check webhook events
SELECT * FROM webhook_events
WHERE event_type IN ('BILLING.SUBSCRIPTION.CREATED', 'PAYMENT.SALE.COMPLETED');
```

**Expected Outcome**: Subscription active, first payment verified, notifications sent

---

## Test Scenario 3: Failed Subscription Retry Flow

**User Story**: System retries failed subscription payment on days 1, 3, 7, then enters grace period

**Steps**:

1. **Setup failed payment**:
   - Use Stripe test card that triggers payment failure: `4000 0000 0000 0341`
   - Create subscription with this card

2. **First charge fails**:
   - Stripe sends `invoice.payment_failed` webhook
   - **Expected**: `subscription.status = 'past_due'`
   - **Expected**: `subscription.failed_payment_count = 1`
   - **Expected**: Email notification: "Payment Failed - Will Retry"

3. **Day 1 retry fails**:
   - Stripe automatically retries after 1 day
   - Sends `invoice.payment_failed` webhook again
   - **Expected**: `subscription.retry_schedule.day_1 = true`
   - **Expected**: `subscription.failed_payment_count = 2`

4. **Day 3 retry fails**:
   - Stripe retries after 3 days
   - **Expected**: `subscription.retry_schedule.day_3 = true`
   - **Expected**: `subscription.failed_payment_count = 3`

5. **Day 7 retry fails**:
   - Stripe retries after 7 days (final retry)
   - **Expected**: `subscription.retry_schedule.day_7 = true`
   - **Expected**: `subscription.status = 'grace_period'`
   - **Expected**: `subscription.grace_period_expires` set to 7 days from now
   - **Expected**: Email: "Subscription in Grace Period"

6. **Grace period expires**:
   - Wait for `grace_period_expires` date
   - Cron job (or manual trigger) checks expired subscriptions
   - **Expected**: `subscription.status = 'canceled'`
   - **Expected**: `subscription.canceled_at` set
   - **Expected**: Email: "Subscription Canceled Due to Failed Payments"

**Validation**:

```sql
-- Check retry schedule tracked
SELECT retry_schedule, failed_payment_count, status
FROM subscriptions
WHERE provider_subscription_id = '<stripe_sub_id>';

-- Check all failed attempts recorded
SELECT COUNT(*) FROM webhook_events
WHERE event_type = 'invoice.payment_failed'
AND related_subscription_id = '<subscription_id>';
```

**Expected Outcome**: Retry logic executed, grace period enforced, subscription canceled, notifications sent at each stage

---

## Test Scenario 4: GDPR Consent Decline Flow

**User Story**: Customer declines consent, sees Cash App/Chime links, retry modal next visit

**Steps**:

1. **Customer visits payment page**:
   - Navigate to `/donate`
   - **Expected**: Consent modal appears (no Stripe/PayPal buttons visible yet)

2. **Customer declines consent**:
   - Read consent modal
   - Click "Decline" button
   - **Expected**: Modal closes
   - **Expected**: Only Cash App and Chime payment links visible
   - **Expected**: localStorage item `payment_consent = 'declined'`

3. **Customer clicks Cash App link**:
   - Click "Pay with Cash App" link
   - **Expected**: Opens `https://cash.app/$yourtag` in new tab
   - **Expected**: No scripts loaded, no tracking

4. **Customer returns next day**:
   - Navigate to `/donate` again
   - **Expected**: Consent modal appears again (retry per clarification Q3)
   - **Expected**: localStorage `payment_consent` still shows 'declined' from yesterday

5. **Customer accepts consent on second visit**:
   - Click "Accept" in consent modal
   - **Expected**: localStorage updated to `payment_consent = 'granted'`
   - **Expected**: Stripe and PayPal SDKs load
   - **Expected**: All payment buttons now visible

**Validation**:

```javascript
// Check localStorage after decline
localStorage.getItem('payment_consent'); // 'declined'

// Check no external scripts loaded
document.querySelectorAll('script[src*="stripe.com"]').length; // 0
document.querySelectorAll('script[src*="paypal.com"]').length; // 0

// Check after acceptance
localStorage.getItem('payment_consent'); // 'granted'
document.querySelectorAll('script[src*="stripe.com"]').length; // > 0
```

**Expected Outcome**: Consent modal behavior matches GDPR requirements, fallback options available, retry logic works

---

## Test Scenario 5: Offline Queue Flow

**User Story**: System queues operations when Supabase unavailable, syncs when reconnected

**Steps**:

1. **Setup offline simulation**:

   ```javascript
   // In browser DevTools console
   // Block Supabase requests
   const supabaseUrl = 'https://your-project.supabase.co';
   // Use DevTools Network tab → Block request pattern
   ```

2. **Customer initiates payment while offline**:
   - Navigate to `/donate`
   - Accept consent (if needed)
   - Click "Donate $10"
   - **Expected**: Error from Supabase (connection failed)

3. **Operation queued**:
   - **Expected**: UI shows "Offline Mode - Payment will sync when online"
   - **Expected**: IndexedDB entry created in `queuedOperations` table
   - **Expected**: Button changes to "Queued"

4. **Check queue**:

   ```javascript
   // In DevTools console
   const db = new Dexie('PaymentQueue');
   db.version(1).stores({ queuedOperations: '++id, type, createdAt' });
   const queued = await db.queuedOperations.toArray();
   console.log(queued); // Should show 1 queued payment
   ```

5. **Restore connection**:
   - Remove network block in DevTools
   - **Expected**: Auto-sync triggered (listens to Supabase connection events)
   - **Expected**: Queued operation sent to Supabase
   - **Expected**: IndexedDB queue cleared

6. **Verify sync**:
   ```sql
   -- Check payment intent created (after sync)
   SELECT * FROM payment_intents
   WHERE customer_email = 'test@example.com'
   ORDER BY created_at DESC LIMIT 1;
   ```

**Validation**:

- IndexedDB queue grows when offline
- Queue syncs automatically when online
- No data loss during outage

**Expected Outcome**: Offline operations queued, auto-sync on reconnection, user notified of queue status

---

## Test Scenario 6: Payment History Dashboard

**User Story**: Template user views all payment activity in real-time dashboard

**Steps**:

1. **Login as template user**:
   - Navigate to `/dashboard/payments`
   - **Expected**: Dashboard loads, shows "No payments yet" if empty

2. **Create test payments**:

   ```bash
   # Generate 10 test payments
   docker compose exec scripthammer pnpm run db:seed:payments --count=10
   ```

3. **View payment list**:
   - Dashboard auto-refreshes (Supabase real-time subscription)
   - **Expected**: 10 payments listed
   - **Expected**: Each row shows: date, amount, status, provider, transaction ID

4. **Filter by status**:
   - Select "Succeeded" filter
   - **Expected**: Only succeeded payments shown
   - Select "Failed" filter
   - **Expected**: Only failed payments shown

5. **Filter by provider**:
   - Select "Stripe" filter
   - **Expected**: Only Stripe payments shown
   - Select "PayPal" filter
   - **Expected**: Only PayPal payments shown

6. **Search by transaction ID**:
   - Enter transaction ID in search box: `pi_1234567890`
   - **Expected**: Single matching payment shown
   - **Expected**: Result appears instantly (<100ms per NFR)

7. **Real-time update test**:
   - Keep dashboard open
   - In another tab, complete a new payment
   - **Expected**: Dashboard updates automatically (no refresh needed)
   - **Expected**: New payment appears at top of list

8. **Email notification received**:
   - Check email inbox (template user email)
   - **Expected**: Email received: "Payment Received: $X.XX"
   - **Expected**: Email contains transaction ID, amount, date

**Validation**:

```sql
-- Verify dashboard queries are fast
EXPLAIN ANALYZE
SELECT * FROM payment_results
WHERE template_user_id = '<user_id>'
ORDER BY created_at DESC
LIMIT 50;
-- Should use index, execution time <200ms
```

**Expected Outcome**: Dashboard shows real-time payments, filters work, search is fast, dual notifications (email + dashboard) functional

---

## Performance Validation

**Requirements from NFR**:

- Support 10,000 payments/month
- Handle 500 concurrent customers
- Dashboard load <500ms
- Transaction lookup <100ms

**Load Test**:

```bash
# Simulate 500 concurrent checkout requests
docker compose exec scripthammer pnpm run test:load -- \
  --scenario=checkout \
  --users=500 \
  --duration=60s

# Expected results:
# - 95th percentile response time <2s
# - 0% error rate
# - No database connection exhaustion
```

**Stress Test**:

```bash
# Simulate 1000 payments in 1 hour (above target of 10k/month = ~333/day)
docker compose exec scripthammer pnpm run test:stress -- \
  --scenario=payment_flow \
  --rate=1000/hour

# Expected results:
# - All webhooks processed
# - No queue backlog
# - Email delivery <5min
```

---

## Security Validation

**Webhook Signature Verification**:

```bash
# Test invalid signature
curl -X POST https://your-project.supabase.co/functions/v1/stripe-webhook \
  -H "stripe-signature: invalid_signature" \
  -d '{"id": "evt_test", "type": "payment_intent.succeeded"}'

# Expected: 400 Bad Request - Invalid signature
```

**Idempotency Test**:

```bash
# Send same webhook twice
EVENT_ID="evt_$(uuidgen)"
curl -X POST ... -d "{\"id\": \"$EVENT_ID\", ...}"
curl -X POST ... -d "{\"id\": \"$EVENT_ID\", ...}"

# Expected: First returns 200, second returns 409 Conflict
```

**RLS Policy Test**:

```javascript
// Attempt to access another user's payments
const { data, error } = await supabase
  .from('payment_results')
  .select('*')
  .eq('template_user_id', 'other-user-id');

// Expected: error or empty array (RLS blocks access)
```

---

## Cleanup

```bash
# Reset test database
docker compose exec scripthammer pnpm run db:reset

# Clear IndexedDB
# In browser DevTools: Application → IndexedDB → PaymentQueue → Delete

# Clear localStorage
localStorage.removeItem('payment_consent');
localStorage.removeItem('payment_consent_date');
```

---

## Test Checklist

**Functional Tests**:

- [ ] One-time payment (Stripe) - Scenario 1
- [ ] One-time payment (PayPal) - Scenario 2 variation
- [ ] Subscription creation (Stripe) - Scenario 2 variation
- [ ] Subscription creation (PayPal) - Scenario 2
- [ ] Failed payment retry - Scenario 3
- [ ] Grace period enforcement - Scenario 3
- [ ] Subscription cancellation - Scenario 3
- [ ] Consent grant flow - Scenario 1/2
- [ ] Consent decline flow - Scenario 4
- [ ] Consent retry next visit - Scenario 4
- [ ] Offline queue creation - Scenario 5
- [ ] Offline queue sync - Scenario 5
- [ ] Dashboard display - Scenario 6
- [ ] Real-time updates - Scenario 6
- [ ] Email notifications - All scenarios
- [ ] Cash App link (no consent) - Scenario 4
- [ ] Chime link (no consent) - Scenario 4

**Non-Functional Tests**:

- [ ] Performance: 500 concurrent users
- [ ] Load: 1000 payments/hour
- [ ] Security: Webhook signature verification
- [ ] Security: Idempotency enforcement
- [ ] Security: RLS policy enforcement
- [ ] Accessibility: Pa11y tests on all payment UI
- [ ] Mobile: Touch targets 44×44px
- [ ] Bundle size: <150KB first load

---

**Quickstart Status**: Ready for integration testing
**Test Coverage**: 6 primary scenarios + performance + security validation
**Estimated Test Duration**: 2-3 hours for full suite
