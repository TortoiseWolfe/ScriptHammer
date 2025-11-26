# Implementation Plan: Fix Profile Update Silent Failure

**Branch**: `035-fix-profile-update` | **Date**: 2025-11-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/035-fix-profile-update/spec.md`

## Summary

Fix the profile update silent failure where clicking "Update Profile" has no effect. Root cause: Supabase `.update()` returns `error: null` even when 0 rows are updated (row doesn't exist or RLS blocks). Solution: Use `.upsert()` with `onConflict: 'id'` and validate returned data exists. Also fix username case mismatch.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 15
**Primary Dependencies**: @supabase/supabase-js, React hooks
**Storage**: PostgreSQL via Supabase (user_profiles table)
**Testing**: Vitest for unit tests, Playwright for E2E
**Target Platform**: Web (PWA, static export)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Profile update completes in < 500ms
**Constraints**: Must work offline (queue updates), GDPR compliant
**Scale/Scope**: Single component fix (AccountSettings.tsx)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                    | Status  | Notes                                               |
| ---------------------------- | ------- | --------------------------------------------------- |
| I. Component Structure       | ✅ PASS | AccountSettings already follows 5-file pattern      |
| II. Test-First Development   | ✅ PASS | Will update existing tests for new upsert behavior  |
| III. PRP Methodology         | ✅ PASS | Using /specify → /plan → /tasks → /implement        |
| IV. Docker-First Development | ✅ PASS | All development in Docker                           |
| V. Progressive Enhancement   | ✅ PASS | Bug fix improves existing functionality             |
| VI. Privacy & Compliance     | ✅ PASS | No new data collection, fixes user data persistence |

**Gate Result**: PASS - No violations, proceed with implementation.

## Project Structure

### Documentation (this feature)

```
specs/035-fix-profile-update/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (affected files)

```
src/
├── components/auth/AccountSettings/
│   ├── AccountSettings.tsx          # Main fix: .update() → .upsert()
│   ├── AccountSettings.test.tsx     # Update mocks for upsert
│   └── AccountSettings.accessibility.test.tsx  # Update mocks
├── hooks/
│   └── useUserProfile.ts            # No changes needed
└── lib/profile/
    └── validation.ts                # Keep .toLowerCase() in availability check
```

**Structure Decision**: Minimal change - fix is isolated to AccountSettings.tsx profile update handler. No new files needed.

## Complexity Tracking

_No violations - no complexity justification needed._
