# Implementation Plan: OAuth Messaging Password

**Branch**: `013-oauth-messaging-password` | **Date**: 2026-05-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification at `features/auth-oauth/013-oauth-messaging-password/spec.md`

**Note**: First feature to walk the v1.0.2 cascade as a hard gate. Wireframe
review (PASS 2026-05-06) cleared before this file was authored.

## Summary

OAuth users (Google/GitHub) lack an auth password to derive ECDH messaging
keys from. Today they're redirected to a full-page setup form at
`/messages/setup`. Per the 2026-05-06 clarifications, this feature adds
**setup mode to ReAuthModal** (the same modal that already handles unlock
mode for returning users), keeping the page as a deep-link fallback. US-2
(unlock copy + provider badge) is rebuilt per wireframe 02. US-3 (email
user flow) is regression-protected only.

The technical approach is purely additive: extend `ReAuthModal` in place
(5-file pattern), branch the submit handler between `initializeKeys` (setup)
and `deriveKeys` (unlock) — both already shipped service methods — and flip
the redirect in `EncryptionKeyGate` to render the modal in setup mode
instead of redirecting OAuth users to `/messages/setup`. The setup-page
redirect is preserved for deep-link entry.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19, Next.js 15.5 (App Router, static export)
**Primary Dependencies**: `@supabase/supabase-js`, `react-hook-form` (existing), `argon2-browser` (via key-derivation), DaisyUI 32 themes
**Storage**:

- Supabase `user_encryption_keys` table — salt + public key (no schema change for this feature)
- IndexedDB `messaging_private_keys` table — non-extractable CryptoKey, keyed by userId
- Messaging password: NOT persisted anywhere (per FR-018)

**Testing**: Vitest (unit), React Testing Library (component), Playwright (E2E), jest-axe + Pa11y (a11y, AAA per Phase 0 closure)
**Target Platform**: GitHub Pages static export; modern browsers (Chromium, Firefox, WebKit)
**Project Type**: web (existing single Next.js app)
**Performance Goals**: Modal mount < 100ms; key derivation < 2s on mid-tier mobile (Argon2id memHard cost — already measured, no new perf budget)
**Constraints**:

- Static export — no server API routes
- WCAG AAA contrast (per Phase 0 closure)
- 44px minimum touch targets
- Modal must fit at 360×720 mobile breakpoint with two password fields + confirm + provider badge
  **Scale/Scope**: ~1 modified component (ReAuthModal), 1 modified gate (EncryptionKeyGate), 1 new helper (welcome-message dispatch extracted from setup page), 0 new database columns, 5 wireframe-conformant Storybook stories

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                        | Compliance | Notes                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Component Structure Compliance                | ✅         | Extends `src/components/auth/ReAuthModal/` 5-file pattern in place. No new directories. Storybook stories grow from 1 → 5.                                                                                                                                 |
| II. Test-First Development                       | ✅         | RED tests authored first per `tasks.md` ordering: setup-mode renders confirm field, mismatch validation, submit branches, provider badge conditional. New E2E spec at `tests/e2e/messaging/oauth-setup-modal.spec.ts` precedes the EncryptionKeyGate edit. |
| III. PRP Methodology w/ Mandatory Wireframe Gate | ✅         | Wireframes 01 + 02 PASSED 2026-05-06 (validate.py v5.4, 0 errors). `## UI Mockup` section in spec.md links both. This file is the cascade's `/speckit.plan` step.                                                                                          |
| IV. Docker-First Development                     | ✅         | All commands run via `docker compose exec scripthammer ...`. Tests run inside the container. No host pnpm.                                                                                                                                                 |
| V. Progressive Enhancement                       | ✅         | Modal uses progressive disclosure (setup mode shows confirm field only when needed). 44px touch targets preserved. Mobile breakpoint validated against wireframe 01. No JS-required-for-core-flow changes; modal is already client-only.                   |
| VI. Privacy & Compliance First                   | ✅         | Messaging password NEVER persisted (FR-018). Recovery flow explicitly out of scope (FR-019). No new analytics/tracking events. Provider badge surfaces existing `getOAuthProvider(user)` data.                                                             |

**No violations to justify.** No `Complexity Tracking` section needed.

## Project Structure

### Documentation (this feature)

```
features/auth-oauth/013-oauth-messaging-password/
├── 013_oauth-messaging-password_feature.md   # Original PRP (preserved)
├── spec.md                                   # Spec — clarifications + FRs encoded 2026-05-06
├── plan.md                                   # This file
├── tasks.md                                  # /speckit.tasks output (NEXT)
├── REVIEW_NOTES.md                           # Pre-spec audit
├── checklists/
│   └── requirements.md                       # Spec quality checklist (PASSED 2025-12-30)
└── wireframes/
    ├── 01-oauth-password-setup.svg           # Setup mode (PASSED 2026-05-06)
    ├── 02-oauth-password-unlock.svg          # Unlock mode (PASSED 2026-05-06)
    ├── 01-oauth-password-setup.issues.md     # PASS history
    ├── 02-oauth-password-unlock.issues.md    # PASS history
    ├── assignments.json                      # Wireframe focus directives
    └── includes/                             # Shared chrome (header/footer)
```

### Source code (repository root)

```
src/
├── components/
│   └── auth/
│       ├── ReAuthModal/                      # EXTEND (5-file pattern preserved)
│       │   ├── index.tsx                     # No change
│       │   ├── ReAuthModal.tsx               # Add setup mode + provider badge + per-spec unlock copy
│       │   ├── ReAuthModal.test.tsx          # Add setup-mode tests, badge tests, mismatch validation
│       │   ├── ReAuthModal.stories.tsx       # Grow 1 → 5 stories (email-unlock, OAuth-Google setup/unlock, OAuth-GitHub setup/unlock)
│       │   └── ReAuthModal.accessibility.test.tsx  # Verify a11y on both modes
│       └── EncryptionKeyGate/
│           └── EncryptionKeyGate.tsx         # MODIFY line 78: stop redirecting OAuth users; trigger modal in setup mode instead
├── app/
│   └── messages/
│       └── setup/
│           └── page.tsx                      # NO CHANGE (preserved as fallback per FR-022)
├── lib/
│   ├── auth/
│   │   └── oauth-utils.ts                    # NO CHANGE — isOAuthUser + getOAuthProvider reused as-is
│   └── messaging/
│       ├── key-derivation.ts                 # NO CHANGE — KeyDerivationService as-is (post-batch-8 non-extractable)
│       └── welcome/
│           └── send-welcome-message.ts       # NEW — extracted from setup/page.tsx:133–149 so modal-setup AND page-setup both fire greeting
└── services/
    └── messaging/
        ├── key-service.ts                    # NO CHANGE — initializeKeys (line 74) + deriveKeys (line 172) cover both modes
        └── welcome-service.ts                # NO CHANGE — invoked by the new helper

tests/
└── e2e/
    └── messaging/
        ├── encrypted-messaging.spec.ts       # NO CHANGE — regression coverage
        └── oauth-setup-modal.spec.ts         # NEW — modal-setup happy path + unlock path + email-user regression
```

**Structure Decision**: Single Next.js app. ReAuthModal extension lives in
the existing `src/components/auth/` tree. EncryptionKeyGate is the only
non-component change. The new `send-welcome-message.ts` helper extracts
the welcome-message dispatch from `app/messages/setup/page.tsx:133–149` so
it can be invoked from both the page (existing call site) and the modal
(new call site) — cleaner than duplicating the dispatch logic.

## Phase 0 — Research (no research.md needed)

All technical questions resolved during exploration (see prior conversation):

- Modal triggers: `EncryptionKeyGate.tsx:92` calls `setNeedsReAuth(true)` when keys exist in DB but not in IndexedDB cache. The new condition: also trigger when `isOAuthUser(user) && !hasKeysForUser(user.id)`, with mode === 'setup' instead of 'unlock'.
- Service surface: `KeyManagementService.initializeKeys(password)` (line 74) handles setup; `KeyManagementService.deriveKeys(password)` (line 172) handles unlock. Both already exist.
- Welcome message: `app/messages/setup/page.tsx:133–149` invokes `welcomeService.sendWelcomeMessage(user.id, keyPair.privateKey, keyPair.publicKeyJwk)`. Extract to a helper for reuse.
- Credential Management API: `navigator.credentials.store(new PasswordCredential(...))` works in both page and modal contexts. Verify in browser during implementation per watch-out 2 in `~/.claude/plans/continue-the-scripthammer-ticklish-deer.md`.
- Provider badge: simple text token "via Google" / "via GitHub" — no new icon system. Conditional on `isOAuthUser(user)`, source from `getOAuthProvider(user)`.

No `research.md` artifact needed.

## Phase 1 — Design

### Data model

**No schema changes.** All required tables and columns exist:

- `user_encryption_keys` (Supabase) — `salt`, `public_key` columns. No new fields.
- `messaging_private_keys` (IndexedDB) — `userId`, `privateKey` (non-extractable CryptoKey), `created_at`. No new fields.

The messaging password is consumed at runtime by `KeyDerivationService` and discarded; nothing to model.

No `data-model.md` artifact needed.

### Contracts

**No new API contracts.** The feature is pure-frontend:

- `keyManagementService.initializeKeys(password: string) => Promise<DerivedKeyPair>` — already exists at `src/services/messaging/key-service.ts:74`
- `keyManagementService.deriveKeys(password: string) => Promise<DerivedKeyPair>` — already exists at line 172
- `keyManagementService.hasKeysForUser(userId: string) => Promise<boolean>` — already exists at line 432
- `isOAuthUser(user: User | null) => boolean` — already exists at `src/lib/auth/oauth-utils.ts:71`
- `getOAuthProvider(user: User | null) => string | null` — already exists at line 93

The new helper signature:

```ts
// src/lib/messaging/welcome/send-welcome-message.ts
export async function sendWelcomeMessageOnSetup(
  user: User,
  keyPair: DerivedKeyPair,
  logger: Logger
): Promise<void>;
```

No `contracts/` directory needed.

### Quickstart (for human + LLM verification)

```bash
# 1. Verify wireframes still pass after spec amendments
docker compose exec scripthammer python3 .specify/extensions/wireframe/scripts/validate.py \
  features/auth-oauth/013-oauth-messaging-password/wireframes/01-oauth-password-setup.svg
docker compose exec scripthammer python3 .specify/extensions/wireframe/scripts/validate.py \
  features/auth-oauth/013-oauth-messaging-password/wireframes/02-oauth-password-unlock.svg
# Expected: PASS for both

# 2. Run full unit + a11y suite (must stay green)
docker compose exec scripthammer pnpm test
docker compose exec scripthammer pnpm test:a11y

# 3. After implementation, verify the new E2E spec
docker compose exec scripthammer pnpm exec playwright test tests/e2e/messaging/oauth-setup-modal.spec.ts

# 4. Smoke-test in browser via local Supabase profile (per memory rule)
docker compose --profile supabase up
# Then in browser:
#   - Sign in with email/password test user → /messages → unlock modal shows "Password" label (US-3 unchanged)
#   - Sign in with Google OAuth, no prior keys → /messages → modal opens in setup mode (US-1)
#   - Sign in with GitHub OAuth, prior keys, IndexedDB cleared → /messages → modal opens in unlock mode with "via GitHub" badge (US-2)
```

### Update agent context

```bash
.specify/scripts/bash/update-agent-context.sh claude
# Expected: stderr "[update-agent-context] No-op for ScriptHammer..."
# (CLAUDE.md is hand-curated; this is intentional)
```

## Phase 2 — `/speckit.tasks` (next)

`tasks.md` will sequence work to satisfy user stories independently:

1. **US-1 first** (modal setup mode + EncryptionKeyGate branch). Largest scope, earliest value.
2. **US-2 second** (unlock copy + provider badge). Depends on US-1 because both share the modal surface.
3. **US-3 last** (regression test). One Playwright spec asserting email-user copy is byte-identical.

Each user story gets its own commit so the PR history reflects the cascade.

## Constitution re-check (post-Phase 1)

All gates still ✅. No violations introduced by the design above.

The design is intentionally conservative: extend in place, reuse existing
service methods, no new schema, no new contracts, no new dependencies.
This matches the user's preference for cleaner long-term solutions over
quick short-term hacks (memory rule reinforced 2026-05-04) — the modal-
setup mode and the page-setup form share one welcome-message helper rather
than each duplicating the dispatch logic.
