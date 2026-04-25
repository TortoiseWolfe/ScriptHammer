# ScriptHammer Status

**Snapshot**: 2026-04-25 · **Version**: v0.0.1 · **Stability**: Beta — post-remake stabilization in progress

This is the single screen-scan view of "what's planned, what's shipped, what's broken."
For the deeper per-feature audit see [`docs/prp-docs/PRP-STATUS.md`](docs/prp-docs/PRP-STATUS.md).
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
- [~] **001 WCAG AA Compliance** — pa11y/axe wired; AAA scope gap, 4 ContactForm a11y failures
- [x] **002 Cookie Consent** — full GDPR compliance (PRP-007 complete)
- [x] **003 User Authentication** — email/password + OAuth GitHub/Google. **Stability hotspot: ProtectedRoute auth race (3 reverts)**
- [~] **004 Mobile-First Design** — responsive code shipped; wireframes need regen, perf tests incomplete
- [~] **005 Security Hardening** — core shipped (rate-limit, CSRF, validation); session-timeout UI + audit dashboard incomplete
- [~] **006 Template Fork Experience** — `scripts/rebrand.sh` + docs/FORKING.md shipped; Supabase missing-config banner pending

## Tier 2 — Core Features + Auth-OAuth (11 features)

- [x] **007 E2E Testing Framework** — 60+ specs, 24-shard CI, cross-browser. **Stability hotspot: 9 rounds of flake mitigation**
- [x] **008 On The Account (Avatar)** — upload + crop + persistence + E2E
- [x] **009 User Messaging System** — E2E-encrypted, 12 spec files. **Stability hotspot: ConversationView regression**
- [~] **010 Unified Blog Content** — 3 modules + routes shipped; offline editing/sync/migration not implemented
- [~] **011 Group Chats** — group creation works; **8 stub methods block member ops** (see 043)
- [~] **012 Welcome Message Architecture** — service exists; full flow blocked on 014 admin gate
- [~] **043 Group Service** — backing for 011; addMembers, getMembers, removeMember, leaveGroup, transferOwnership, upgradeToGroup, renameGroup, deleteGroup all stubbed
- [ ] **013 OAuth Messaging Password** — not started
- [!] **014 Admin Welcome Email Gate** — admin pages exist; gate UI for messaging access missing
- [~] **015 OAuth Display Name** — callback population not verified; fallback cascade untested; existing-user migration missing
- [ ] **016 Messaging Critical Fixes** — 5 separate UX fixes, none shipped

## Tier 3 — Enhancements (5 features)

- [x] **017 Colorblind Mode** — 8 colorblind variants, theme-compatible
- [x] **018 Font Switcher** — 6 fonts incl. dyslexia-friendly + high-readability
- [~] **019 Google Analytics** — code shipped; awaits per-fork `NEXT_PUBLIC_GA_MEASUREMENT_ID`
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
- [!] **040 Payment Retry UI** — retry logic in service; `/payment/result` page + retry surface missing
- [~] **041 PayPal Subscriptions** — backend ready; `/payment/subscriptions` page + grace-period banner + duplicate prevention + 4 edge functions missing (#5)
- [!] **042 Payment RLS Policies** — 20+ policies written; **25 E2E test stubs awaiting un-skip + verify**

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

| Status                      | Count  | Features                                                                                                                               |
| --------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Shipped `[x]`               | 17     | 000-brand, 000-landing, 000-rls, 002, 003, 007, 008, 009, 017, 018, 022, 025, 031, 032, 034, 036, 046                                  |
| Mostly Shipped (config gap) | 6      | 004, 006, 011, 019, 024, 030                                                                                                           |
| Partial `[~]`               | 19     | Most active backlog lives here (010, 012, 015, 020, 021, 023, 026, 027, 029, 033, 035, 037, 038, 039, 041, 043, 045, plus 001 and 005) |
| Backend Only `[!]`          | 3      | 014, 040, 042                                                                                                                          |
| Not Started `[ ]`           | 4      | 013, 016, 028, 044                                                                                                                     |
| **Total**                   | **49** | (3 features — 000-brand, 000-landing, 046-admin — lack `spec.md` and are tracked via `*_feature.md` only)                              |

---

## What Closes the v0.0.x → v0.1.0 Gap

If we want a stable v0.1.0, three families of work close it:

### A. Stability — fix the post-remake regression patterns (highest leverage)

The `feat/repo-overhaul-merge` of 2026-03-04 introduced patterns that have caused **18+ reverts in 3 months** and a 5x increase in fix-rate. The same shapes repeat in code that wasn't reverted yet:

| Hotspot                           | Status                                                                                            | Evidence                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **ProtectedRoute auth race**      | Open                                                                                              | 3 reverts: 6b4c13a, 2c97e67, 259b38d. **Now duplicated in `src/app/admin/layout.tsx`** (regression re-introduced).                |
| **ConversationView regression**   | Open                                                                                              | revert adae629. Root cause: `createClient()` at hook top level in `useConversationRealtime.ts:42` and `useTypingIndicator.ts:31`. |
| **GDPR consent Firefox**          | Resolved by revert; same shape in `PaymentConsentModal.tsx:46-57` (focus-after-showModal timing). |
| **Offline-queue IndexedDB drift** | Resolved (40f0d0e) but `base-queue.ts:216-242` lacks transactions; cross-tab sync still racey.    |
| **E2E flake mitigation**          | Ongoing                                                                                           | 9 rounds. Cause: stale closures, unstable hook refs, hydration timing.                                                            |

The full code-review findings (35 high-confidence items) live in [`scripts/audit/code-review-findings.json`](scripts/audit/code-review-findings.json). The pattern is consistent: stale closures after async auth, unstabilized context providers, hooks creating new Supabase clients every render.

### B. Payment activation — small effort, big unlock

024/038/039/040/041/042 are ~75% built. To take them green:

1. Create Stripe sandbox + PayPal developer accounts (~30-60 min external setup)
2. Populate 6 keys in `.env` + Supabase Vault
3. Wire 4 missing routes (`/payment/dashboard`, `/payment/subscriptions`, `/payment/history`, `/payment/result`)
4. Build offline-queue UI affordances (status indicator, sync pill, retry button)
5. Un-skip 25 RLS test stubs and verify policies enforce what they claim

GitHub issues #3, #4, #5 already track the bigger pieces.

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
