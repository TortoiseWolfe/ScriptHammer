# Payment E2E `test.skip` Index (#53)

**Generated 2026-06-05.** Indexes every skipped test in `tests/e2e/payment/` by its
**blocker**, so it's clear what must ship before each can be un-skipped — and that
none are skipped without a tracked reason.

## Summary

`tests/e2e/payment/` contains **34 skipped tests** (via `test.skip(true, '<reason>')`),
across 7 spec files. They fall into these blocker buckets:

| Blocker                        | Count | Unblocked by                                          |
| ------------------------------ | ----- | ----------------------------------------------------- |
| Other missing UI feature       | 10    | various small UI surfaces                             |
| Route `/payment/subscriptions` | 5     | SUBSCRIPTION-MGMT (#5)                                |
| Offline-queue UI               | 5     | PAYMENT-OFFLINE-UI (#4)                               |
| Live provider keys / webhooks  | 4     | PayPal/Stripe **sandbox credentials** (deploy-time)   |
| Route `/payment/dashboard`     | 2     | PAYMENT-DASHBOARD (#3)                                |
| Route `/payment/history`       | 2     | PAYMENT-DASHBOARD (#3)                                |
| Realtime dashboard UI          | 2     | PAYMENT-DASHBOARD (#3 / #6)                           |
| Grace-period wiring            | 1     | SUBSCRIPTION-MGMT (#5)                                |
| Duplicate-prevention           | 1     | dup-prevention feature                                |
| Test-env limitation            | 2     | won't-fix in E2E (FPS / bundling — covered elsewhere) |

**Key takeaways for un-skipping:**

- The biggest unlocks are the **payment UI routes** (#3 PAYMENT-DASHBOARD, #4
  PAYMENT-OFFLINE-UI, #5 SUBSCRIPTION-MGMT) — shipping those routes un-blocks ~17 tests.
- **4 tests need live sandbox credentials** (full Stripe/PayPal redirect + webhook
  flows) — these stay skipped in CI by design; run them locally with sandbox keys.
- The 2 test-env-limitation skips (FPS measurement, script bundling) are not real
  product gaps; leave skipped.

> Note: the Edge Functions those flows call (PayPal order/capture/subscription,
> cancel/resume) shipped in #130 — so the remaining payment blockers are the
> **front-end routes** + **sandbox creds**, not the backend.

## Full index by blocker

### Route /payment/subscriptions — SUBSCRIPTION-MGMT (#5) — 5 skipped

- `02-paypal-subscription.spec.ts:85` — Subscription management page not yet implemented
- `02-paypal-subscription.spec.ts:90` — Subscription management page not yet implemented
- `02-paypal-subscription.spec.ts:95` — Subscription management page not yet implemented
- `03-failed-payment-retry.spec.ts:136` — Subscription management page not yet implemented
- `06-realtime-dashboard.spec.ts:99` — Subscription management page not yet implemented

### Route /payment/dashboard — PAYMENT-DASHBOARD (#3) — 2 skipped

- `07-performance.spec.ts:26` — Payment dashboard page not yet implemented
- `07-performance.spec.ts:33` — Payment dashboard page not yet implemented

### Route /payment/history — PAYMENT-DASHBOARD (#3) — 2 skipped

- `05-offline-queue.spec.ts:115` — Payment history page not yet implemented
- `07-performance.spec.ts:40` — Payment history page not yet implemented

### Offline-queue UI — PAYMENT-OFFLINE-UI (#4) — 5 skipped

- `01-stripe-onetime.spec.ts:149` — Offline queue feature not yet implemented
- `05-offline-queue.spec.ts:67` — Offline queue status UI not yet implemented
- `05-offline-queue.spec.ts:75` — Queue sync status UI not yet implemented
- `05-offline-queue.spec.ts:91` — Queue persistence UI not yet implemented
- `07-performance.spec.ts:48` — Offline queue sync UI not yet implemented

### Realtime dashboard UI — PAYMENT-DASHBOARD (#3/#6) — 2 skipped

- `06-realtime-dashboard.spec.ts:104` — Transaction counter not yet implemented
- `06-realtime-dashboard.spec.ts:130` — Real-time error notifications not yet implemented

### Live provider keys / webhooks (sandbox creds) — 4 skipped

- `02-paypal-subscription.spec.ts:49` — PayPal API keys not configured - skipping flow test
- `06-realtime-dashboard.spec.ts:85` — Payment list updates require actual Stripe integration
- `06-realtime-dashboard.spec.ts:92` — Webhook verification requires actual Stripe webhooks
- `07-performance.spec.ts:19` — Stripe API keys not configured - use k6 for load testing

### Grace-period wiring (#5) — 1 skipped

- `02-paypal-subscription.spec.ts:100` — Grace period feature not yet implemented

### Duplicate-prevention feature — 1 skipped

- `02-paypal-subscription.spec.ts:105` — Duplicate subscription prevention not yet implemented

### Other missing UI feature — 10 skipped

- `04-gdpr-consent.spec.ts:232` — Consent reset feature not yet implemented
- `05-offline-queue.spec.ts:83` — Queue count display not yet implemented
- `05-offline-queue.spec.ts:99` — Retry status UI not yet implemented
- `05-offline-queue.spec.ts:107` — Max retry UI not yet implemented
- `05-offline-queue.spec.ts:123` — Queue overflow handling not yet implemented
- `05-offline-queue.spec.ts:128` — Clear queue button not yet implemented
- `06-realtime-dashboard.spec.ts:112` — Offline status indicator not yet implemented
- `06-realtime-dashboard.spec.ts:120` — Reconnection UI not yet implemented
- `06-realtime-dashboard.spec.ts:125` — Batch update UI not yet implemented
- `06-realtime-dashboard.spec.ts:135` — Payment chart not yet implemented

### Uncategorized (test-env limitations) — 2 skipped

- `07-performance.spec.ts:111` — FPS testing is not reliable in E2E tests
- `07-performance.spec.ts:116` — Script bundling test requires Stripe integration
