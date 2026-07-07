# Implementation Plan: Messages Page Code Quality

**Branch**: `009-feature-009-messages` | **Date**: 2025-11-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-feature-009-messages/spec.md`

## Summary

Fix 18 code review issues across the messages page components in 4 phases. This is a refactoring-only feature with no new functionality - improving TypeScript safety, memory leak prevention, architecture consistency, accessibility, and error handling patterns.

## Technical Context

**Language/Version**: TypeScript 5.x with React 19, Next.js 15.5+
**Primary Dependencies**: React hooks, Supabase realtime, @tanstack/react-virtual, clsx/cn utility
**Storage**: N/A (no data model changes)
**Testing**: Vitest for unit tests, Playwright for E2E, Pa11y for accessibility
**Target Platform**: Web (PWA), all modern browsers
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: No memory leaks, no unnecessary re-renders, stable virtual scroll
**Constraints**: Must maintain backward compatibility, no breaking changes to component APIs
**Scale/Scope**: 7 files affected, 18 discrete issues to resolve

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                         | Status  | Notes                                                           |
| --------------------------------- | ------- | --------------------------------------------------------------- |
| I. Component Structure Compliance | ✅ PASS | Modifying existing components, not creating new ones            |
| II. Test-First Development        | ✅ PASS | Existing tests cover functionality; may add edge case tests     |
| III. PRP Methodology              | ✅ PASS | Using SpecKit workflow (/specify → /plan → /tasks → /implement) |
| IV. Docker-First Development      | ✅ PASS | All development in Docker containers                            |
| V. Progressive Enhancement        | ✅ PASS | No new features, maintaining existing progressive behavior      |
| VI. Privacy & Compliance First    | ✅ PASS | No data collection changes                                      |

**Gate Result**: PASS - All principles satisfied, no violations requiring justification.

## Project Structure

### Documentation (this feature)

```
specs/009-feature-009-messages/
├── plan.md              # This file
├── research.md          # Phase 0 output (minimal - no unknowns)
├── data-model.md        # N/A - no data changes
├── quickstart.md        # Phase 1 output
├── contracts/           # N/A - no API changes
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (files to modify)

```
src/
├── app/
│   └── messages/
│       └── page.tsx                    # Issues: 1, 2, 3, 4, 5, 11, 14, 16
├── components/
│   ├── atomic/
│   │   └── MessageInput/
│   │       └── MessageInput.tsx        # Issue: 8
│   ├── molecular/
│   │   └── MessageThread/
│   │       └── MessageThread.tsx       # Issues: 10, 12, 13
│   └── organisms/
│       ├── ChatWindow/
│       │   └── ChatWindow.tsx          # Issue: 8
│       ├── ConversationList/
│       │   ├── ConversationList.tsx    # Issues: 7, 9
│       │   └── useConversationList.ts  # Issue: 15
│       └── UnifiedSidebar/
│           └── UnifiedSidebar.tsx      # Issues: 1, 6

tests/
├── unit/                               # May add edge case tests
└── integration/                        # Verify callback wiring
```

**Structure Decision**: Existing Next.js App Router structure. No new files created except possibly edge case test files.

## Phase 0: Research

No NEEDS CLARIFICATION items identified. This is a refactoring feature with:

- Known codebase patterns (cn() utility, createLogger, ErrorBoundary)
- Existing TypeScript strict mode configuration
- Standard React patterns (useCallback, useRef for cleanup)

### Research Summary

| Topic                 | Decision                                         | Rationale                                               |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| Error type handling   | Use `err: unknown` with `instanceof Error` check | TypeScript best practice for catch blocks               |
| Timer cleanup         | Store in useRef, cleanup in useEffect return     | Standard React pattern for memory leak prevention       |
| Callback architecture | Mirror existing onUnreadCountChange pattern      | Consistency with established codebase patterns          |
| className utility     | Use existing cn() from @/lib/utils               | Already in codebase, provides conditional class joining |

## Phase 1: Design

### Component Interface Changes

**UnifiedSidebar.tsx** - Add callback prop:

```typescript
interface UnifiedSidebarProps {
  // ... existing props
  onPendingConnectionCountChange?: (count: number) => void; // NEW
}
```

**ConnectionManager** - Call new callback:

```typescript
// When pending count changes
useEffect(() => {
  onPendingConnectionCountChange?.(pendingCount);
}, [pendingCount, onPendingConnectionCountChange]);
```

### Error Handling Pattern

Replace all `catch (err: any)` with:

```typescript
catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'An unexpected error occurred';
  setError(message);
}
```

### Timer Cleanup Pattern

```typescript
const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  if (showSetupToast) {
    toastTimeoutRef.current = setTimeout(() => setShowSetupToast(false), 10000);
  }
  return () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
  };
}, [showSetupToast]);
```

### Virtual Scroll Key Fix

```typescript
// Before (unstable)
key={virtualItem.key}

// After (stable)
key={messages[virtualItem.index].id}
```

### Supabase Channel Cleanup

```typescript
return () => {
  channel.unsubscribe(); // Explicit unsubscribe first
  supabase.removeChannel(channel);
};
```

## Implementation Phases

### Phase 1: Critical (4 issues) - ~45 min

1. Wire `setPendingConnectionCount` through UnifiedSidebar to ConnectionManager
2. Replace `err: any` with `err: unknown` at lines 284, 304
3. Add toast timer ref and cleanup
4. Remove/replace console.warn statements

### Phase 2: High Priority (3 issues) - ~30 min

5. Fix useEffect dependencies or memoize functions
6. Add `onPendingConnectionCountChange` to UnifiedSidebar interface
7. Have ConnectionManager call the callback

### Phase 3: Medium Priority (5 issues) - ~45 min

8. Standardize className concatenation with cn()
9. Update aria-label to "Clear conversation search"
10. Use message.id as virtual scroll key
11. Fix race condition in conversation loading
12. Document scroll threshold constants

### Phase 4: Low Priority (6 issues) - ~1 hour

13. Conditionally load React Profiler
14. Wrap ChatWindow in ErrorBoundary
15. Fix Supabase channel cleanup order
16. Use "Unknown User" consistently
17. Standardize error handling with createLogger
18. Add development-mode prop validation (optional)

## Quickstart

```bash
# Verify current state
docker compose exec scripthammer pnpm run type-check
docker compose exec scripthammer pnpm run lint

# After implementing each phase, verify:
docker compose exec scripthammer pnpm run type-check  # No any type errors
docker compose exec scripthammer pnpm run lint        # No ESLint warnings
docker compose exec scripthammer pnpm test            # All tests pass

# Final verification
docker compose exec scripthammer pnpm run build       # Production build clean
```

## Success Verification

| Criteria                       | Verification Command                                                        |
| ------------------------------ | --------------------------------------------------------------------------- |
| SC-001: No `any` types         | `grep -r "err: any" src/app/messages/` returns empty                        |
| SC-002: No eslint-disable      | `grep -r "eslint-disable.*exhaustive-deps" src/app/messages/` returns empty |
| SC-003: No memory leaks        | Manual test: navigate away from messages during toast, check console        |
| SC-004: No console.warn        | `grep -r "console.warn" src/app/messages/` returns empty                    |
| SC-005: Connection badge works | Manual test: create pending request, verify badge updates                   |
| SC-006: A11y passes            | `docker compose exec scripthammer pnpm run test:a11y`                       |
| SC-007: Error boundary works   | Manually throw error in ChatWindow, verify boundary catches                 |
| SC-008: All 18 issues resolved | Code review checklist complete                                              |

## Complexity Tracking

_No violations requiring justification. All changes follow existing patterns._
