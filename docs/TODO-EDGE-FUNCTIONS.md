# TODO: Missing Edge Functions Implementation

## Issue #5C - Future Implementation

The blog post "Offline Payment System: Stripe, PayPal & GDPR" (Oct 9) documents two Edge Functions that don't currently exist in the codebase:

### 1. `stripe-create-payment`

**Location**: `/supabase/functions/stripe-create-payment/index.ts`

**Purpose**: Create Stripe Checkout sessions for payment intents

**Current Status**: ❌ Not implemented (example in blog post only)

**Why needed**:

- Blog shows complete implementation (90+ lines)
- Payment flow depends on this function
- Currently relies on webhook-only approach

**Implementation priority**: High (needed for full payment flow)

**Reference**: `/public/blog/offline-payment-system-stripe-paypal.md` lines 466-532

---

### 2. `paypal-create-subscription`

**Location**: `/supabase/functions/paypal-create-subscription/index.ts`

**Purpose**: Create PayPal subscription plans for recurring payments

**Current Status**: ❌ Not implemented (implied in blog post)

**Why needed**:

- Completes PayPal integration for subscriptions
- Parallel to Stripe subscription flow
- Blog references this in payment button logic

**Implementation priority**: High (needed for PayPal subscriptions)

---

## Currently Implemented Edge Functions

✅ **stripe-webhook** - Webhook handler for Stripe events
✅ **paypal-webhook** - Webhook handler for PayPal events
✅ **send-payment-email** - Email notifications for payments
✅ **\_shared** - Shared utilities

---

## Action Items

- [ ] Review blog post implementation details
- [ ] Create `stripe-create-payment` Edge Function
- [ ] Create `paypal-create-subscription` Edge Function
- [ ] Test integration with payment flow
- [ ] Update payment service to use new Edge Functions
- [ ] Add tests for Edge Functions
- [ ] Document deployment process

---

**Created**: 2025-10-08
**Priority**: High
**Estimated effort**: 4-6 hours
**Dependencies**: Stripe API key, PayPal credentials, Supabase project setup
