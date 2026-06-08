# Payment E2E `test.skip` Index (#53)

**Regenerated 2026-06-08.** Indexes every skipped test in `tests/e2e/payment/` by
its **blocker**, so it's clear what must ship before each can be un-skipped — and
that none are skipped without a tracked reason. Line numbers and reasons below are
the ground truth in the specs as of this date (verified by grepping
`test.skip(true, ...)`), not a hand-maintained guess.

## Summary

`tests/e2e/payment/` contains **27 skipped tests** (each via
`test.skip(true, '<reason>')`), across 7 spec files. They fall into these blocker
buckets:

| Blocker                             | Count | Unblocked by                                                        |
| ----------------------------------- | ----- | ------------------------------------------------------------------- |
| Unimplemented dashboard/realtime UI | 11    | small UI surfaces on `/payment/dashboard` + realtime widgets (#6)   |
| Live provider keys / webhooks       | 6     | Stripe/PayPal **sandbox credentials** set on the deployed functions |
| Offline-queue seed fixture          | 4     | an in-page Dexie queue-seed fixture (autonomous; see note below)    |
| Unimplemented route/page            | 3     | `/payment/subscriptions`, `/payment/history` routes                 |
| Won't-fix in E2E                    | 2     | FPS measurement + script-bundling (covered elsewhere / unreliable)  |
| Edge-function flow                  | 1     | exercising the `cancel-subscription` Edge Function end-to-end       |

**Just un-skipped (2026-06-08, no creds):** the **grace-period countdown** and
**duplicate-prevention (23505)** tests in `02-paypal-subscription.spec.ts` now run
against a seeded subscription row via the new `seedIsolatedSubscription` fixture
(`tests/e2e/utils/test-user-factory.ts`). They needed a fixture, not credentials.

**Key takeaways for un-skipping:**

- **6 tests need live sandbox credentials** (full Stripe/PayPal redirect + webhook
  flows). With the Edge Functions now deployed to prod, the only remaining gate is
  setting the provider secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`) via the Management API `/secrets`
  endpoint. These stay skipped in CI by design.
- **4 offline-queue tests need a Dexie seed fixture.** These are empty stubs whose
  bodies must also be written; the queue is client-side (`PaymentQueueV2` /
  `queuedOperations` Dexie store, via `@/lib/offline-queue/payment-adapter`), so the
  fixture must seed IndexedDB in-page (call the app's own `paymentQueue` API), not
  the server `payment_intents` table. Autonomous but non-trivial — deferred.
- **The remaining ~16** are genuinely unimplemented UI surfaces or routes
  (realtime widgets, `/payment/subscriptions`, `/payment/history`) and 2
  won't-fix-in-E2E perf cases. They are NOT credential-blocked.

> Note: the Edge Functions these flows call (Stripe checkout/subscription/verify,
> PayPal order/capture/subscription, cancel/resume, the webhooks) are all DEPLOYED
> to prod as of 2026-06-08 (via the Supabase Management API). So the remaining
> payment blockers are **sandbox creds** + **a few front-end surfaces**, not the
> backend code.

## Full index by blocker

### Live provider keys / webhooks (sandbox creds) — 6 skipped

- `02-paypal-subscription.spec.ts:56` — PayPal API keys not configured - skipping flow test
- `02-paypal-subscription.spec.ts:124` — Needs a seeded past_due/grace row + PayPal sandbox keys
- `06-realtime-dashboard.spec.ts:85` — Payment list updates require actual Stripe integration
- `06-realtime-dashboard.spec.ts:92` — Webhook verification requires actual Stripe webhooks
- `07-performance.spec.ts:19` — Stripe API keys not configured - use k6 for load testing
- `07-performance.spec.ts:116` — Script bundling test requires Stripe integration

### Offline-queue seed fixture (autonomous — Dexie) — 4 skipped

- `05-offline-queue.spec.ts:102` — Needs a queue-seed fixture or provider creds to enqueue
- `05-offline-queue.spec.ts:110` — Needs a queue-seed fixture or provider creds to enqueue
- `05-offline-queue.spec.ts:118` — Needs a queue-seed fixture to enqueue multiple items
- `05-offline-queue.spec.ts:137` — Needs a seeded failed item to exercise backoff/retry UI

### Edge-function flow — 1 skipped

- `02-paypal-subscription.spec.ts:120` — Cancel drives the cancel-subscription Edge Function

### Unimplemented route/page — 3 skipped

- `03-failed-payment-retry.spec.ts:136` — Subscription management page not yet implemented
- `06-realtime-dashboard.spec.ts:99` — Subscription management page not yet implemented
- `07-performance.spec.ts:40` — Payment history page not yet implemented

### Unimplemented dashboard / realtime UI — 11 skipped

- `01-stripe-onetime.spec.ts:149` — Offline queue feature not yet implemented
- `04-gdpr-consent.spec.ts:232` — Consent reset feature not yet implemented
- `06-realtime-dashboard.spec.ts:104` — Transaction counter not yet implemented
- `06-realtime-dashboard.spec.ts:112` — Offline status indicator not yet implemented
- `06-realtime-dashboard.spec.ts:120` — Reconnection UI not yet implemented
- `06-realtime-dashboard.spec.ts:125` — Batch update UI not yet implemented
- `06-realtime-dashboard.spec.ts:130` — Real-time error notifications not yet implemented
- `06-realtime-dashboard.spec.ts:135` — Payment chart not yet implemented
- `07-performance.spec.ts:26` — Payment dashboard page not yet implemented
- `07-performance.spec.ts:33` — Payment dashboard page not yet implemented
- `07-performance.spec.ts:48` — Offline queue sync UI not yet implemented

### Won't-fix in E2E — 2 skipped

- `05-offline-queue.spec.ts:167` — Overflow/storage-warning handling not in scope for #4
- `07-performance.spec.ts:111` — FPS testing is not reliable in E2E tests
