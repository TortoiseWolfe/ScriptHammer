# Stability Tracking — post-#44 work order

**Updated**: 2026-04-26 · **Audit baseline**: 2026-04-25 (see [STATUS.md](../STATUS.md))

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

**Why A1 before A2:** A1 is auth — every user touches it. A2 is the offline queue, which only wedges when the user is actually offline mid-action. Auth correctness rarely; queue correctness sometimes.

---

## Family B — Payment activation

20+ payment RLS policies are verified (#44, closed). The remaining work is route + UI:

| Order | Issue                                                          | Severity | Unblocks                                                                                                                                                                                        |
| ----- | -------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1    | [#43](https://github.com/TortoiseWolfe/ScriptHammer/issues/43) | P2       | `/payment/result` page + retry surface. Smallest of the four routes. Unblocks ~5 skips in `03-failed-payment-retry.spec.ts` per [#53](https://github.com/TortoiseWolfe/ScriptHammer/issues/53). |
| B2    | [#3](https://github.com/TortoiseWolfe/ScriptHammer/issues/3)   | P2       | `/payment/dashboard`. Unblocks ~6 skips in `01-stripe-onetime`, `06-realtime-dashboard`, `07-performance`.                                                                                      |
| B3    | [#4](https://github.com/TortoiseWolfe/ScriptHammer/issues/4)   | P2       | `/payment/history` + offline-queue UI affordances. Unblocks ~12 skips in `05-offline-queue` (whole file). Depends on A2 being landed cleanly so the UI describes a correct state machine.       |
| B4    | [#5](https://github.com/TortoiseWolfe/ScriptHammer/issues/5)   | P2       | `/payment/subscriptions` + grace period + duplicate prevention + 4 edge functions. Largest of the four; unblocks ~10 skips.                                                                     |
| B5    | [#53](https://github.com/TortoiseWolfe/ScriptHammer/issues/53) | P2       | The test-skip index. Closes incrementally as B1–B4 land.                                                                                                                                        |

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

| Branch                    | Purpose                                                 | Status                         |
| ------------------------- | ------------------------------------------------------- | ------------------------------ |
| `044/payment-rls-verify`  | #44 — RLS test suite verification (55/55 local + cloud) | Pushed; awaiting merge to main |
| `chore/post-044-tracking` | This document + STATUS.md updates                       | In progress                    |

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
