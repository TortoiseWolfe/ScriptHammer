# Stability Tracking — post-#44 work order

**Updated**: 2026-05-14 · **Audit baseline**: 2026-04-25 (see [STATUS.md](../STATUS.md))

**Family A status**: both items shipped (PR #56, PR #59). **E2E flake mitigation (round 10) also closed on 2026-05-13** via PR #89 (concurrency mutex + WebKit scroll-event fix). Family A is empty.
**Family D status**: D1 shipped (PR #60). D2 (#49 audit instrumentation) is the only D item remaining.
**Next-session entry point**: Family B1 (#43, `/payment-result` retry-UX gaps — page itself shipped 2026-04-16) — see `docs/SESSION-HANDOFF-2026-04-27.md` and the more recent session deliverables in [PRP-STATUS.md "v0.4.x updates" section](prp-docs/PRP-STATUS.md#v04x-updates-since-2026-04-25-audit).

This document is the cross-issue work-order. STATUS.md describes _what_ the gaps are; this describes _which order_ to close them in and _why_. New issues land here first, then graduate into PRs.

For raw issue lists: `gh issue list --label gap-audit --repo TortoiseWolfe/ScriptHammer`

---

## How this is organized

Work groups by **Family** (from STATUS.md "What Closes the v0.0.x → v0.1.0 Gap"). Within each family, issues run **highest leverage first** — fix a thing that unblocks 3+ other things before fixing a leaf-node thing.

| Family | Theme                                                                | Why it goes first/last                                                               |
| ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **A**  | Stability — fix the post-remake regression patterns                  | Every other family is more reliable once Family A lands. Bug-fix dollars compound.   |
| **B**  | Payment activation — wire the missing routes that block 84 e2e tests | One-shot deliverables that move 18 features from `[~]` to `[x]`.                     |
| **C**  | Test coverage — known untested LOC in production-critical paths      | Defensive. Doesn't unblock features but prevents the next regression family.         |
| **D**  | Audit-trail / fixture follow-ups from #44                            | Small, recently-discovered. Knocking these out keeps the audit-trail story coherent. |

Priority labels (`priority:p0`/`p1`/`p2`/`p3`) are orthogonal to family. A P1 in Family A gets the same urgency as a P1 in Family B; the Family ordering only matters when picking from a tie.

---

## Family A — Stability

The `feat/repo-overhaul-merge` of 2026-03-04 introduced patterns that have caused 18+ reverts in 3 months. Two of the four originally-flagged hotspots have already been fixed (see "Resolved" below). Two remain:

| Order | Issue                                                          | Severity | One-line                                                                                                                                                                                        |
| ----- | -------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1    | [#51](https://github.com/TortoiseWolfe/ScriptHammer/issues/51) | P1       | `admin/layout.tsx` async still has stale-closure on `user`; `cancelled` flag is partial. Land the regression test first, then hoist into a shared `useAuthGate`.                                |
| A2    | [#52](https://github.com/TortoiseWolfe/ScriptHammer/issues/52) | P1       | `base-queue.ts` claims atomically but `processItem`+complete spans tabs without a tx. Fix via watchdog reclaim + idempotency keys, not by chasing atomicity that can't exist for network calls. |

**Resolved (no work needed):**

- ConversationView regression — `useMemo(() => createClient(), [])` is in place at `useConversationRealtime.ts:46` and `useTypingIndicator.ts:32`, with comments naming the prior revert (adae629).
- GDPR Firefox focus timing — `requestAnimationFrame()` deferral is in place at `PaymentConsentModal.tsx:46-59`, with comment naming the prior revert (3e67772).
- **E2E flake mitigation (rounds 1-10)** — Round 10 (PR #89, commit 996211e, 2026-05-13) found the underlying cause: two concurrent CI runs racing each other's `cleanupOldMessages` `beforeAll` hooks against one shared Supabase project. Rounds 1-9 had attacked symptoms (retry budgets, stagger delays, Supabase priming, hydration timing). Fix: repo-wide `concurrency:` mutex in `.github/workflows/e2e.yml` (`group: e2e-supabase-${{ github.repository }}`, `cancel-in-progress: false`). Bundled fix: explicit `dispatchEvent('scroll')` after 4 `el.scrollTop = N` assignments in `tests/e2e/messaging/` (WebKit doesn't auto-fire scroll events for programmatic scrollTop). Verified by PRs #90, #91, #92, #93 all running clean through the mutex queue.

**Why A1 before A2:** A1 is auth — every user touches it. A2 is the offline queue, which only wedges when the user is actually offline mid-action. Auth correctness rarely; queue correctness sometimes.

---

## Family B — Payment activation

20+ payment RLS policies are verified (#44, closed). The remaining work is route + UI:

| Order | Issue                                                          | Severity | Unblocks                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----- | -------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1    | [#43](https://github.com/TortoiseWolfe/ScriptHammer/issues/43) | P2       | `/payment-result` retry-UX gaps (route itself shipped 2026-04-16, commit `ffb33a1`). Real work: idempotency-key reuse on retry, attempt counter + cooling period (FR-008-010), error categorization (FR-002), offline error banner, audit-log on retry (NFR-007). User Stories 3 + 4 (update method, recovery wizard) likely a follow-up PR. Unblocks several skips in `03-failed-payment-retry.spec.ts` per [#53](https://github.com/TortoiseWolfe/ScriptHammer/issues/53). |
| B2    | [#3](https://github.com/TortoiseWolfe/ScriptHammer/issues/3)   | P2       | `/payment-dashboard` (kebab-case, matching `/payment-demo` and `/payment-result`). Unblocks ~6 skips in `01-stripe-onetime`, `06-realtime-dashboard`, `07-performance`.                                                                                                                                                                                                                                                                                                      |
| B3    | [#4](https://github.com/TortoiseWolfe/ScriptHammer/issues/4)   | P2       | `/payment-history` + offline-queue UI affordances. Unblocks ~12 skips in `05-offline-queue` (whole file). Depends on A2 being landed cleanly so the UI describes a correct state machine.                                                                                                                                                                                                                                                                                    |
| B4    | [#5](https://github.com/TortoiseWolfe/ScriptHammer/issues/5)   | P2       | `/payment-subscriptions` + grace period + duplicate prevention + 4 edge functions. Largest of the four; unblocks ~10 skips.                                                                                                                                                                                                                                                                                                                                                  |
| B5    | [#53](https://github.com/TortoiseWolfe/ScriptHammer/issues/53) | P2       | The test-skip index. Closes incrementally as B1–B4 land.                                                                                                                                                                                                                                                                                                                                                                                                                     |

**Why B1 first:** smallest, lowest-risk, highest information density. Lets you exercise the "ship a route + remove its skips + close part of #53" loop on a tight feedback cycle before doing the harder routes.

**B3 depends on A2.** Don't wire offline-queue UI to a state machine that we know has a bug.

---

## Family C — Test coverage

Defensive only. Each item maps to a STATUS.md "Tier 7" feature.

| Order | Issue                                                          | Severity | What                                                                                           |
| ----- | -------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| C1    | [#38](https://github.com/TortoiseWolfe/ScriptHammer/issues/38) | P2       | `src/lib/seo/technical.ts` (429 LOC, 0 tests) + 029 SEO Editorial Assistant import-bundle UX.  |
| C2    | [#41](https://github.com/TortoiseWolfe/ScriptHammer/issues/41) | P3       | `message-service.ts` (1200+ LOC), `key-service.ts`, `group-key-service.ts`, `audit-logger.ts`. |
| C3    | (no issue yet)                                                 | P3       | Visual a11y for game components — STATUS.md feature 037. File when picked up.                  |

**Why C1 before C2:** SEO is a single-file/single-purpose module — tests can be added in 1 day. Messaging is 4 services, one of which is the largest in the repo. C2 is a multi-day project and likely needs its own breakdown.

---

## Family D — Audit-trail follow-ups (from #44)

| Order | Issue                                                          | Severity | What                                                                                                                                                        |
| ----- | -------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1    | [#50](https://github.com/TortoiseWolfe/ScriptHammer/issues/50) | P2       | RLS test fixture `globalSetup` to scrub stale `*@scripthammer.test` users + orphan FKs. ~1-2 hours.                                                         |
| D2    | [#49](https://github.com/TortoiseWolfe/ScriptHammer/issues/49) | P2       | Add `sign_up` audit log emission to the existing `on_auth_user_created` trigger so `get_security_metrics()` reports a real `signups_this_month`. ~half-day. |

**Why D1 before D2:** D1 fixes a wedge (RLS suite can't run on cloud after a killed prior run). D2 fixes a metric (admin dashboard underreports). Wedges before metrics.

---

## Active branches

_None as of 2026-05-14._ All branches from the 2026-05-12 through 2026-05-14 session merged cleanly with `delete_branch_on_merge=true` (PRs #86, #88, #89, #90, #91, #92, #93). Prior `044/payment-rls-verify` and `chore/post-044-tracking` both long since merged.

---

## How to use this doc

1. **Picking the next thing to work on:** scan top-down. The first non-`[done]` row in Family A wins. If A is empty, drop to B. If you're picking up something out of order, write a one-line note here explaining why.
2. **Filing a new issue:** check whether it fits an existing Family. If yes, add a row in the right place. If no, ask whether you've discovered a new Family or whether the issue belongs in a different doc.
3. **Closing an issue:** strike the row through (`~~~`) but leave it visible for one snapshot cycle so the work history is readable. Remove the next time STATUS.md is regenerated.
4. **Re-running the audit:** see the bottom of [STATUS.md](../STATUS.md). The truth-table (`scripts/audit/truth-table.json`) is the source of truth for spec-vs-code reality; this doc is the source of truth for _order_.

---

## Conventions

- Every gap-audit issue body links back to STATUS.md and any prior reverts by SHA.
- Stability hotspots cite file:line ranges, not paraphrases.
- Tracker issues (#53, this doc) get one row per blocker, not one row per skip — ten skips in one file under one cause is one item, not ten.
- "Resolved" entries stay visible for at least one snapshot so the next reader can see what was already done.
