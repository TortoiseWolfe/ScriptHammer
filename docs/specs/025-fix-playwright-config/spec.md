# Feature 025: Fix Playwright Configuration

## Overview

Split `blog-mobile-ux.spec.ts` into device-specific files to fix the Playwright `test.use()` anti-pattern.

## Problem Statement

The original file `e2e/tests/blog-mobile-ux.spec.ts` used `test.use()` inside `test.describe()` blocks (lines 14, 272, 304). This pattern fails with Playwright 1.55+ because spreading `devices['iPhone 12']` includes `defaultBrowserType`, which forces a new worker and cannot be used inside a describe group.

Error message:

```
Cannot use({ defaultBrowserType }) in a describe group, because it forces a new worker.
Make it top-level in the test file or put in the configuration file.
```

## Solution

Split the single file into three device-specific test files, each with `test.use()` at file scope:

### Files Created

1. **`blog-mobile-ux-iphone.spec.ts`** - iPhone 12 UX tests
   - 10 tests covering footer, SEO badge, TOC, horizontal scroll, code blocks, text readability, touch targets, scroll behavior, featured images

2. **`blog-mobile-ux-pixel.spec.ts`** - Pixel 5 UX tests
   - 2 tests for cross-platform compatibility (footer, horizontal scroll)

3. **`blog-touch-targets.spec.ts`** - Touch target standards tests
   - 2 tests validating 44x44px AAA touch target requirements

### File Removed

- `e2e/tests/blog-mobile-ux.spec.ts` - Original file with anti-pattern

## Key Changes

### Before (Anti-pattern)

```typescript
test.describe('Blog Post Mobile UX - iPhone 12', () => {
  test.use({
    ...devices['iPhone 12'], // ❌ Inside describe block
  });
  // tests...
});
```

### After (Correct pattern)

```typescript
// Device configuration at file scope (not inside describe)
test.use({
  ...devices['iPhone 12'], // ✅ At file scope
});

test.describe('Blog Post Mobile UX - iPhone 12', () => {
  // tests...
});
```

## Test Coverage

All original tests preserved:

- Footer visibility and content
- SEO badge positioning
- TOC button positioning
- No horizontal scroll on page
- Internal code block scrolling
- Text readability (font sizes)
- Touch-friendly elements
- Layout stability during scroll
- Featured image sizing
- Cross-platform (Pixel 5) compatibility
- Touch target standards (44x44px)

## Verification

Run the tests to verify no configuration errors:

```bash
docker compose exec scripthammer pnpm exec playwright test e2e/tests/blog-mobile-ux
```
