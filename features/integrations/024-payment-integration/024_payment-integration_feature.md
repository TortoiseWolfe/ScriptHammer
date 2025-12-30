# Feature: Payment Integration System

**Feature ID**: 024
**Category**: integrations
**Source**: ScriptHammer_v_001/docs/specs/015-payment-integration
**Status**: Ready for SpecKit

## Description

Payment integration system with Supabase backend for GitHub Pages static sites. Supports Stripe and PayPal payments with Edge Functions for webhook handling and PostgreSQL for payment tracking. Includes GDPR-compliant consent flow and offline-first queuing.

## User Scenarios

### US-1: One-Time Payment (P1)

A customer makes a one-time payment through Stripe or PayPal for a donation or product purchase.

**Acceptance Criteria**:
1. Given payment button clicked, when consent granted, then redirected to payment page
2. Given payment completed, when webhook received, then payment marked as verified
3. Given payment failed, when error returned, then user sees clear error with retry option

### US-2: Subscription Payment (P1)

A customer subscribes to a recurring monthly or yearly plan.

**Acceptance Criteria**:
1. Given subscription selected, when payment authorized, then recurring billing is set up
2. Given subscription active, when billing date arrives, then payment is automatically charged
3. Given payment fails, when retry schedule triggers, then retries on days 1, 3, 7

### US-3: Consent Flow (P1)

Users must consent before any payment provider scripts are loaded (GDPR compliance).

**Acceptance Criteria**:
1. Given first visit, when payment page loads, then consent modal appears
2. Given consent granted, when modal closed, then payment scripts load
3. Given consent declined, when viewing options, then Cash App/Chime links shown as fallback

### US-4: Webhook Verification (P2)

Payment confirmations are verified through secure webhook signatures.

**Acceptance Criteria**:
1. Given webhook received, when signature validated, then payment is processed
2. Given invalid signature, when webhook received, then it is rejected
3. Given duplicate webhook, when processing, then it is handled idempotently

### US-5: Offline Queuing (P3)

Payment operations are queued when Supabase is temporarily unavailable.

**Acceptance Criteria**:
1. Given Supabase unavailable, when payment initiated, then operation is queued client-side
2. Given connectivity restored, when queue syncs, then operations are processed
3. Given offline mode, when viewing UI, then offline indicator is shown

## Requirements

### Functional

**Payment Processing**
- FR-001: Accept one-time payments through Stripe (credit card)
- FR-002: Accept one-time payments through PayPal
- FR-003: Support recurring subscription payments (monthly and yearly)
- FR-004: Validate payment amounts (min $1.00, max $999.99)
- FR-005: Support multiple currencies (USD, EUR, GBP, CAD, AUD)
- FR-006: Provide direct payment links for Cash App and Chime

**Payment Verification**
- FR-007: Verify payments through webhook notifications
- FR-008: Check webhook signatures to prevent fraud
- FR-009: Store payment records with status (pending, succeeded, failed)
- FR-010: Mark payments "verified" only after webhook confirmation
- FR-011: Prevent duplicate webhook processing (idempotency)

**Subscription Management**
- FR-012: Track active subscriptions with next billing date
- FR-013: Handle failed subscription payments with automatic retry
- FR-014: Implement configurable retry schedule (default: days 1, 3, 7)
- FR-015: Enter grace period after exhausting retries (default: 7 days)
- FR-016: Auto-cancel subscriptions after grace period expires

**Privacy & Consent**
- FR-017: Request consent before loading payment provider scripts
- FR-018: Show Cash App/Chime links if consent declined
- FR-019: Retry consent modal on next visit if declined

**Notifications**
- FR-020: Send email notifications for payment events
- FR-021: Provide in-app dashboard for payment activity

### Non-Functional
- NFR-001: Support up to 10,000 payments per month
- NFR-002: Handle up to 500 concurrent customers
- NFR-003: Continue accepting payments during Supabase outages (client-side queue)
- NFR-004: Persist queued operations across browser sessions

### Key Entities
- **Payment Intent**: Amount, currency, type (one-time/recurring), customer email
- **Payment Result**: Transaction ID, status, webhook verification status
- **Webhook Event**: Provider, event type, signature, processing status
- **Subscription**: Plan, interval, status, next billing date, retry policy
- **Provider Configuration**: Enabled providers, failover priority

### Out of Scope
- Inventory management
- Shipping integration
- Tax calculation
- Invoice generation
- Refund automation

## Success Criteria

- SC-001: One-time payments complete successfully via Stripe and PayPal
- SC-002: Subscription billing works with automatic retry on failure
- SC-003: Consent flow prevents script loading without permission
- SC-004: Webhooks are verified and processed idempotently
- SC-005: Offline queuing preserves operations during outages
- SC-006: Template users receive notifications for all payment events
