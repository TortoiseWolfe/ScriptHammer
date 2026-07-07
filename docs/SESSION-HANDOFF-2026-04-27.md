# Session Handoff — 2026-04-27

> **For the next operator**: this doc captures what shipped today, what's still open, and the recommended pickup point. Read this first, then `STATUS.md`, then `docs/STABILITY-TRACKING.md`. The repo is in a clean post-batch state — `main` is at `ed21c21`, no in-flight branches, no uncommitted work other than the doc you're reading.

## What shipped today

Six PRs merged to main in this order:

| PR  | Title                                                                                | Closes |
| --- | ------------------------------------------------------------------------------------ | ------ |
| #54 | `fix(rls)`: payment RLS verified — correct stale audit-log assertion                 | #44    |
| #55 | `docs(stability)`: record post-#44 state, add cross-issue tracking plan              | —      |
| #56 | `test(admin)`: extract AdminGate, pin safety properties via regression test          | #51    |
| #58 | `ci(e2e)`: fail loud when wait-on times out, capture serve diagnostics               | —      |
| #59 | `fix(offline-queue)`: watchdog reclaim + idempotent payment INSERTs                  | #52    |
| #60 | `fix(rls)`: cleanup-stale globalSetup so killed prior runs don't wedge pnpm test:rls | #50    |

Issues filed during the session that remain open: #49, #53, #57.

## What's true now that wasn't yesterday morning

- **Family A (stability hotspots) is empty.** All four originally-flagged hotspots in STATUS.md are now resolved (two were already fixed in earlier work — ConversationView, PaymentConsentModal — and the other two shipped today via PR #56 and PR #59). The "18+ reverts in 3 months" pattern that haunted the post-remake era now has regression test coverage on every shape that produced it.
- **CI signal is loud.** PR #58 made the `Start server` step fail in 90 seconds with captured diagnostics instead of cascading 50 minutes of ECONNREFUSED. The next time CI looks broken, the failed step's output will tell you why.
- **Offline payment queue is exactly-once-observable.** Tab crashes mid-sync no longer leave items in limbo, and a retry of a successful INSERT is a server-side no-op (partial unique index on `payment_intents.idempotency_key`).
- **`pnpm test:rls` recovers from killed prior runs.** A globalSetup hook walks the FK chain (`payment_intents → subscriptions → user_profiles → auth.deleteUser`) for every `*@scripthammer.test` user before tests collect, so the manual cleanup that was needed on 2026-04-26 is no longer needed.
- **Three consecutive green chromium-msg shards.** PR #58, PR #59, PR #60 all passed messaging E2E on first try. The "9 rounds of flake mitigation" framing in STATUS.md may overstate the current frequency; #57 is probably P2, not P1, but I haven't downgraded its label yet.

## Recommended next pickup: B1 (#43, `/payment-result` retry-UX gaps)

> **Correction (next session, 2026-04-27)**: I called the route "missing" here. It's not. `src/app/payment-result/page.tsx` shipped in commit `ffb33a1` on 2026-04-16 — a 290-LOC, 6-state page with auth gating, real-time updates, and a working retry button. The 2026-04-25 audit cross-referenced spec text rather than the filesystem and concluded "route missing"; that error then propagated through STATUS.md, PRP-STATUS.md, the spec, and into this doc. The route name is `/payment-result` (kebab-case, matching `/payment-demo`), not `/payment/result` (which never existed).
>
> The real B1 work is the _retry UX_ gaps that were obscured by the framing — see "Real B1 work" below. Doc-correction PR: branch `043/doc-fix-payment-result-route-name`.

Reasoning: stability backlog is thin enough that user-facing work is now the higher-leverage front. The remaining work in #43 is real: idempotency-key reuse on retry, retry attempt counter + cooling period (FR-008-010), error categorization (FR-002), offline error banner, audit-log on retry (NFR-007). User Stories 3 (update payment method) and 4 (recovery wizard) are P1 in the spec but likely a follow-up PR.

- The page is at `src/app/payment-result/page.tsx`, with the retry button in `src/components/payment/PaymentStatusDisplay/PaymentStatusDisplay.tsx`.
- `retryFailedPayment()` is in `src/lib/payments/payment-service.ts:237` — currently calls `createPaymentIntent()` for a fresh INSERT, which loses the queued `idempotency_key` and bypasses the partial unique index. Fixing that is the first concrete change.
- The PaymentConsentModal (already-resolved hotspot) handles the consent-gate flow, so there's no auth-race risk introduced.

Alternatives the next session might prefer:

- **D2 (#49)** — `auth_audit_logs` sign_up event instrumentation. ~half-day. Touches the existing `create_user_profile()` trigger function in the monolithic migration. Tighter scope than B1 but no immediate user-visible payoff.
- **STATUS.md/PRP-STATUS.md re-audit** — much of STATUS.md was last verified during the 2026-04-25 audit. Two more "Resolved" items have flipped today; the truth-table.json is now stale. A short audit pass (~30 min) would refresh confidence in the doc.

## Sharp edges to know about

- **Supabase Cloud auth admin rate limit.** The cleanup-stale hook makes us slightly more likely to brush against it on cloud — running `pnpm test:rls` immediately after the hook cleans a stale user can hit "Request rate limit reached" on `createTestUser`. The fix is to wait ~75 seconds; not a code bug. CI hasn't tripped this in any of today's runs, so no follow-up filed.
- **`fileParallelism: false` is load-bearing in `vitest.rls.config.ts`.** Don't remove it — RLS test files share `*@scripthammer.test` users and parallel runs would race the create/delete cycles.
- **`subscription_update` operation in payment-adapter is intentionally without idempotency-key handling.** UPDATE is implicitly idempotent by primary key. Don't extend the watchdog/idempotency machinery there without a real failure case.
- **The `payment_intents.idempotency_key` partial unique index** is `WHERE idempotency_key IS NOT NULL`. Direct-server INSERTs (admin tooling, edge functions) without a key remain valid — only client-queued INSERTs participate in dedupe. If a future feature does direct INSERTs and _expects_ dedupe, it must supply its own key.

## Open issues (gap-audit) — current state

| #   | Title                                                                            | Family       | Notes                                                                          |
| --- | -------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------ |
| #21 | 001 WCAG AA: AAA scope gap + 4 ContactForm a11y failures                         | (audit-tier) | Pre-existing                                                                   |
| #22 | 004 Mobile-First: regenerate wireframes + perf tests                             | (audit-tier) | Pre-existing                                                                   |
| #23 | 005 Security Hardening: session-timeout UI + audit dashboard + secret detection  | (audit-tier) | Pre-existing                                                                   |
| #24 | 006 Template Fork: Supabase missing-config first-run banner                      | (audit-tier) | Pre-existing                                                                   |
| #25 | 010 Unified Blog: offline edit + sync + migration                                | (audit-tier) | Pre-existing                                                                   |
| #26 | 011 + 043 Group Chats: 8 stub member-management methods                          | (audit-tier) | Pre-existing                                                                   |
| #27 | 012 + 014: welcome message admin gate flow                                       | (audit-tier) | Pre-existing                                                                   |
| #28 | 013 OAuth Messaging Password                                                     | (audit-tier) | Pre-existing                                                                   |
| #29 | 015 OAuth Display Name                                                           | (audit-tier) | Pre-existing                                                                   |
| #30 | 016 Messaging Critical Fixes (5 UX)                                              | (audit-tier) | Pre-existing                                                                   |
| #31 | 019 Google Analytics: wire NEXT_PUBLIC_GA_MEASUREMENT_ID                         | (audit-tier) | Pre-existing                                                                   |
| #32 | 020 PWA Background Sync: Firefox/Safari fallback                                 | (audit-tier) | Pre-existing                                                                   |
| #34 | 023 EmailJS Integration: provider health dashboard                               | (audit-tier) | Pre-existing                                                                   |
| #35 | 026 Unified Messaging Sidebar: mobile drawer + badge sync                        | (audit-tier) | Pre-existing                                                                   |
| #37 | 028 Enhanced Geolocation: address search + mobile GPS                            | (audit-tier) | Pre-existing                                                                   |
| #38 | 029 SEO Editorial Assistant: technical.ts test coverage                          | C1           | Pre-existing                                                                   |
| #39 | 030 Calendar Integration: env vars + 32-theme mapping                            | (audit-tier) | Pre-existing                                                                   |
| #41 | 035 Messaging Service Tests                                                      | C2           | Pre-existing; multi-day                                                        |
| #43 | 040 Payment Retry UI: `/payment-result` retry-UX gaps (route shipped 2026-04-16) | **B1**       | **Recommended next**                                                           |
| #45 | 044 Error Handler Integrations: Sentry/LogRocket                                 | (audit-tier) | Pre-existing                                                                   |
| #46 | 045 Disqus Theme: 32-theme mapping                                               | (audit-tier) | Pre-existing                                                                   |
| #47 | gdpr-compliance.spec.ts: ENOTFOUND scripthammer-supabase-kong-1                  | (audit-tier) | Pre-existing — real bug, not in any family yet                                 |
| #49 | auth_audit_logs sign_up events not written for all signup paths                  | **D2**       | Filed in this session                                                          |
| #53 | tests/e2e/payment/: 84 test.skip — index by blocker                              | **B5**       | Filed in this session; closes incrementally as B1–B4 ship                      |
| #57 | Messaging E2E: chromium-msg cross-window propagation                             | —            | Filed in this session; possibly de-prioritize to P2 given 3 consecutive greens |

Eval-backlog items (separate label): #3, #4, #5 — all map to Family B (B2, B3, B4 respectively).

## Quick-start for the next session

```bash
# 1. Confirm clean state
git status --short
git rev-parse --abbrev-ref HEAD   # main
git log --oneline -1              # ed21c21 (or later if more landed)

# 2. Read the recommended pickup
gh issue view 43 --repo TortoiseWolfe/ScriptHammer
cat features/payments/040-payment-retry-ui/spec.md   # if it exists

# 3. Branch and brainstorm
docker compose exec scripthammer git checkout -b 043/payment-result-page
# Then invoke superpowers:brainstorming for the design conversation
```

## Things I would not bother doing in the next session

- **Don't unify #50 and #57** — yesterday I proposed it; today I withdrew it. Different user pools (`*@scripthammer.test` for RLS vs `TEST_USER_PRIMARY_EMAIL` for E2E). They're genuinely separate problems.
- **Don't refactor `BaseOfflineQueue` to share with the messaging offline-queue service** — different design surfaces (encryption + FIFO). Premature.
- **Don't speculatively bump the wait-on timeout in `.github/workflows/e2e.yml`** — the diagnostic-loud version that landed in PR #58 will tell you if 60s is genuinely too short. Wait for evidence.
- **Don't try to make the watchdog use `navigator.locks.request()`** unless a regression test empirically fails on Dexie's atomic-modify guarantees. The current implementation passes tests + cloud verification.

## What would be a good shape for the next session's first message

> "Read STATUS.md and docs/SESSION-HANDOFF-2026-04-27.md. Pick up B1 (#43): close the retry-UX gaps in `/payment-result` per features/payments/040-payment-retry-ui/spec.md. The route itself shipped 2026-04-16; real work is idempotency-key reuse on retry, attempt counter + cooling period, error categorization, offline error banner, audit-log on retry. Brainstorm-design-plan-implement per the superpowers workflow. Branch off main."

That's enough to ground the next agent without re-deriving anything from this conversation.
