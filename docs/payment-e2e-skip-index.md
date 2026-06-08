# Payment E2E `test.skip` Index (#53)

**Regenerated 2026-06-08 (payment-hub refactor).** Indexes every skipped test in
`tests/e2e/payment/` by its **blocker**, so it's clear what must ship before each
can be un-skipped — and that none are skipped without a tracked reason. Line
numbers + reasons are the ground truth in the specs (verified by grepping
`test.skip(true, ...)`), not hand-maintained guesses.

## Summary

`tests/e2e/payment/` contains **23 skipped tests** across 7 spec files. They fall
into these blocker buckets:

| Blocker                             | Count | Unblocked by                                                        |
| ----------------------------------- | ----- | ------------------------------------------------------------------- |
| Live provider keys / webhooks       | 5     | Stripe/PayPal **sandbox credentials** set on the deployed functions |
| Unimplemented route/page (perf)     | 4     | seeded-volume perf testing on `/payment` (history/dashboard perf)   |
| Offline-queue seed fixture          | 4     | an in-page Dexie queue-seed fixture (autonomous; see note)          |
| Unimplemented dashboard/realtime UI | 4     | reconnection UI, batch-update UI, error toast, payment chart        |
| Won't-fix in E2E                    | 2     | FPS measurement + script-bundling (unreliable / covered elsewhere)  |
| Edge-function flow                  | 1     | exercising the `cancel-subscription` Edge Function end-to-end       |
| Feature not built                   | 2     | offline-queue feature (#1 result), consent-reset feature            |
| Subscription-mgmt page (legacy ref) | 1     | retarget to the `/payment?tab=subscriptions` hub (legacy comment)   |

**Just un-skipped (2026-06-08, payment-hub refactor, no creds):**

- `02` **grace-period countdown** + **duplicate-prevention (23505)** — via the
  `seedIsolatedSubscription` fixture (prior session), now on the hub.
- `06` **live transaction counter**, **payment-list live update**, **subscription
  status change in real-time**, and a **realtime connection-status indicator** —
  enabled by the new `/payment` hub + the `usePaymentResultsRealtime` /
  `useSubscriptionsRealtime` hooks. They seed a throwaway user + payment/sub row
  via `seedIsolatedPayment` / `seedIsolatedSubscription`, assert the live update,
  and tear down. Guarded with `test.skip(!getAdminClient())`.

**Key takeaways for un-skipping the remaining 23:**

- **5 need live sandbox credentials.** The Edge Functions are deployed; the only
  gate is setting provider secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`) via the Management API `/secrets`.
- **4 offline-queue tests need a Dexie seed fixture** (client-side
  `PaymentQueueV2`/`queuedOperations` store; must seed IndexedDB in-page via the
  app's `paymentQueue` API). Autonomous but non-trivial — deferred.
- **4 dashboard/realtime UI tests** are genuinely unbuilt widgets (reconnection
  button, batch-update grouping, error toast, payment chart) — deliberately out
  of scope for the template (no clear user need; a chart adds a dependency).
- **4 perf tests** assert load behaviour with large seeded volumes on the
  (now-existing) `/payment` surfaces — separate perf concern, not creds.
- **2 won't-fix** (FPS unreliable in E2E, bundling needs Stripe).

> Note: the payment Edge Functions are all DEPLOYED to prod (Supabase Management
> API). Remaining payment blockers are **sandbox creds** + a few **unbuilt
> widgets**, not backend code.

## Full index by blocker

### Live provider keys / webhooks (sandbox creds) — 5 skipped

- `02-paypal-subscription.spec.ts:56` — PayPal API keys not configured - skipping flow test
- `02-paypal-subscription.spec.ts:127` — Needs a seeded past_due/grace row + PayPal sandbox keys
- `06-realtime-dashboard.spec.ts:121` — Webhook verification requires actual Stripe webhooks
- `07-performance.spec.ts:19` — Stripe API keys not configured - use k6 for load testing
- `07-performance.spec.ts:116` — Script bundling test requires Stripe integration

### Offline-queue seed fixture (autonomous — Dexie) — 4 skipped

- `05-offline-queue.spec.ts:102` — Needs a queue-seed fixture or provider creds to enqueue
- `05-offline-queue.spec.ts:110` — Needs a queue-seed fixture or provider creds to enqueue
- `05-offline-queue.spec.ts:118` — Needs a queue-seed fixture to enqueue multiple items
- `05-offline-queue.spec.ts:137` — Needs a seeded failed item to exercise backoff/retry UI

### Unimplemented dashboard / realtime widgets (out of scope) — 4 skipped

- `06-realtime-dashboard.spec.ts:215` — Reconnection UI not yet implemented
- `06-realtime-dashboard.spec.ts:220` — Batch update UI not yet implemented
- `06-realtime-dashboard.spec.ts:225` — Real-time error notifications not yet implemented
- `06-realtime-dashboard.spec.ts:230` — Payment chart not yet implemented

### Perf with seeded volume (separate concern) — 4 skipped

- `07-performance.spec.ts:26` — Payment dashboard page perf (now /payment Overview)
- `07-performance.spec.ts:33` — Payment dashboard page perf (now /payment Overview)
- `07-performance.spec.ts:40` — Payment history page perf (now /payment Overview history)
- `07-performance.spec.ts:48` — Offline queue sync UI perf

### Feature not built — 2 skipped

- `01-stripe-onetime.spec.ts:149` — Offline queue feature not yet implemented
- `04-gdpr-consent.spec.ts:232` — Consent reset feature not yet implemented

### Edge-function flow — 1 skipped

- `02-paypal-subscription.spec.ts:123` — Cancel drives the cancel-subscription Edge Function

### Legacy subscription-mgmt-page reference — 1 skipped

- `03-failed-payment-retry.spec.ts:136` — Subscription management page (retarget to /payment?tab=subscriptions)

### Won't-fix in E2E — 2 skipped

- `05-offline-queue.spec.ts:167` — Overflow/storage-warning handling not in scope for #4
- `07-performance.spec.ts:111` — FPS testing is not reliable in E2E tests
