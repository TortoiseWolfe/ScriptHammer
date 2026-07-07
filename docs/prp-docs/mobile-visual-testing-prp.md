# PRP-016: Automated Visual Testing with Percy/Chromatic

## Problem Statement

**Date**: 2025-10-01
**Status**: Proposed
**Priority**: P1 (Critical - blocks mobile development)

### The $200 Mistake: Using DOM Queries Instead of Visual Snapshots

Today we wasted an entire development day ($200 value based on hourly contractor rates) attempting to fix mobile UX issues using **DOM queries and element detection**. The root cause was using the **wrong type of automated testing**.

**What Happened:**

1. Mobile user reported: "Footer and SEO/TOC badges not visible on iPhone 12"
2. I installed Puppeteer and wrote tests checking `element.isVisible()`
3. Tests repeatedly reported: "Elements visible, layout correct"
4. Made 20+ commits trying different CSS fixes based on false test results
5. User's actual browser still showed broken layout
6. **Discovery**: DOM queries don't detect visual positioning issues like elements pushed off-screen

**The Core Problem:**
DOM-based tests (`isVisible()`, `boundingBox()`, `toBeInViewport()`) check if elements EXIST and are NOT `display: none`, but they **don't verify what the user actually SEES**:

- Element can be visible to DOM but positioned off-screen
- Fixed elements can be pushed by horizontal scroll
- Overflow hidden can clip visible elements
- Z-index stacking can hide elements
- Animations can move elements after initial render

**What We Actually Need:**
Visual regression testing that compares pixel-perfect screenshots across commits

## Requirements

### R1: Visual Regression Testing (Primary Solution)

Implement **Chromatic** (already in package.json!) or **Percy** for automated visual testing:

- Captures actual pixel screenshots at multiple viewports
- Compares screenshots across commits automatically
- Detects ANY visual change (positioning, overlap, clipping, etc.)
- Shows side-by-side diffs of what changed
- Catches issues like "element pushed off-screen" that DOM tests miss

### R2: Playwright for Functional Testing (Secondary)

Use Playwright for behavior verification, NOT visual verification:

- Enable iPhone 12 device emulation (already configured!)
- Test interactions: clicks, scrolls, form submissions
- Verify dynamic content loads correctly
- Check accessibility with `axe-playwright`
- **DO NOT use for visual verification** - use Chromatic/Percy instead

### R3: Mobile Testing Strategy

1. **Visual Tests (Chromatic)**: Catch layout/positioning issues automatically
2. **Functional Tests (Playwright)**: Verify behavior works
3. **Manual Testing**: Complex interactions and edge cases

### R4: Screenshot Comparison Workflow

Every commit should:

1. **Storybook stories** capture component states
2. **Chromatic** takes screenshots at mobile/desktop viewports
3. **Visual diffs** flag any changes in CI
4. **Human review** approves intentional changes or rejects regressions

## Success Criteria

### SC1: Chromatic Integration (Primary Goal)

- Chromatic project created and linked to repo
- `chromatic` script added to package.json
- CI workflow runs Chromatic on every PR
- Mobile viewport (390px) configured in Storybook

### SC2: Blog Component Stories for Visual Testing

Create Storybook stories for blog components:

- `BlogPostViewer.stories.tsx` - with mobile viewport
- `BlogContent.stories.tsx` - with code blocks
- Stories capture edge cases (long titles, many tags, etc.)

### SC3: Playwright for Functional Testing Only

- iPhone 12 device emulation enabled ✅
- Tests verify BEHAVIOR not appearance
- Remove visual assertions like `boundingBox()` checks
- Keep functional tests: clicks, scrolls, form submissions

### SC4: Documentation Updated

- `CLAUDE.md` section: "Visual vs Functional Testing"
- Rule: "Use Chromatic for how it looks, Playwright for how it works"
- Link to this PRP for rationale

## Technical Design

### Playwright Test Structure

```typescript
// e2e/tests/blog-mobile-ux.spec.ts
import { test, expect, devices } from '@playwright/test';

test.describe('Blog Post Mobile UX', () => {
  test.use({
    ...devices['iPhone 12'],
  });

  test('should display footer at bottom of page', async ({ page }) => {
    await page.goto('/blog/visual-testing-with-puppeteer');

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // Verify footer text
    await expect(footer).toContainText('Made by');
  });

  test('should display SEO badge in top-right', async ({ page }) => {
    await page.goto('/blog/visual-testing-with-puppeteer');

    const seoBadge = page.locator('button[title="Click to view SEO details"]');
    await expect(seoBadge).toBeVisible();

    // Verify position
    const box = await seoBadge.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThan(300); // Right side of 390px viewport
    expect(box!.y).toBeLessThan(200); // Near top
  });

  test('should not have horizontal scroll', async ({ page }) => {
    await page.goto('/blog/visual-testing-with-puppeteer');

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.viewportSize();

    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth!.width);
  });

  test('should allow code blocks to scroll internally', async ({ page }) => {
    await page.goto('/blog/visual-testing-with-puppeteer');

    const codeBlock = page.locator('.mockup-code').first();
    await expect(codeBlock).toBeVisible();

    // Verify code block has overflow-x: auto or scroll
    const overflowX = await codeBlock.evaluate(
      (el) => window.getComputedStyle(el).overflowX
    );
    expect(['auto', 'scroll']).toContain(overflowX);
  });
});
```

### Playwright Config Updates

```typescript
// playwright.config.ts (uncomment lines 75-77)
{
  name: 'Mobile Safari',
  use: { ...devices['iPhone 12'] },
},
```

## Implementation Plan

### Phase 1: Cleanup (30 minutes)

1. ✅ Reset git to last known good commit (`ea8728d`)
2. Remove Puppeteer from dependencies
3. Delete visual testing scripts/docs from today
4. Verify app still works

### Phase 2: Enable Playwright Mobile Testing (15 minutes)

1. Uncomment iPhone 12 config in `playwright.config.ts`
2. Run existing E2E tests on mobile viewport
3. Verify screenshots work

### Phase 3: Create Mobile UX Test Suite (45 minutes)

1. Write `e2e/tests/blog-mobile-ux.spec.ts`
2. Add tests for footer, badges, scroll behavior
3. Run tests and verify they pass

### Phase 4: Documentation (30 minutes)

1. Update `CLAUDE.md` with mobile testing workflow
2. Add examples of human-first verification
3. Document when to use Playwright vs manual testing

**Total Estimated Time**: 2 hours (vs 8 hours wasted today)

## Risks & Mitigations

| Risk                                                   | Impact | Mitigation                                                               |
| ------------------------------------------------------ | ------ | ------------------------------------------------------------------------ |
| Playwright tests also give false positives             | High   | Always verify fixes in real browser first, use tests only for regression |
| User doesn't have time for iterative testing           | High   | Use Chrome DevTools device mode for faster iteration                     |
| Mobile-specific bugs not caught in desktop development | Medium | Add mobile viewport to local testing routine                             |
| CI flakiness with mobile tests                         | Medium | Increase timeouts, add retries for mobile-specific tests                 |

## Lessons Learned

### What Went Wrong

1. **Used DOM queries for visual problems** - `element.isVisible()` doesn't mean user can see it
2. **Ignored existing Chromatic package** - Already had visual testing tool installed, unused
3. **Made changes based on false test results** - DOM said "visible", pixels said "off-screen"
4. **No automated screenshot comparison** - Relied on human to manually check every commit

### What Should Have Happened

1. **Use Chromatic for visual issues** - Pixel-perfect screenshot comparison would catch positioning problems
2. **Storybook stories for components** - Capture mobile states in stories, Chromatic tests them automatically
3. **Visual regression in CI** - Every PR gets screenshots compared, diffs flagged
4. **Playwright for behavior only** - Reserve Playwright for "does it scroll", "does it click", not "does it look right"

### Key Principle

> **Visual problems need visual testing. DOM queries can't see pixels.**

If a user reports "I can't see X", the test must capture actual rendered pixels, not query the DOM for element existence.

## Related PRPs

- PRP-001: PRP Methodology (meta-documentation of this process)
- PRP-012: Visual Regression Testing (Chromatic integration, deferred)

## References

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Testing on Real Devices](https://playwright.dev/docs/emulation)
- [Mobile Web Testing Guide](https://web.dev/mobile-first/)

---

**Author**: Claude Code (learning from mistakes)
**Reviewer**: TortoiseWolfe (the human who had to suffer through this)
**Cost of This Lesson**: $200 (8 hours @ $25/hour)
**Value of This PRP**: Prevents future $200 wastes
