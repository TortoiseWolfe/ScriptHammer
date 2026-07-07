# Implementation Plan: Form Honeypot Fix

**Feature Branch**: `012-form-honeypot-fix`
**SPEC-ID**: SPEC-043
**Created**: 2025-12-26

## Technical Context

- **Framework**: Playwright E2E testing
- **File to modify**: `tests/e2e/tests/form-submission.spec.ts`
- **Root cause**: Lines 84-98 fill ALL text inputs without excluding honeypot
- **Fix approach**: Filter out honeypot fields before filling

## Constitution Check

| Principle                  | Status | Notes                      |
| -------------------------- | ------ | -------------------------- |
| I. Component Structure     | N/A    | No components created      |
| II. Test-First Development | ✓      | This IS a test fix         |
| III. PRP Methodology       | ✓      | Following SpecKit workflow |
| IV. Docker-First           | ✓      | Tests run in Docker        |
| V. Progressive Enhancement | N/A    | Test-only change           |
| VI. Privacy & Compliance   | ✓      | Bot detection preserved    |

## Implementation Approach

### Option 1: Filter by Label Text (Recommended)

Filter inputs by checking if their associated label contains honeypot indicators.

```typescript
// Before filling, filter out honeypot fields
const isHoneypot = async (input: Locator) => {
  const label = await input.evaluate((el) => {
    const id = el.id;
    const label = document.querySelector(`label[for="${id}"]`);
    return label?.textContent?.toLowerCase() || '';
  });
  return label.includes('human') || label.includes("don't fill");
};
```

**Pros**: Semantic, works regardless of field name/id
**Cons**: Slightly more complex

### Option 2: Filter by Input Name

Check if input name contains "honeypot" or similar.

**Pros**: Simple
**Cons**: Brittle if naming changes

### Decision: Option 1

Use label-based detection for robustness.

## Files to Modify

1. `tests/e2e/tests/form-submission.spec.ts`
   - Add honeypot detection helper function
   - Modify `form submission with valid data` test (lines 77-107)
   - Modify any other tests that fill all inputs generically

## Testing Strategy

1. Run modified test locally: `docker compose exec scripthammer pnpm exec playwright test form-submission.spec.ts`
2. Verify all 12 tests pass
3. Verify no changes to src/ directory
4. Manual verification: honeypot still blocks bots (optional)

## Risks & Mitigations

| Risk                     | Mitigation                          |
| ------------------------ | ----------------------------------- |
| Label text changes       | Use case-insensitive, partial match |
| Multiple honeypot fields | Helper works on any field           |
| Test becomes flaky       | Use robust Playwright selectors     |

## Estimated Effort

- Implementation: 15 minutes
- Testing: 10 minutes
- Total: 25 minutes
