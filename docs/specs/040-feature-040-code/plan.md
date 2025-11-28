# Implementation Plan: Code Quality Improvements

**Branch**: `040-feature-040-code` | **Date**: 2025-11-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/040-feature-040-code/spec.md`

## Summary

Address 5 critical code quality issues: (1) Remove CSP `unsafe-eval` directive from layout.tsx, (2) Replace 361 console.log statements across 100+ files with custom lightweight logger service, (3) Fix 20+ `as any` type assertions in messaging services, (4) Audit and secure private env vars in payment config, (5) Replace silent catch blocks with Supabase-style `{ data, error }` result tuples.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 15.5, React 19
**Primary Dependencies**: Supabase (auth, database, storage, realtime), Tailwind CSS 4, DaisyUI
**Storage**: Supabase PostgreSQL (cloud)
**Testing**: Vitest (unit), Playwright (E2E), Pa11y (a11y)
**Target Platform**: Static export to GitHub Pages (PWA)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Lighthouse 90+ (currently 92 perf, 98 a11y, 100 SEO)
**Constraints**: Static export (no server-side code), Docker-first development
**Scale/Scope**: ~606 TypeScript files, 376 components, 23 pages

### Current State Analysis

| Issue                  | Count | Location                      | Pattern                                   |
| ---------------------- | ----- | ----------------------------- | ----------------------------------------- |
| CSP unsafe-eval        | 1     | `src/app/layout.tsx:93`       | Google Analytics/GTM script-src           |
| console.log/warn/error | 361   | 100+ files in src/\*\*        | Direct console calls                      |
| `as any` assertions    | 20+   | `src/services/messaging/*.ts` | `(supabase as any)` pattern               |
| Private env vars       | 4     | `src/config/payment.ts`       | STRIPE_SECRET_KEY, SERVICE_ROLE_KEY, etc. |
| Silent catch blocks    | TBD   | src/services/**, src/lib/**   | Empty or minimal catch handlers           |

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                    | Status | Notes                                                     |
| ---------------------------- | ------ | --------------------------------------------------------- |
| I. Component Structure       | PASS   | Logger service follows 5-file pattern via generator       |
| II. Test-First Development   | PASS   | Logger service requires 100% test coverage (SC-006)       |
| III. PRP Methodology         | PASS   | Using /specify → /clarify → /plan → /tasks → /implement   |
| IV. Docker-First Development | PASS   | All commands run in Docker container                      |
| V. Progressive Enhancement   | PASS   | Logger degrades gracefully (falls back to console in dev) |
| VI. Privacy & Compliance     | PASS   | No PII logged, production logs suppressed                 |

**Gate Result**: PASS - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```
specs/040-feature-040-code/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
src/
├── lib/
│   └── logger/                    # NEW: Logger service (5-file pattern)
│       ├── index.ts               # Barrel export
│       ├── logger.ts              # Core implementation
│       ├── logger.test.ts         # Unit tests (100% coverage)
│       ├── logger.stories.tsx     # Storybook demo
│       └── logger.accessibility.test.ts  # N/A (not a UI component)
│
├── types/
│   └── result.ts                  # NEW: Result<T, E> type definition
│
├── services/
│   └── messaging/                 # MODIFY: Fix `as any` assertions
│       ├── message-service.ts     # 17 `as any` to fix
│       └── gdpr-service.ts        # 3+ `as any` to fix
│
├── config/
│   └── payment.ts                 # AUDIT: Private env var exposure
│
└── app/
    └── layout.tsx                 # MODIFY: Remove unsafe-eval from CSP
```

**Structure Decision**: Single Next.js web application. New logger service in `src/lib/logger/` following existing lib patterns. No new directories beyond logger service.

## Complexity Tracking

_No constitution violations - section not applicable._

## Phase 0 Research Topics

1. **CSP unsafe-eval removal**: What functionality requires eval()? Is it Google Analytics, hot reload, or something else? What's the alternative?

2. **Supabase type generation**: How to properly type Supabase client to eliminate `(supabase as any)` pattern?

3. **Silent catch blocks audit**: How many exist? What's the refactoring pattern for each?

4. **Private env var audit**: Are STRIPE_SECRET_KEY etc. actually bundled in client? What's the fix for static export?

5. **Logger test mocking**: How should tests mock the new logger service?

## Phase 1 Design Outputs

1. **data-model.md**: Logger configuration schema, Result type definition
2. **contracts/logger.ts**: Logger service interface contract
3. **quickstart.md**: How to use the new logger and Result pattern
