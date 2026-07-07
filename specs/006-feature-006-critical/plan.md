# Implementation Plan: Critical Messaging UX Fixes

**Branch**: `006-feature-006-critical` | **Date**: 2025-11-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-feature-006-critical/spec.md`

## Summary

Fix 5 critical UX bugs blocking messaging functionality:

1. **Scroll broken** - Message input clipped at bottom due to CSS height chain issues
2. **OAuth password flow** - Users asked to ENTER password they never CREATED (hasKeys() bug)
3. **Password manager** - Form not triggering save prompts (missing autocomplete attributes)
4. **Decryption errors** - Raw error text instead of user-friendly explanation with lock icon
5. **Participant name** - Shows "Unknown" instead of resolving username from user_profiles

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 15
**Primary Dependencies**: Tailwind CSS 4, DaisyUI, Supabase
**Storage**: Supabase PostgreSQL (user_encryption_keys, user_profiles, conversations)
**Testing**: Vitest (unit), Playwright (E2E), Pa11y (a11y)
**Target Platform**: Web (320px-1920px, portrait + landscape)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Lighthouse 90+, FCP < 2s
**Constraints**: Mobile keyboard safe areas, password manager compatibility
**Scale/Scope**: Bug fixes only - no new features or data model changes

## Constitution Check

_GATE: ScriptHammer Constitution v1.0.1 - 6 Core Principles_

| Principle                  | Status  | Notes                                                   |
| -------------------------- | ------- | ------------------------------------------------------- |
| I. Component Structure     | ✅ Pass | MessageBubble follows 5-file pattern; no new components |
| II. Test-First Development | ✅ Pass | E2E tests for viewport validation                       |
| III. PRP Methodology       | ✅ Pass | Following /specify → /plan → /tasks workflow            |
| IV. Docker-First           | ✅ Pass | All development in Docker                               |
| V. Progressive Enhancement | ✅ Pass | Adding safe-area support for mobile                     |
| VI. Privacy & Compliance   | ✅ Pass | No data model changes                                   |

## Project Structure

### Documentation (this feature)

```
specs/006-feature-006-critical/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research (inline below)
└── tasks.md             # Phase 2 task breakdown
```

### Source Code (files to modify)

```
src/
├── app/messages/
│   ├── page.tsx                          # US1: Scroll fix, US5: Participant name
│   └── setup/page.tsx                    # US2,US3: Full-page setup form
├── components/
│   ├── atomic/
│   │   └── MessageBubble/MessageBubble.tsx  # US4: Decryption error display
│   ├── molecular/
│   │   └── MessageThread/MessageThread.tsx  # US1: Scroll container
│   └── organisms/
│       └── ChatWindow/ChatWindow.tsx        # US1: Grid layout fix
│   └── auth/
│       └── ReAuthModal/ReAuthModal.tsx      # US2,US3: Modal for unlocks only
├── services/messaging/
│   ├── key-service.ts                       # US2: hasKeys() bug fix
│   └── message-service.ts                   # US4: Error text constant
└── types/
    └── messaging.ts                         # US4: Add decryptionError flag

tests/e2e/messaging/
└── messaging-ux.spec.ts                     # E2E tests for all viewports
```

**Structure Decision**: Bug fix feature - modifying existing files only, no new components needed.

## Research Summary (Phase 0)

### US1: Scroll Issue - Root Cause

| Issue             | File              | Line | Problem                                                                                                                                         |
| ----------------- | ----------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixed positioning | messages/page.tsx | 289  | `fixed inset-0 top-16` doesn't respond to keyboard                                                                                              |
| Missing min-h-0   | ChatWindow.tsx    | 120  | Grid row 1fr needs min-h-0 for overflow                                                                                                         |
| No safe-area      | MessageInput.tsx  | 144  | Missing safe-area padding for mobile keyboards. Use `pb-[env(safe-area-inset-bottom)]` or Tailwind safe-area plugin. Safari iOS 11.2+ required. |
| Flex shrink       | MessageInput.tsx  | 144  | Missing `flex-shrink-0` on wrapper                                                                                                              |

**Fix**: Change drawer-content to CSS Grid with explicit height chain, add safe-area padding.

### US2: OAuth Flow - Root Cause

| Issue              | File           | Line    | Problem                                            |
| ------------------ | -------------- | ------- | -------------------------------------------------- |
| `.single()` throws | key-service.ts | 326     | Throws PGRST116 on 0 rows (expected for new users) |
| Silent catch       | key-service.ts | 329-331 | Returns `false` on any error, masks actual state   |

**Fix**: Change `hasKeys()` to use `.maybeSingle()` like `deriveKeys()` does.

### US3: Password Manager - Root Cause

| Issue                | File            | Problem                                                           |
| -------------------- | --------------- | ----------------------------------------------------------------- |
| Modal vs Page        | ReAuthModal.tsx | Modals have lower password manager detection                      |
| Missing autocomplete | setup/page.tsx  | Needs `autocomplete="username"` and `autocomplete="new-password"` |

**Fix**: Use full-page `/messages/setup` for first-time setup mode (no valid keys), ReAuthModal for unlock mode only (valid keys exist but not in memory).

### US4: Decryption Error - Root Cause

| Issue                 | File               | Line    | Problem                              |
| --------------------- | ------------------ | ------- | ------------------------------------ |
| Hardcoded text        | message-service.ts | 564     | `'[Message could not be decrypted]'` |
| No visual distinction | MessageBubble.tsx  | 232-234 | Renders like normal message          |
| No type flag          | messaging.ts       | 125-139 | No way to detect error state         |

**Fix**: Add `decryptionError` flag to type, render with lock icon in MessageBubble.

### US5: Participant Name - Root Cause

| Issue            | File              | Line    | Problem                           |
| ---------------- | ----------------- | ------- | --------------------------------- |
| Silent failure   | messages/page.tsx | 194-196 | Catch block swallows query errors |
| Generic fallback | messages/page.tsx | 47      | Defaults to "User" on any error   |

**Fix**: Add error logging, use specific fallbacks ("Unknown User" for missing, "Deleted User" for deleted).

## Implementation Approach

### Priority Order (P1 first)

1. **US1 + US2** (P1) - Critical blockers, do first
2. **US3 + US4** (P2) - Important UX, do second
3. **US5** (P3) - Cosmetic, do last

### Test Strategy

- **US1**: Playwright viewport tests (320px, 375px, 667px landscape, 768px, 1024px landscape, 1280px, 1920px)
- **US2**: Unit test `hasKeys()` with 0 rows, 1 row, error scenarios
- **US3**: Manual browser test with Chrome/Firefox password managers
- **US4**: Storybook story for decryption error state
- **US5**: Unit test participant name resolution with mock data

## Complexity Tracking

_No constitution violations - all fixes follow existing patterns._

| Decision              | Rationale                                                        |
| --------------------- | ---------------------------------------------------------------- |
| No new components     | Bug fixes only - modify existing MessageBubble for error display |
| No data model changes | Add optional flag to TypeScript type only, no DB changes         |
| Full page for setup   | Better password manager detection per clarification              |

## Artifacts Generated

- [x] plan.md (this file)
- [x] tasks.md (generated by /tasks)
