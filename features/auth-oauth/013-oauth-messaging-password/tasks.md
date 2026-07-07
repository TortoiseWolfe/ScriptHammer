# Tasks: OAuth Messaging Password

**Branch**: `013-oauth-messaging-password` (working branch: `feat/oauth-messaging-password-28`) · **Generated**: 2026-05-06
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Wireframes**: [01-setup](./wireframes/01-oauth-password-setup.svg), [02-unlock](./wireframes/02-oauth-password-unlock.svg)

## Phase 1 — Setup

No setup tasks. Project structure, dependencies, Storybook, Playwright, Vitest, Pa11y are all already wired (Phase 0 closure).

## Phase 2 — Foundational (blocks all user stories)

Welcome-message helper extraction so both modal-setup AND page-setup paths share the dispatch logic.

- [ ] T001 [P] Create helper module at `src/lib/messaging/welcome/send-welcome-message.ts` exporting `sendWelcomeMessageOnSetup(user, keyPair, logger)` extracted verbatim from `src/app/messages/setup/page.tsx:133-149`. Module preserves dynamic import of `welcome-service` and the existing fire-and-forget error logging.
- [ ] T002 [US1] Update `src/app/messages/setup/page.tsx` submit handler to import + call the new `sendWelcomeMessageOnSetup` helper instead of the inline dispatch. Net diff: ~17 lines deleted, 1 line added. Behavior identical.

## Phase 3 — User Story 1: OAuth User Creates Messaging Password (P1)

**Goal**: An OAuth user landing on `/messages` for the first time sees the modal in setup mode (password + confirm + provider badge), creates a messaging password, gets keys initialized, lands in their inbox.

**Independent test**: Sign in via Google OAuth with no existing keys → navigate to `/messages` → verify modal opens with title "Create a Messaging Password", two password fields, "via Google" badge, "Save this password!" warning. Submit matching passwords → verify keys initialize, modal closes, user sees `/messages`. Mismatched passwords → verify error and submit blocked.

### Tests (RED first per Constitution II)

- [ ] T003 [P] [US1] Author Playwright spec at `tests/e2e/messaging/oauth-setup-modal.spec.ts` with three scenarios: (a) OAuth user no-keys lands on `/messages` → modal shows setup mode + provider badge → submit matching pw → routes to `/messages`; (b) mismatched passwords → error visible, submit disabled; (c) regression: email user lands on `/messages` (with keys, IndexedDB cleared) → modal shows unlock mode unchanged. Spec MUST FAIL until T006/T007 land.
- [ ] T004 [P] [US1] Extend `src/components/auth/ReAuthModal/ReAuthModal.test.tsx` with cases: setup-mode renders confirm field, unlock-mode does not; setup-mode submit calls `keyManagementService.initializeKeys`, unlock-mode submit calls `keyManagementService.deriveKeys`; mismatch validation prevents submit; provider badge renders only when `isOAuthUser(user)` returns true. Tests MUST FAIL until T006 lands.
- [ ] T005 [P] [US1] Extend `src/components/auth/ReAuthModal/ReAuthModal.accessibility.test.tsx` to cover both modes: aria-describedby points at the active mode's description, aria-live announces validation errors, focus returns to the password field after a mismatch error.

### Implementation

- [ ] T006 [US1] Extend `src/components/auth/ReAuthModal/ReAuthModal.tsx` to support `mode: 'setup' | 'unlock'`. State: add `confirmPassword` (only used in setup mode). Effect: when modal opens for an OAuth user, call `keyManagementService.hasKeysForUser(user.id)`; mode = `hasKeys ? 'unlock' : 'setup'`. Render: setup mode adds confirm-password field (per wireframe 01) with mismatch validation; both modes render provider badge ("via Google" / "via GitHub") via `getOAuthProvider(user)` when `isOAuthUser(user)`. Submit: setup → `initializeKeys(password)` then `sendWelcomeMessageOnSetup(...)`; unlock → existing `deriveKeys(password)` path. Preserve existing aria/focus management and password-manager auto-fill via Credential Management API.
- [ ] T007 [US1] Modify `src/components/auth/EncryptionKeyGate/EncryptionKeyGate.tsx` lines 73-94: when `hasKeysForUser(user.id)` returns false AND `isOAuthUser(user)`, set `setNeedsReAuth(true)` instead of `router.push('/messages/setup')`. Email users with no keys still redirect (existing behavior). The setup page is preserved as a deep-link fallback (FR-022).

### Story checkpoint

- [ ] T008 [US1] Verify all tests green inside Docker: `docker compose exec scripthammer pnpm test src/components/auth/ReAuthModal/ src/components/auth/EncryptionKeyGate/` and `docker compose exec scripthammer pnpm exec playwright test tests/e2e/messaging/oauth-setup-modal.spec.ts`. US-1 acceptance scenarios from spec.md lines 46-48 must pass.

## Phase 4 — User Story 2: Returning OAuth User Unlocks Messages (P2)

**Goal**: An OAuth user with existing keys (returning, IndexedDB cache cleared) sees a polished unlock prompt with provider badge + "this password is separate from your Google/GitHub login" subtext, exactly per wireframe 02.

**Independent test**: User with existing `user_encryption_keys` row + cleared IndexedDB → modal opens in unlock mode → verify wireframe-02-conformant copy: title "Unlock Your Messages", provider badge visible, subtext explicitly differentiates messaging password from OAuth credentials, single password field. Submit correct password → modal closes, inbox visible.

### Tests (RED first)

- [ ] T009 [P] [US2] Add Playwright scenario to `tests/e2e/messaging/oauth-setup-modal.spec.ts`: returning OAuth user (seed `user_encryption_keys` row, then clear IndexedDB before navigating) → modal opens in unlock mode → assert subtext contains "separate from your Google" / "separate from your GitHub" depending on provider → submit correct pw → routes to `/messages`. Spec MUST FAIL until T011 lands.
- [ ] T010 [P] [US2] Extend `ReAuthModal.test.tsx` with: unlock-mode subtext renders provider-specific text per `getOAuthProvider(user)` return value; subtext is byte-identical for email users (no leakage of OAuth-specific copy when `isOAuthUser(user)` returns false).

### Implementation

- [ ] T011 [US2] Update `src/components/auth/ReAuthModal/ReAuthModal.tsx` unlock-mode description block (lines 237-248 originally) to match wireframe 02: replace existing "Your session has been restored..." copy with wireframe-02-conformant text including "this password is separate from your Google/GitHub login" subtext (provider name from `getOAuthProvider(user)`); render provider badge above password field; preserve email-user copy unchanged when `isOAuthUser(user)` is false.

### Story checkpoint

- [ ] T012 [US2] Verify US-2 acceptance scenarios from spec.md lines 62-63 pass. Re-run T009 + T010 inside Docker.

## Phase 5 — User Story 3: Email/Password User Flow Unchanged (P3)

**Goal**: Regression-only. Email users see the same modal copy and behavior as before this feature.

**Independent test**: Sign in with email/password test user (`test@example.com` / `TestPassword123!`) → navigate to `/messages` (with keys, IndexedDB cleared) → modal opens with the original "Enter Your Messaging Password" title, "Password" label (not "Messaging Password"), no provider badge, no OAuth-specific subtext. Submit correct password → modal closes.

### Tests

- [ ] T013 [P] [US3] Add regression Playwright scenario to `tests/e2e/messaging/oauth-setup-modal.spec.ts`: email user → unlock modal → assert title text byte-equals "Enter Your Messaging Password" (unchanged from before this feature) AND no provider badge present AND label text equals "Password". Spec MUST stay green throughout US-1 + US-2 implementation as well.
- [ ] T014 [P] [US3] Add regression unit test in `ReAuthModal.test.tsx`: when `isOAuthUser(user)` returns false, none of the OAuth-specific elements (provider badge, "via Google" / "via GitHub" text, OAuth-aware subtext) render.

### Implementation

No code changes for US-3 — it's regression-only. The conditional rendering shipped in T006 + T011 (gated on `isOAuthUser(user)`) preserves email-user behavior by construction.

### Story checkpoint

- [ ] T015 [US3] Verify US-3 acceptance scenario from spec.md line 77 passes via T013 + T014 inside Docker.

## Phase 6 — Polish & cross-cutting

- [ ] T016 [P] Extend `src/components/auth/ReAuthModal/ReAuthModal.stories.tsx` from 1 → 5 stories: `EmailUnlock` (default), `OAuthGoogleSetup`, `OAuthGoogleUnlock`, `OAuthGitHubSetup`, `OAuthGitHubUnlock`. Each story sets up a mock user via the existing `decorators` pattern.
- [ ] T017 [P] Run `docker compose exec scripthammer pnpm test:a11y` — Pa11y AAA must remain green across all 4 audited URLs (no contrast regression on the new modal copy or provider badge).
- [ ] T018 Manual smoke-test against local Supabase profile (`docker compose --profile supabase up`): walk all 5 user-flow combinations (US-1, US-2 Google + GitHub, US-3 email, deep-link to `/messages/setup`). Capture screenshots into `features/auth-oauth/013-oauth-messaging-password/wireframes/screenshots/` per Constitution III tail step (`/speckit.wireframe.screenshots`).
- [ ] T019 Run `docker compose exec scripthammer python3 .specify/extensions/wireframe/scripts/validate.py features/auth-oauth/013-oauth-messaging-password/wireframes/01-oauth-password-setup.svg` and the 02 SVG. Both must still PASS — feature 013's wireframes are unchanged but a fresh validation closes the post-implement loop.

## Dependencies & user-story completion order

```
T001 ────┐
         ▼
        T002 [US1 prep] ────┐
                            ▼
T003 + T004 + T005 [US1 RED] ──┐
                               ▼
                              T006 [US1 GREEN: ReAuthModal extension] ──┐
                                                                        ▼
                                                                       T007 [US1 GREEN: gate flip]
                                                                        │
                                                                        ▼
                                                                       T008 [US1 done]
                                                                        │
                                                                        ▼
                                              T009 + T010 [US2 RED] ──┐
                                                                       ▼
                                                                     T011 [US2 GREEN]
                                                                       │
                                                                       ▼
                                                                     T012 [US2 done]
                                                                       │
                                                                       ▼
                                              T013 + T014 [US3 regression] ──┐
                                                                              ▼
                                                                            T015 [US3 done]
                                                                              │
                                                                              ▼
                                                              T016 + T017 [Polish, parallel]
                                                                              │
                                                                              ▼
                                                                            T018 + T019 [Verify]
```

## Parallel execution examples

- T003, T004, T005 — three test files, no overlap, can be authored concurrently before T006/T007 begin.
- T009, T010 — same pattern at US-2 level.
- T013, T014 — US-3 regression tests in parallel.
- T016, T017 — Storybook stories and Pa11y run are independent.

## Implementation strategy (MVP-first)

**MVP**: T001 → T002 → T003-T005 (RED) → T006 → T007 → T008. Ships modal-setup mode + EncryptionKeyGate redirect-flip. At this point US-1 is done and shippable independently — OAuth users no longer see the redirect; they see the modal.

**Incremental**: US-2 (T009-T012) is a copy/badge polish layered on top of the same modal surface. Ships independently as a follow-up commit.

**Regression-only**: US-3 (T013-T015) adds tests that should ALREADY pass after T006/T011 land, because email-user code paths weren't touched. The tests pin that invariant.

**Polish**: T016-T019 round out the PR before merge. Wireframe screenshots (T018) close the v1.0.2 cascade tail.

## Format validation

All tasks above follow `- [ ] T### [P?] [US#?] description with file path`. ✅
