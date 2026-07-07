# Implementation Plan: OAuth Messaging Password

**Branch**: `001-oauth-messaging-password` | **Date**: 2025-11-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-oauth-messaging-password/spec.md`

## Summary

**FINDING: Feature is ALREADY IMPLEMENTED**

The ReAuthModal component already has full OAuth messaging password support:

- Detects OAuth users via `isOAuthUser()` from `@/lib/auth/oauth-utils`
- Checks for existing encryption keys via `keyManagementService.hasKeys()`
- Shows "Set Up Encrypted Messaging" with confirm password field for OAuth users without keys
- Shows "Unlock Messaging" for users with existing keys
- Clear UX copy explaining messaging password is separate from Google/GitHub credentials

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 15, React 19
**Primary Dependencies**: Supabase Auth, @noble/hashes (Argon2id), @noble/curves (P-256)
**Storage**: Supabase `user_encryption_keys` table
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Web (PWA)
**Project Type**: Web application

## Constitution Check

_GATE: All gates pass - existing implementation follows constitution_

| Principle                      | Status                                |
| ------------------------------ | ------------------------------------- |
| I. Component Structure         | ✅ ReAuthModal follows 5-file pattern |
| II. Test-First Development     | ✅ Existing tests present             |
| III. PRP Methodology           | ✅ Using SpecKit workflow             |
| IV. Docker-First Development   | ✅ N/A (no new infrastructure)        |
| V. Progressive Enhancement     | ✅ Works without JS (form fallback)   |
| VI. Privacy & Compliance First | ✅ E2E encryption maintained          |

## Existing Implementation

### Files Already Implementing This Feature

| File                                              | Purpose                                          |
| ------------------------------------------------- | ------------------------------------------------ |
| `src/components/auth/ReAuthModal/ReAuthModal.tsx` | Main modal with OAuth detection and setup mode   |
| `src/lib/auth/oauth-utils.ts`                     | `isOAuthUser()` and `getOAuthProvider()` helpers |
| `src/services/messaging/key-service.ts`           | `hasKeys()` and `initializeKeys()` methods       |

### Current Behavior (Already Working)

1. **OAuth user without keys** → ReAuthModal shows:
   - Title: "Set Up Encrypted Messaging"
   - Copy: "Your messages are end-to-end encrypted. Since you signed in with {provider}, we need a separate password..."
   - Fields: Password + Confirm Password
   - Button: "Set Up Messaging"

2. **OAuth user with keys** → ReAuthModal shows:
   - Title: "Unlock Messaging"
   - Copy: "Please enter your messaging password..."
   - Fields: Password only
   - Button: "Unlock"

3. **Email user** → Standard flow (unchanged)

## Recommendation

**No code changes required.** The feature specification describes functionality that already exists in the codebase.

### Possible Enhancements (Optional)

If the user is experiencing issues, it may be:

1. **Bug**: The modal isn't being triggered for OAuth users
2. **UX Polish**: Copy could be more prominent about "messaging password"
3. **Testing Gap**: Need to verify E2E tests cover OAuth flow

### Next Steps

1. **Verify**: Test the existing OAuth flow manually
2. **Debug**: If not working, investigate why modal isn't appearing
3. **Close**: If working as expected, close this feature branch

## Project Structure

### Documentation (this feature)

```
specs/001-oauth-messaging-password/
├── plan.md              # This file
├── spec.md              # Feature specification
└── (no tasks.md needed - feature already implemented)
```

### Source Code (already exists)

```
src/
├── components/auth/ReAuthModal/
│   ├── index.tsx
│   ├── ReAuthModal.tsx          # Already has OAuth support
│   ├── ReAuthModal.test.tsx
│   ├── ReAuthModal.stories.tsx
│   └── ReAuthModal.accessibility.test.tsx
├── lib/auth/
│   └── oauth-utils.ts           # isOAuthUser(), getOAuthProvider()
└── services/messaging/
    └── key-service.ts           # hasKeys(), initializeKeys()
```
