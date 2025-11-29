# Implementation Plan: Fix Messaging Scroll

**Branch**: `005-fix-messaging-scroll` | **Date**: 2025-11-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-fix-messaging-scroll/spec.md`

## Summary

Fix critical UX bug where users cannot see the message input or scroll to bottom of messages on all viewports. Root cause is nested flexbox with `h-full` failing to calculate heights reliably. Solution: Replace flexbox with CSS Grid layout (`grid-rows-[auto_1fr_auto]`) in ChatWindow, change jump button from `fixed` to `absolute` positioning, and ensure `h-full` propagates through container chain.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 15.5+
**Primary Dependencies**: Tailwind CSS 4, DaisyUI
**Storage**: N/A (CSS-only fix, no data changes)
**Testing**: Vitest for unit tests, Playwright for E2E viewport tests
**Target Platform**: Web (all viewports: mobile 375px, tablet 768px, desktop 1280px)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Layout renders correctly on page load, no layout shift
**Constraints**: Must work on all viewports without JavaScript-based height calculations
**Scale/Scope**: 3 component files to modify

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                         | Status  | Notes                                                |
| --------------------------------- | ------- | ---------------------------------------------------- |
| I. Component Structure Compliance | ✅ PASS | Modifying existing components, not creating new ones |
| II. Test-First Development        | ✅ PASS | Will add viewport tests to verify fix                |
| III. PRP Methodology              | ✅ PASS | Using SpecKit workflow                               |
| IV. Docker-First Development      | ✅ PASS | All development in Docker                            |
| V. Progressive Enhancement        | ✅ PASS | CSS Grid is well-supported, graceful degradation     |
| VI. Privacy & Compliance First    | N/A     | No data/privacy impact                               |

**Gate Status**: PASSED - No violations.

## Project Structure

### Documentation (this feature)

```
specs/005-fix-messaging-scroll/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (minimal - CSS patterns only)
├── data-model.md        # Phase 1 output (N/A - no data model)
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
src/
├── app/
│   └── messages/
│       └── page.tsx           # Fix: Ensure h-full propagates
├── components/
│   ├── organisms/
│   │   └── ChatWindow/
│   │       └── ChatWindow.tsx # Fix: Replace flex with CSS Grid
│   └── molecular/
│       └── MessageThread/
│           └── MessageThread.tsx  # Fix: Jump button positioning
└── ...

tests/
├── e2e/
│   └── messaging-scroll.spec.ts  # New: Viewport scroll tests
└── ...
```

**Structure Decision**: Modifying 3 existing files in the established Next.js App Router structure. No new components required.

## Complexity Tracking

_No violations - table not required._
