# Implementation Plan: Admin Welcome Message & Email Verification

**Branch**: `002-feature-002-admin` | **Date**: 2025-11-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-feature-002-admin/spec.md`

## Summary

Three-part feature implementing:

1. **Admin User Setup** - 4th admin user "ScriptHammer" with env-configured credentials
2. **Email Verification Gate** - MessagingGate component blocks /messages for unverified users
3. **Welcome Message System** - Encrypted welcome message sent on first key initialization

Technical approach: Client-side welcome message service using existing Argon2id + ECDH P-256 + AES-GCM encryption stack. Admin keys derived lazily on first send attempt with self-healing capability.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 15, React 19
**Primary Dependencies**: Supabase Auth, @noble/hashes (Argon2id), hash-wasm, Web Crypto API
**Storage**: Supabase PostgreSQL (`user_profiles`, `user_encryption_keys`, `messages`)
**Testing**: Vitest (unit), Playwright (E2E), Pa11y (accessibility)
**Target Platform**: Web (PWA)
**Project Type**: Web application
**Constraints**: Client-side encryption (no server-side key storage), 44px touch targets

## Constitution Check

_GATE: All gates pass_

| Principle                      | Status | Notes                                |
| ------------------------------ | ------ | ------------------------------------ |
| I. Component Structure         | ✅     | MessagingGate follows 5-file pattern |
| II. Test-First Development     | ✅     | TDD workflow in tasks                |
| III. PRP Methodology           | ✅     | Using SpecKit workflow               |
| IV. Docker-First Development   | ✅     | All commands via Docker              |
| V. Progressive Enhancement     | ✅     | Gate shows fallback UI               |
| VI. Privacy & Compliance First | ✅     | E2E encryption, no key storage       |

## Project Structure

### Documentation (this feature)

```
specs/002-feature-002-admin/
├── spec.md              # Feature specification (Clarified)
├── plan.md              # This file
├── research.md          # Phase 0 codebase research
├── data-model.md        # Database schema changes
├── quickstart.md        # Developer quickstart
├── contracts/           # TypeScript interfaces
│   ├── welcome-service.ts
│   └── messaging-gate.ts
└── tasks.md             # Phase 2 output (/tasks command)
```

### Source Code Changes

```
src/
├── components/
│   └── auth/
│       └── MessagingGate/           # NEW: 5-file component
│           ├── index.tsx
│           ├── MessagingGate.tsx
│           ├── MessagingGate.test.tsx
│           ├── MessagingGate.stories.tsx
│           └── MessagingGate.accessibility.test.tsx
├── services/
│   └── messaging/
│       └── welcome-service.ts       # NEW: Welcome message service
└── app/
    └── messages/
        └── page.tsx                 # MODIFY: Wrap with MessagingGate

supabase/migrations/
└── 20251006_complete_monolithic_setup.sql  # MODIFY: Add column + admin profile

.env                                 # MODIFY: Add admin credentials
tests/fixtures/test-user.ts          # MODIFY: Add admin constants
```

**Structure Decision**: Web application with frontend services (no separate backend).

## Implementation Parts

### Part 1: Admin User Setup

**Files to modify:**

- `.env` - Add admin credentials
- `.env.example` - Add admin variable templates
- `tests/fixtures/test-user.ts` - Add admin constants
- `supabase/migrations/20251006_complete_monolithic_setup.sql` - Add admin profile

**Environment Variables:**

```bash
TEST_USER_ADMIN_EMAIL=admin@scripthammer.com
TEST_USER_ADMIN_PASSWORD=<64-char-secure-password>
NEXT_PUBLIC_ADMIN_USER_ID=00000000-0000-0000-0000-000000000001
```

**Database Changes:**

```sql
-- Admin profile (in user_profiles section)
INSERT INTO user_profiles (id, username, display_name, welcome_message_sent)
VALUES ('00000000-0000-0000-0000-000000000001', 'scripthammer', 'ScriptHammer', TRUE)
ON CONFLICT (id) DO NOTHING;
```

### Part 2: Email Verification Enforcement

**New Component:** `src/components/auth/MessagingGate/`

**Behavior:**

1. Check `user.email_confirmed_at` from Supabase auth
2. If NULL and not OAuth → Show verification required UI
3. If verified or OAuth → Render children

**Integration:**

```typescript
// src/app/messages/page.tsx
export default function MessagesPage() {
  return (
    <MessagingGate>
      <Suspense fallback={...}>
        <MessagesContent />
      </Suspense>
    </MessagingGate>
  );
}
```

**Blocked State UI:**

- Lock icon (SVG)
- "Email Verification Required" heading
- Explanation text about security
- Resend verification button
- User's email displayed

### Part 3: Welcome Message System

**New Service:** `src/services/messaging/welcome-service.ts`

**Flow:**

1. Check `welcome_message_sent = FALSE`
2. Derive admin keys from env password (lazy, FR-011)
3. Verify/self-heal if corrupted (FR-012)
4. Get/create conversation (admin ↔ user)
5. Encrypt message with user's public key
6. Insert message
7. Set `welcome_message_sent = TRUE`

**Trigger Point:** `src/components/auth/SignInForm/SignInForm.tsx`

```typescript
if (!hasKeys) {
  const keyPair = await keyManagementService.initializeKeys(password);
  // Send welcome message (non-blocking)
  import('@/services/messaging/welcome-service').then(({ welcomeService }) => {
    welcomeService
      .sendWelcomeMessage(user.id, keyPair.publicKeyJwk)
      .catch((err) => logger.error('Welcome message failed', { error: err }));
  });
}
```

**Message Content:**

```
Welcome to ScriptHammer!

Your messages are protected by end-to-end encryption...
[See contracts/welcome-service.ts for full content]
```

## RLS Policy Updates

```sql
-- Allow admin to bypass connection requirement for conversations
CREATE POLICY "admin_create_any_conversation"
ON conversations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = '00000000-0000-0000-0000-000000000001'::uuid
);
```

## Testing Strategy

### Unit Tests

- MessagingGate: renders blocked state for unverified
- MessagingGate: renders children for verified
- MessagingGate: renders children for OAuth users
- WelcomeService: derives admin keys correctly
- WelcomeService: skips if already sent
- WelcomeService: self-heals corrupted keys

### Integration Tests

- SignInForm triggers welcome message on new user
- Welcome message appears in conversation list
- No duplicate messages on re-login

### E2E Tests

- Unverified user blocked from /messages
- Resend verification button works
- OAuth user bypasses gate
- New user sees welcome message

## Complexity Tracking

_No violations - implementation follows existing patterns_

## Progress Tracking

| Phase                   | Status      | Artifacts                                |
| ----------------------- | ----------- | ---------------------------------------- |
| Phase 0: Research       | ✅ Complete | research.md                              |
| Phase 1: Design         | ✅ Complete | data-model.md, contracts/, quickstart.md |
| Phase 2: Tasks          | ✅ Complete | tasks.md                                 |
| Phase 3: Analysis       | ✅ Complete | checklists/security.md                   |
| Phase 4: Implementation | ✅ Complete | All 27 tasks completed                   |

## Implementation Summary

**Completed**: 2025-11-28

### Files Created

- `src/services/messaging/welcome-service.ts` - Welcome message service with lazy key derivation
- `src/components/auth/MessagingGate/` - Email verification gate component (5-file pattern)
- `tests/contract/auth/admin-user.contract.test.ts` - Admin user contract tests

### Files Modified

- `src/components/auth/SignInForm/SignInForm.tsx` - Welcome message trigger on new user
- `src/lib/supabase/types.ts` - Added `welcome_message_sent` column type
- `src/app/messages/page.tsx` - Wrapped with MessagingGate
- `.env` / `.env.example` - Admin credentials
- `tests/fixtures/test-user.ts` - Admin constants
- `supabase/migrations/20251006_complete_monolithic_setup.sql` - Admin profile, RLS policy

### Database Migrations Executed

- Added `welcome_message_sent` column to `user_profiles`
- Created index `idx_user_profiles_welcome_pending`
- Created admin user in `auth.users`
- Created admin profile with username 'scripthammer'
- Added `admin_create_any_conversation` RLS policy

### Test Results

- MessagingGate: 13 tests passed
- WelcomeService: 9 tests passed
- Admin User Contract: 17 tests passed
- Type check: ✅ Pass
- ESLint: ✅ Pass
