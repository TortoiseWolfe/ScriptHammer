# Implementation Plan: Accessibility Contrast Fix

**Feature Branch**: `013-accessibility-contrast-fix`
**SPEC-ID**: SPEC-044
**Created**: 2025-12-26

## Technical Context

- **File**: `src/components/Footer.tsx`
- **Issue**: Line 27 uses `text-base-content/40` (40% opacity)
- **Fix**: Change to `text-base-content/60` (60% opacity)
- **WCAG**: AA requires 4.5:1 contrast for normal text

## Constitution Check

| Principle                  | Status | Notes                      |
| -------------------------- | ------ | -------------------------- |
| I. Component Structure     | ✓      | Editing existing component |
| II. Test-First             | N/A    | Simple CSS fix             |
| III. PRP Methodology       | ✓      | Following SpecKit          |
| IV. Docker-First           | ✓      | Using Docker               |
| V. Progressive Enhancement | ✓      | Improving accessibility    |
| VI. Privacy & Compliance   | ✓      | WCAG compliance            |

## Implementation

Single line change:

```diff
- <p className="text-base-content/40 mt-1 text-xs">
+ <p className="text-base-content/60 mt-1 text-xs">
```

## Testing

1. Run accessibility tests: `docker compose exec scripthammer pnpm exec playwright test accessibility`
2. Visual check in browser across themes
