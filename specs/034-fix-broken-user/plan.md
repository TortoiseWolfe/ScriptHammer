# Implementation Plan: Fix User Profile System

**Branch**: `034-fix-broken-user` | **Date**: 2025-11-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/034-fix-broken-user/spec.md`

## Summary

Fix broken user profile system where profile changes don't persist because AccountSettings writes to `auth.users.user_metadata` instead of the `user_profiles` table that search queries use. Solution: Update AccountSettings to write directly to `user_profiles`, add Display Name field to UI, and fix misleading search labels.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 15
**Primary Dependencies**: Supabase Client SDK, React Hooks, DaisyUI
**Storage**: PostgreSQL via Supabase (user_profiles table)
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Web (PWA, static export)
**Project Type**: Web application (Next.js)
**Performance Goals**: Profile save < 500ms, search results < 1s
**Constraints**: Must not break existing avatar/bio functionality
**Scale/Scope**: Single component update + validation hook

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                    | Status  | Notes                                                 |
| ---------------------------- | ------- | ----------------------------------------------------- |
| I. Component Structure       | ✅ PASS | AccountSettings already follows 5-file pattern        |
| II. Test-First Development   | ✅ PASS | Will add tests for profile save to user_profiles      |
| III. PRP Methodology         | ✅ PASS | Using /specify → /plan → /tasks → /implement workflow |
| IV. Docker-First Development | ✅ PASS | All development in Docker containers                  |
| V. Progressive Enhancement   | ✅ PASS | Core save functionality works without JS enhancements |
| VI. Privacy & Compliance     | ✅ PASS | user_profiles already has RLS policies                |

## Project Structure

### Documentation (this feature)

```
specs/034-fix-broken-user/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output (API contracts)
```

### Source Code (repository root)

```
src/
├── components/
│   └── auth/
│       └── AccountSettings/
│           └── AccountSettings.tsx    # MODIFY: Update save to user_profiles
├── hooks/
│   └── useUserProfile.ts              # NEW: Hook to load/manage profile
├── lib/
│   └── profile/
│       └── validation.ts              # NEW: Username validation
└── components/
    └── molecular/
        └── UserSearch/
            └── UserSearch.tsx         # MODIFY: Fix UI labels
```

**Structure Decision**: This is a bug fix that modifies existing components. New files are a hook and validation utility - no new components needed.

## Complexity Tracking

_No constitution violations - simple bug fix with minimal new code._

## Phase 0: Research Summary

### Current State Analysis

1. **AccountSettings.tsx** (line 49-51): Saves to wrong location

   ```typescript
   // CURRENT (broken):
   await supabase.auth.updateUser({ data: { username, bio } });
   // SHOULD BE:
   await supabase
     .from('user_profiles')
     .update({ username, display_name, bio })
     .eq('id', user.id);
   ```

2. **user_profiles table**: Already has correct schema (username, display_name, bio, avatar_url)

3. **RLS policies**: Already allow users to update their own profile

4. **connection-service.ts searchUsers**: Already updated to use ilike for partial matching on username and display_name

### Technical Approach

1. Create `useUserProfile` hook to fetch profile data from `user_profiles` table
2. Update AccountSettings to:
   - Load initial values from `useUserProfile` hook
   - Add display_name field to form
   - Save all fields to `user_profiles` table
3. Add username validation (3-30 chars, alphanumeric + underscore, uniqueness check)
4. Update UserSearch labels to say "username or name"

## Phase 1: Design

### Data Model

See [data-model.md](./data-model.md) for detailed schema.

**Key change**: No schema changes needed. `user_profiles` already has:

- `username` (TEXT, UNIQUE, 3-30 chars)
- `display_name` (TEXT, max 100 chars)
- `bio` (TEXT, max 500 chars)
- `avatar_url` (TEXT)

### API Contracts

See [contracts/](./contracts/) directory.

**Endpoints affected**:

- `user_profiles` table UPDATE (via Supabase client)
- `user_profiles` table SELECT (via useUserProfile hook)

### Component Changes

1. **AccountSettings.tsx**:
   - Add `displayName` state
   - Add `useUserProfile()` hook call for initial values
   - Add display_name input field
   - Change save handler to update user_profiles table

2. **UserSearch.tsx**:
   - Change label: "Search for users by username or name"
   - Change placeholder: "Enter username or name"
   - Change error: "No users found matching your search"

### New Files

1. **src/hooks/useUserProfile.ts**: Hook to load current user's profile
2. **src/lib/profile/validation.ts**: Username validation functions

## Progress Tracking

| Phase             | Status      | Output                                   |
| ----------------- | ----------- | ---------------------------------------- |
| Phase 0: Research | ✅ COMPLETE | research.md                              |
| Phase 1: Design   | ✅ COMPLETE | data-model.md, contracts/, quickstart.md |
| Phase 2: Tasks    | ⏳ PENDING  | Run /tasks command                       |

## Next Steps

Run `/tasks` to generate the implementation task list.
