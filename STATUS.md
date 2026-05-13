# ScriptHammer Status

**Snapshot**: 2026-05-13 · **Version**: v0.0.1 · **Stability**: Beta — Phase 0 (template hygiene) closed; E2E flake round 10 closed via concurrency mutex (#89); GrimGlow ThreeJS fork (Phase 0.5) green-lit; Family B (payment routes) is the next-leverage front

This is the single screen-scan view of "what's planned, what's shipped, what's broken."
For the deeper per-feature audit see [`docs/prp-docs/PRP-STATUS.md`](docs/prp-docs/PRP-STATUS.md).
For the cross-issue work-order see [`docs/STABILITY-TRACKING.md`](docs/STABILITY-TRACKING.md).
Raw machine-readable data: [`scripts/audit/truth-table.json`](scripts/audit/truth-table.json).

---

## Legend

- `[x]` Shipped — code in `src/`, tests pass, AC met, no open work
- `[~]` Mostly Shipped / Partial — substantive code exists, specific gaps remain
- `[ ]` Not Started — no matching code or only scaffolding
- `[!]` Backend Only — lib/services done, UI not built
- `(#NN)` GitHub issue number — see filter `gh issue list --label gap-audit`

---

## Tier 1 — Foundation (9 features)

- [x] **000 Brand Identity** — AnimatedLogo + SpinningLogo shipped
- [x] **000 Landing Page** — `/` route + interactive game shipped
- [x] **000 RLS Implementation** — 17 tables RLS-protected in monolithic migration
- [x] **001 WCAG AAA Compliance** — pa11y/axe wired at AAA standard; ContactForm a11y green; live overlay deferred to #80 (#21 closed PR #81)
- [x] **002 Cookie Consent** — full GDPR compliance (PRP-007 complete)
- [x] **003 User Authentication** — email/password + OAuth GitHub/Google. **Stability hotspot: ProtectedRoute auth race (3 reverts)**
- [x] **004 Mobile-First Design** — Web Vitals (LCP/INP/CLS) instrumented through GoogleAnalytics; wireframes re-validated against v5.4 (#22 closed PR #78)
- [~] **005 Security Hardening** — core shipped (rate-limit, CSRF, validation); session-timeout UI + audit dashboard incomplete
- [x] **006 Template Fork Experience** — `scripts/rebrand.sh` + FORKING.md + Supabase missing-config SetupBanner (env-vars named, FORKING.md anchor) (#24 closed PR #77; #69 Docker volume permissions closed PR #70)

## Tier 2 — Core Features + Auth-OAuth (11 features)

- [x] **007 E2E Testing Framework** — 60+ specs, 24-shard CI, cross-browser. **Stability hotspot resolved 2026-05-13**: 10 rounds of flake mitigation closed via concurrency mutex (#89) + WebKit scroll-event dispatch
- [x] **008 On The Account (Avatar)** — upload + crop + persistence + E2E
- [x] **009 User Messaging System** — E2E-encrypted, 12 spec files. **Stability hotspot: ConversationView regression**
- [~] **010 Unified Blog Content** — 3 modules + routes shipped; offline editing/sync/migration not implemented
- [~] **011 Group Chats** — group creation works; **8 stub methods block member ops** (see 043)
- [~] **012 Welcome Message Architecture** — service exists; full flow blocked on 014 admin gate
- [~] **043 Group Service** — backing for 011; addMembers, getMembers, removeMember, leaveGroup, transferOwnership, upgradeToGroup, renameGroup, deleteGroup all stubbed
- [ ] **013 OAuth Messaging Password** — not started
- [!] **014 Admin Welcome Email Gate** — admin pages exist; gate UI for messaging access missing
- [x] **015 OAuth Display Name** — full cascade (full_name > name > user_name > preferred_username > email_prefix); GitHub/Google fixtures tested; SQL bootstrap mirrors JS cascade (#29 closed PR #75)
- [ ] **016 Messaging Critical Fixes** — 5 separate UX fixes, none shipped

## Tier 3 — Enhancements (5 features)

- [x] **017 Colorblind Mode** — 8 colorblind variants, theme-compatible
- [x] **018 Font Switcher** — 6 fonts incl. dyslexia-friendly + high-readability
- [x] **019 Google Analytics** — code shipped; per-fork `NEXT_PUBLIC_GA_MEASUREMENT_ID` is fork-config not code work (#31 closed 2026-05-13)
- [~] **020 PWA Background Sync** — Chromium works; Firefox/Safari fallback incomplete; storage-limit warnings missing
- [~] **021 Geolocation Map** — base map + permissions work; keyboard nav + accuracy radius missing

## Tier 4 — Integrations (5 features)

- [x] **022 Web3Forms Integration** — full validation + spam + offline queue
- [~] **023 EmailJS Integration** — failover works for users; admin health dashboard missing
- [~] **024 Payment Integration** — **all code/components/edge-functions ready**; blocked on Stripe + PayPal API keys (~30-60 min setup) (#3 #4 #5)
- [x] **025 Blog Social Features** — share buttons + author bios + OG/Twitter metadata
- [~] **026 Unified Messaging Sidebar** — desktop stable; mobile drawer + badge sync need polish

## Tier 4.5 — Admin (1 feature)

- [x] **046 Admin Dashboard** — 4 domains shipped (audit, messaging, payments, users); JWT-claim RLS

## Tier 5 — Payments Sub-Features (5 features)

- [~] **038 Payment Dashboard** — components built; `/payment/dashboard` route missing (#3)
- [~] **039 Payment Offline Queue** — logic built; status indicator UI + `/payment/history` missing (#4)
- [~] **040 Payment Retry UI** — `/payment-result` route shipped (commit `ffb33a1`, 2026-04-16) — 6-state page + retry button. Real gaps (#43): retry doesn't reuse queued `idempotency_key`, no attempt counter / cooling period (FR-008-010), no error categorization (FR-002), no offline error banner, no audit log on retry, P1 stories 3+4 (update-method, recovery wizard) unbuilt
- [~] **041 PayPal Subscriptions** — backend ready; `/payment/subscriptions` page + grace-period banner + duplicate prevention + 4 edge functions missing (#5)
- [x] **042 Payment RLS Policies** — 20+ policies verified by `pnpm test:rls` (55/55 across 5 files, both local + cloud) — #44 closed 2026-04-26

## Tier 6 — Polish (4 features)

- [~] **027 UX Polish** — markdown + char-count work; edge cases untested, no a11y test
- [ ] **028 Enhanced Geolocation** — only consent gate exists; address search, mobile GPS, click-to-set missing
- [~] **029 SEO Editorial Assistant** — UI + 3 of 4 modules tested; `technical.ts` (429 LOC) untested
- [~] **030 Calendar Integration** — provider abstraction works; per-fork env vars + 32-DaisyUI-theme mapping missing

## Tier 7 — Testing (7 features)

- [x] **031 Standardize Test Users** — seed script + factory shipped
- [x] **032 Signup E2E Tests** — full coverage, all green
- [~] **033 SEO Library Tests** — 3 of 4 modules tested; **`src/lib/seo/technical.ts` is the gap**
- [x] **034 Blog Library Tests** — **STATUS WAS STALE**; commit c9f728d (2026-04-20) added 140 unit tests
- [~] **035 Messaging Service Tests** — 4 of 8 services tested; **`message-service`, `key-service`, `group-key-service`, `audit-logger` untested** (largest service is uncovered)
- [x] **036 Auth Component Tests** — **STATUS WAS STALE**; all 6 components have full test+a11y coverage
- [~] **037 Game A11y Tests** — keyboard + ARIA covered; visual a11y (contrast, prefers-reduced-motion, colorblind integration) incomplete

## Tier 8 — Code Quality (2 features)

- [ ] **044 Error Handler Integrations** — basic ErrorBoundary only; Sentry/LogRocket + PII scrubbing + session replay missing
- [~] **045 Disqus Theme** — consent + dark/light works; per-DaisyUI-theme color mapping + smooth transitions missing

---

## Summary by Status

| Status                      | Count  | Features                                                                                                                                |
| --------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Shipped `[x]`               | 23     | 000-brand, 000-landing, 000-rls, 001, 002, 003, 004, 006, 007, 008, 009, 015, 017, 018, **019**, 022, 025, 031, 032, 034, 036, 042, 046 |
| Mostly Shipped (config gap) | 3      | 011, 024-payment, 030                                                                                                                   |
| Partial `[~]`               | 15     | 010, 012, 020, 021, 023, 026, 027, 029, 033, 035, 037, 038, 039, 041, 043, 045, plus 005                                                |
| Backend Only `[!]`          | 2      | 014, 040                                                                                                                                |
| Not Started `[ ]`           | 4      | 013, 016, 028, 044                                                                                                                      |
| **Total**                   | **49** | (3 features — 000-brand, 000-landing, 046-admin — lack `spec.md` and are tracked via `*_feature.md` only)                               |

---

## What Closes the v0.0.x → v0.1.0 Gap

If we want a stable v0.1.0, three families of work close it:

### A. Stability — fix the post-remake regression patterns (highest leverage)

The `feat/repo-overhaul-merge` of 2026-03-04 introduced patterns that have caused **18+ reverts in 3 months** and a 5x increase in fix-rate. The same shapes repeat in code that wasn't reverted yet:

| Hotspot                           | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ProtectedRoute auth race**      | Resolved | 3 prior reverts: 6b4c13a, 2c97e67, 259b38d. AdminGate now extracted to its own file with a 10-test regression suite pinning the `wasAdmin` debounce, the `cancelled` flag, and dep-array integrity. Closed by [#51](https://github.com/TortoiseWolfe/ScriptHammer/issues/51) (PR #56).                                                                                                                                                                                                                     |
| **ConversationView regression**   | Resolved | `createClient()` calls in `useConversationRealtime.ts:46` and `useTypingIndicator.ts:32` are now wrapped in `useMemo(() => createClient(), [])`. Comment in code names the prior revert (adae629).                                                                                                                                                                                                                                                                                                         |
| **GDPR consent Firefox**          | Resolved | `PaymentConsentModal.tsx:46-59` defers `acceptButtonRef.focus()` via `requestAnimationFrame()` after `dialog.showModal()`. Comment names the prior revert (3e67772).                                                                                                                                                                                                                                                                                                                                       |
| **Offline-queue IndexedDB drift** | Resolved | Watchdog reclaim (60s default) + `payment_intents.idempotency_key` partial unique index + upsert-with-ignoreDuplicates. At-least-once delivery + idempotent receiver = exactly-once observable outcome. Closed by [#52](https://github.com/TortoiseWolfe/ScriptHammer/issues/52) (PR #59).                                                                                                                                                                                                                 |
| **E2E flake mitigation**          | Resolved | 10 rounds. Rounds 1-9 attacked symptoms (stale closures, unstable hook refs, hydration timing, retry budgets, stagger delays, Supabase priming). Round 10 (#89, commit 996211e) found the underlying cause: two concurrent E2E CI runs racing against one Supabase project — fixed via repo-wide `concurrency:` mutex in `.github/workflows/e2e.yml` plus an explicit `dispatchEvent('scroll')` after each programmatic `el.scrollTop = N` to work around WebKit's quirk of not auto-firing scroll events. |

The full code-review findings (35 high-confidence items) live in [`scripts/audit/code-review-findings.json`](scripts/audit/code-review-findings.json). The pattern is consistent: stale closures after async auth, unstabilized context providers, hooks creating new Supabase clients every render.

### B. Payment activation — small effort, big unlock

024/038/039/040/041 are ~75% built. 042 RLS shipped (#44). To take the rest green:

1. Create Stripe sandbox + PayPal developer accounts (~30-60 min external setup)
2. Populate 6 keys in `.env` + Supabase Vault
3. Wire 3 missing routes (`/payment-dashboard`, `/payment-subscriptions`, `/payment-history`); `/payment-result` already shipped — see 040 entry for its remaining UX gaps
4. Build offline-queue UI affordances (status indicator, sync pill, retry button)
5. As each route lands, remove the corresponding skips from `tests/e2e/payment/` per [#53](https://github.com/TortoiseWolfe/ScriptHammer/issues/53)

GitHub issues #3, #4, #5, #43 track the route work; #53 is the test-skip index.

### C. Test coverage — known gaps

- **033**: `src/lib/seo/technical.ts` (429 LOC, 0 tests)
- **035**: `message-service.ts` (1200+ LOC), `key-service.ts`, `group-key-service.ts`, `audit-logger.ts` — all untested
- **037**: visual a11y for game components

---

## Snapshot — This Audit's Methodology

- 4 parallel `Explore` agents audited each of 47 feature spec dirs against `src/` code, `tests/` files, and the wireframes manifest
- 3 parallel `code-reviewer` agents swept `src/components/`, `src/lib/+services/`, and `src/contexts/+hooks/+app/` with confidence threshold ≥0.80
- Cross-referenced against existing trustworthy doc `docs/prp-docs/PRP-STATUS.md` (last updated 2026-04-08, covered 15 features)
- All 47 spec.md `**Status:**` fields were stale; they're now corrected (see Phase 4 commits)

---

## Re-running this audit

```bash
# Refresh truth table
docker compose exec scripthammer node scripts/audit/refresh-truth-table.mjs  # (script TBD)

# Verify published artifacts agree with reality
docker compose exec scripthammer node scripts/audit/verify.mjs

# List open audit-tracked work
gh issue list --label gap-audit
```
