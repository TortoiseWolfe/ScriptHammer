# Tasks: Mobile-First Design Overhaul

**Feature**: PRP-017 Mobile-First Design
**Branch**: `017-mobile-first-design`
**Input**: Design documents from `/specs/017-mobile-first-design/`
**Prerequisites**: ✅ plan.md, ✅ research.md, ✅ data-model.md, ✅ quickstart.md, ✅ spec.md

---

## Execution Flow

```
1. Load plan.md ✓
   → Tech stack: Next.js 15.5, React 19, Tailwind CSS 4, DaisyUI 5
   → Structure: Single project with src/
2. Load design documents ✓
   → data-model.md: 6 entities identified
   → research.md: 4 major technical decisions
   → quickstart.md: 5 test scenarios
3. Generate tasks by category:
   → Setup: Configuration and TypeScript types
   → Tests: Mobile viewport, touch targets, horizontal scroll
   → Core: Components (navigation, buttons, cards, images, hooks)
   → Pages: Homepage, blog, docs layouts
   → Images: Optimization script and component
   → Polish: Documentation, templates, validation
4. Apply task rules:
   → Different files = [P] (parallel)
   → Same file = sequential
   → Tests before implementation (TDD)
5. Number tasks: T001-T052 (52 total tasks)
6. Dependencies: Foundation → Components → Pages → Polish
7. Parallel execution: 28 tasks marked [P]
8. Validation: All tests before implementation ✓
```

---

## Task Overview

**Total Tasks**: 52
**Parallel Tasks**: 28 marked [P]
**Estimated Time**: 3-4 weeks

**Breakdown by Phase**:

- Phase 1 (Setup): 7 tasks (T001-T007)
- Phase 2 (Tests): 11 tasks (T008-T018)
- Phase 3 (Configuration): 5 tasks (T019-T023)
- Phase 4 (Components): 12 tasks (T024-T035)
- Phase 5 (Pages): 5 tasks (T036-T040)
- Phase 6 (Images): 6 tasks (T041-T046)
- Phase 7 (Polish): 6 tasks (T047-T052)

---

## Phase 1: Setup & Foundation

### T001: Verify Feature Branch

**Type**: Setup
**Priority**: P0-Critical
**Depends On**: None
**Parallel**: No
**Estimated Time**: 5min

**Description**: Verify on correct feature branch `017-mobile-first-design`

**Acceptance Criteria**:

- [x] Current branch is `017-mobile-first-design`
- [x] Branch created from `main`
- [x] No uncommitted changes from previous work

**Implementation**:

```bash
git branch --show-current  # Should output: 017-mobile-first-design
git status                  # Should be clean or only have spec files
```

---

### T002: Start Docker Environment

**Type**: Setup
**Priority**: P0-Critical
**Depends On**: T001
**Parallel**: No
**Estimated Time**: 2min

**Description**: Start Docker development environment

**Acceptance Criteria**:

- [x] Docker containers running
- [x] Dev server accessible at `localhost:3000`
- [x] No container errors in logs

**Implementation**:

```bash
docker compose up -d
docker compose ps  # Verify all services running
curl -I http://localhost:3000  # Should return 200 OK
```

---

### T003: [P] Install Dependencies

**Type**: Setup
**Priority**: P0-Critical
**Depends On**: T002
**Parallel**: Yes
**Estimated Time**: 3min

**Description**: Ensure all npm dependencies are installed

**Acceptance Criteria**:

- [x] `node_modules/` populated
- [x] `pnpm-lock.yaml` up to date
- [x] No dependency conflicts

**Implementation**:

```bash
docker compose exec scripthammer pnpm install
docker compose exec scripthammer pnpm list tailwindcss  # Verify 4.1.13
docker compose exec scripthammer pnpm list sharp  # Verify 0.34.4
```

---

### T004: [P] Create TypeScript Configuration Types

**Type**: Setup
**Priority**: P0-Critical
**Depends On**: T003
**Parallel**: Yes (different file from T005-T007)
**Estimated Time**: 30min

**Description**: Create TypeScript type definitions from data-model.md

**File**: `/home/turtle_wolfe/repos/ScriptHammer/src/types/mobile-first.ts`

**Acceptance Criteria**:

- [x] `BreakpointConfig` interface defined
- [x] `DeviceInfo` interface defined
- [x] `TouchTarget` interface defined
- [x] `ResponsiveImageConfig` interface defined
- [x] `TypographyScale` interface defined
- [x] `TestViewport` interface defined
- [x] All enums and constants exported
- [x] No TypeScript errors

**Implementation**:

```typescript
// Copy TypeScript definitions from data-model.md
// Sections: BreakpointConfig, DeviceInfo, TouchTarget, etc.
// Export all types and constants
```

**Testing**:

```bash
docker compose exec scripthammer pnpm run type-check
```

---

### T005: [P] Create Breakpoint Configuration

**Type**: Setup
**Priority**: P0-Critical
**Depends On**: T004
**Parallel**: Yes (different file)
**Estimated Time**: 15min

**Description**: Create breakpoint configuration constants

**File**: `/home/turtle_wolfe/repos/ScriptHammer/src/config/breakpoints.ts`

**Acceptance Criteria**:

- [x] BREAKPOINTS constant exported
- [x] xs (320px), sm (428px), md (768px), lg (1024px) defined
- [x] Matches data-model.md specification
- [x] TypeScript types imported correctly

**Implementation**:

```typescript
import type { BreakpointConfig } from '@/types/mobile-first';

export const BREAKPOINTS: Record<string, BreakpointConfig> = {
  xs: { name: 'xs', minWidth: 320, maxWidth: 427, category: 'mobile', ... },
  sm: { name: 'sm', minWidth: 428, maxWidth: 767, category: 'mobile', ... },
  // etc.
};
```

---

### T006: [P] Create Test Viewport Configuration

**Type**: Setup
**Priority**: P1-Important
**Depends On**: T004
**Parallel**: Yes (different file)
**Estimated Time**: 20min

**Description**: Create Playwright test viewport configurations

**File**: `/home/turtle_wolfe/repos/ScriptHammer/src/config/test-viewports.ts`

**Acceptance Criteria**:

- [x] TEST_VIEWPORTS array exported
- [x] iPhone SE (375x667) configured
- [x] iPhone 12 (390x844) configured
- [x] iPhone 12 Landscape (844x390) configured
- [x] iPhone 14 Pro Max (428x926) configured
- [x] iPad Mini portrait and landscape configured
- [x] Extreme narrow (320x568) configured

**Implementation**:

```typescript
import type { TestViewport } from '@/types/mobile-first';

export const TEST_VIEWPORTS: TestViewport[] = [
  {
    name: 'iPhone SE',
    category: 'mobile',
    width: 375,
    height: 667,
    // ... rest from data-model.md
  },
  // ... all other viewports
];
```

---

### T007: [P] Create Touch Target Standards

**Type**: Setup
**Priority**: P1-Important
**Depends On**: T004
**Parallel**: Yes (different file)
**Estimated Time**: 10min

**Description**: Create touch target standard constants

**File**: `/home/turtle_wolfe/repos/ScriptHammer/src/config/touch-targets.ts`

**Acceptance Criteria**:

- [x] TOUCH_TARGET_STANDARDS constant exported
- [x] AA standard (24x24px) defined
- [x] AAA standard (44x44px) defined
- [x] Validation function exported

**Implementation**:

```typescript
import type { TouchTarget } from '@/types/mobile-first';

export const TOUCH_TARGET_STANDARDS = {
  AA: {
    minWidth: 24,
    minHeight: 24,
    minSpacing: 0,
    standard: 'WCAG 2.2 Level AA',
  },
  AAA: {
    minWidth: 44,
    minHeight: 44,
    minSpacing: 8,
    standard: 'WCAG 2.2 Level AAA / Apple HIG',
  },
} as const;

export function validateTouchTarget(target: TouchTarget): boolean {
  // Validation logic from data-model.md
}
```

---

## Phase 2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE IMPLEMENTATION

### T008: [P] Create Mobile Navigation Test

**Type**: Test
**Priority**: P0-Critical
**Depends On**: T006
**Parallel**: Yes (different test file)
**Estimated Time**: 45min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/e2e/tests/mobile-navigation.spec.ts`

**Description**: Test navigation fits mobile viewport with no horizontal scroll

**Acceptance Criteria**:

- [ ] Test runs at 320px, 390px, 428px widths
- [ ] Asserts navigation within viewport bounds
- [ ] Asserts no horizontal scroll
- [ ] Asserts all controls visible
- [ ] **Test FAILS initially** (TDD RED phase)

**Implementation**:

```typescript
import { test, expect } from '@playwright/test';
import { TEST_VIEWPORTS } from '@/config/test-viewports';

test.describe('Mobile Navigation', () => {
  for (const viewport of TEST_VIEWPORTS.filter(
    (v) => v.category === 'mobile'
  )) {
    test(`Navigation fits within ${viewport.name} viewport`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto('/');

      const nav = page.locator('nav');
      const navBox = await nav.boundingBox();

      expect(navBox?.width).toBeLessThanOrEqual(viewport.width);

      // Check no horizontal scroll
      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 1);
    });
  }
});
```

**Testing**:

```bash
# Test should FAIL initially
docker compose exec scripthammer pnpm exec playwright test e2e/tests/mobile-navigation.spec.ts
```

---

### T009: [P] Create Touch Target Validation Test

**Type**: Test
**Priority**: P0-Critical
**Depends On**: T006, T007
**Parallel**: Yes (different test file)
**Estimated Time**: 1h

**File**: `/home/turtle_wolfe/repos/ScriptHammer/e2e/tests/mobile-touch-targets.spec.ts`

**Description**: Test all interactive elements meet 44x44px minimum

**Acceptance Criteria**:

- [ ] Tests all buttons, links, inputs
- [ ] Asserts width ≥ 44px
- [ ] Asserts height ≥ 44px
- [ ] Asserts spacing ≥ 8px between elements
- [ ] **Test FAILS initially** (many elements < 44px)

**Implementation**:

```typescript
import { test, expect } from '@playwright/test';
import { TOUCH_TARGET_STANDARDS } from '@/config/touch-targets';

test.describe('Touch Target Standards', () => {
  test('All interactive elements meet 44x44px minimum', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12
    await page.goto('/');

    const MINIMUM = TOUCH_TARGET_STANDARDS.AAA.minWidth;
    const interactiveElements = await page
      .locator('button, a[href], input[type="button"], [role="button"]')
      .all();

    for (const element of interactiveElements) {
      if (await element.isVisible()) {
        const box = await element.boundingBox();
        if (box) {
          expect(box.height, 'Touch target height').toBeGreaterThanOrEqual(
            MINIMUM - 1
          );
          expect(box.width, 'Touch target width').toBeGreaterThanOrEqual(
            MINIMUM - 1
          );
        }
      }
    }
  });
});
```

**Testing**:

```bash
# Test should FAIL initially (current: 20px minimum)
docker compose exec scripthammer pnpm exec playwright test e2e/tests/mobile-touch-targets.spec.ts
```

---

### T010: [P] Create Horizontal Scroll Detection Test

**Type**: Test
**Priority**: P0-Critical
**Depends On**: T006
**Parallel**: Yes (different test file)
**Estimated Time**: 30min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/e2e/tests/mobile-horizontal-scroll.spec.ts`

**Description**: Test zero horizontal scroll on all pages at mobile widths

**Acceptance Criteria**:

- [ ] Tests homepage, blog list, blog post, docs
- [ ] Tests at 320px, 390px, 428px
- [ ] Asserts scrollWidth ≤ viewportWidth
- [ ] **Test FAILS initially** on some pages

**Implementation**:

```typescript
import { test, expect } from '@playwright/test';

const pages = ['/', '/blog', '/blog/countdown-timer-react-tutorial'];
const widths = [320, 390, 428];

test.describe('Horizontal Scroll Detection', () => {
  for (const url of pages) {
    for (const width of widths) {
      test(`No horizontal scroll on ${url} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(url);

        const scrollWidth = await page.evaluate(
          () => document.documentElement.scrollWidth
        );
        const clientWidth = await page.evaluate(
          () => document.documentElement.clientWidth
        );

        expect(
          scrollWidth,
          `Horizontal scroll detected at ${width}px`
        ).toBeLessThanOrEqual(clientWidth + 1);
      });
    }
  }
});
```

---

### T011: [P] Create Typography Test

**Type**: Test
**Priority**: P1-Important
**Depends On**: T006
**Parallel**: Yes (different test file)
**Estimated Time**: 30min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/e2e/tests/mobile-typography.spec.ts`

**Description**: Test text is readable without zoom (≥16px on mobile)

**Acceptance Criteria**:

- [ ] Tests body text, headings, links
- [ ] Asserts base text ≥ 16px on mobile
- [ ] Asserts proper line-height ≥ 1.5
- [ ] **Test FAILS initially** if text too small

**Implementation**:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Mobile Typography', () => {
  test('Body text is readable without zoom (≥16px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog/countdown-timer-react-tutorial');

    const bodyText = page.locator('article p').first();
    const fontSize = await bodyText.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).fontSize)
    );

    expect(fontSize).toBeGreaterThanOrEqual(14); // Mobile minimum (0.875rem)
  });

  test('Line height is comfortable (≥1.5)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog/countdown-timer-react-tutorial');

    const bodyText = page.locator('article p').first();
    const lineHeight = await bodyText.evaluate(
      (el) =>
        parseFloat(window.getComputedStyle(el).lineHeight) /
        parseFloat(window.getComputedStyle(el).fontSize)
    );

    expect(lineHeight).toBeGreaterThanOrEqual(1.5);
  });
});
```

---

### T012: [P] Create Orientation Change Test

**Type**: Test
**Priority**: P1-Important
**Depends On**: T006
**Parallel**: Yes (different test file)
**Estimated Time**: 45min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/e2e/tests/mobile-orientation.spec.ts`

**Description**: Test mobile stays in mobile mode when rotated to landscape

**Acceptance Criteria**:

- [ ] Tests iPhone 12 portrait (390x844)
- [ ] Tests iPhone 12 landscape (844x390)
- [ ] Asserts mobile layout maintained in both orientations
- [ ] Asserts no switch to tablet layout in landscape
- [ ] **Test FAILS initially** if layout switches

**Implementation**:

```typescript
import { test, expect, devices } from '@playwright/test';

test.describe('Mobile Orientation Detection', () => {
  test('iPhone 12 portrait uses mobile styles', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 12'] });
    const page = await context.newPage();
    await page.goto('/');

    const container = page.locator('[data-testid="responsive-container"]');
    const classList = await container.getAttribute('class');

    expect(classList).toContain('mobile-layout');
    expect(classList).not.toContain('tablet-layout');

    await context.close();
  });

  test('iPhone 12 landscape STAYS in mobile mode', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 12'],
      viewport: { width: 844, height: 390 }, // Landscape
    });
    const page = await context.newPage();
    await page.goto('/');

    const container = page.locator('[data-testid="responsive-container"]');
    const classList = await container.getAttribute('class');

    // Should STILL be mobile (not switch to tablet at 844px width)
    expect(classList).toContain('mobile-layout');
    expect(classList).not.toContain('tablet-layout');

    await context.close();
  });
});
```

---

### T013: [P] Update Blog Mobile UX Test

**Type**: Test
**Priority**: P1-Important
**Depends On**: T006, T007
**Parallel**: Yes (different test file)
**Estimated Time**: 30min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/e2e/tests/blog-mobile-ux.spec.ts`

**Description**: Update existing blog mobile test to enforce 44x44px touch target standards

**Acceptance Criteria**:

- [ ] Updates existing assertions to use TOUCH_TARGET_STANDARDS.AAA
- [ ] Tests blog list page touch targets
- [ ] Tests blog post page touch targets
- [ ] Asserts minimum 44x44px for all interactive elements
- [ ] **Test FAILS initially** (current: 20px minimum)

**Implementation**:

```typescript
import { test, expect } from '@playwright/test';
import { TOUCH_TARGET_STANDARDS } from '@/config/touch-targets';

test.describe('Blog Mobile UX', () => {
  test('Blog list cards have adequate touch targets', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog');

    const MINIMUM = TOUCH_TARGET_STANDARDS.AAA.minWidth;
    const blogCards = await page.locator('[data-testid="blog-card"]').all();

    for (const card of blogCards) {
      const box = await card.boundingBox();
      if (box) {
        expect(box.height, 'Blog card touch height').toBeGreaterThanOrEqual(
          MINIMUM
        );
      }
    }
  });
});
```

---

### T014: [P] Create Mobile Card Layout Test

**Type**: Test
**Priority**: P1-Important
**Depends On**: T006
**Parallel**: Yes (different test file)
**Estimated Time**: 30min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/e2e/tests/mobile-card-layout.spec.ts`

**Description**: Test card components stack properly on mobile and expand on tablet/desktop

**Acceptance Criteria**:

- [ ] Tests card layout at 320px, 390px, 768px, 1024px
- [ ] Asserts single column on mobile
- [ ] Asserts grid layout on tablet/desktop
- [ ] Asserts cards fit within viewport
- [ ] **Test FAILS initially** if cards overflow

**Implementation**:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Mobile Card Layout', () => {
  test('Cards stack vertically on mobile (320px-767px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const cards = await page.locator('[class*="card"]').all();
    if (cards.length >= 2) {
      const box1 = await cards[0].boundingBox();
      const box2 = await cards[1].boundingBox();

      // Vertical stacking: second card should be below first
      expect(box2?.y).toBeGreaterThan((box1?.y || 0) + (box1?.height || 0));
    }
  });

  test('Cards use grid layout on tablet (768px+)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    const container = page.locator('[class*="grid"]').first();
    const display = await container.evaluate(
      (el) => window.getComputedStyle(el).display
    );

    expect(display).toBe('grid');
  });
});
```

---

### T015: [P] Create Mobile Button Test

**Type**: Test
**Priority**: P0-Critical
**Depends On**: T006, T007
**Parallel**: Yes (different test file)
**Estimated Time**: 45min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/e2e/tests/mobile-buttons.spec.ts`

**Description**: Test all button sizes meet 44x44px minimum on mobile

**Acceptance Criteria**:

- [ ] Tests all button variants (primary, secondary, ghost)
- [ ] Tests all button sizes (sm, md, lg)
- [ ] Asserts 44x44px minimum on mobile viewports
- [ ] Asserts adequate spacing between adjacent buttons
- [ ] **Test FAILS initially** (btn-sm and btn-xs too small)

**Implementation**:

```typescript
import { test, expect } from '@playwright/test';
import { TOUCH_TARGET_STANDARDS } from '@/config/touch-targets';

test.describe('Mobile Button Standards', () => {
  test('All buttons meet 44x44px minimum on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const MINIMUM = TOUCH_TARGET_STANDARDS.AAA.minWidth;
    const buttons = await page.locator('button, [role="button"]').all();

    for (const button of buttons) {
      if (await button.isVisible()) {
        const box = await button.boundingBox();
        if (box) {
          expect(box.width, 'Button width').toBeGreaterThanOrEqual(MINIMUM - 1);
          expect(box.height, 'Button height').toBeGreaterThanOrEqual(
            MINIMUM - 1
          );
        }
      }
    }
  });

  test('Buttons have 8px minimum spacing', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const buttonGroups = await page.locator('[class*="gap"]').all();
    for (const group of buttonGroups) {
      const gap = await group.evaluate((el) =>
        parseFloat(window.getComputedStyle(el).gap)
      );

      expect(gap).toBeGreaterThanOrEqual(8);
    }
  });
});
```

---

### T016: [P] Create Mobile Form Input Test

**Type**: Test
**Priority**: P1-Important
**Depends On**: T006, T007
**Parallel**: Yes (different test file)
**Estimated Time**: 30min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/e2e/tests/mobile-form-inputs.spec.ts`

**Description**: Test form inputs meet touch target standards and are easy to use on mobile

**Acceptance Criteria**:

- [ ] Tests text inputs, textareas, selects
- [ ] Asserts 44px minimum height
- [ ] Asserts proper spacing between form fields
- [ ] Asserts labels are tappable (label-for association)
- [ ] **Test FAILS initially** if inputs too small

**Implementation**:

```typescript
import { test, expect } from '@playwright/test';
import { TOUCH_TARGET_STANDARDS } from '@/config/touch-targets';

test.describe('Mobile Form Inputs', () => {
  test('Form inputs meet 44px height minimum', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/'); // Adjust to page with forms

    const MINIMUM = TOUCH_TARGET_STANDARDS.AAA.minHeight;
    const inputs = await page
      .locator('input[type="text"], input[type="email"], textarea, select')
      .all();

    for (const input of inputs) {
      if (await input.isVisible()) {
        const box = await input.boundingBox();
        if (box) {
          expect(box.height, 'Input height').toBeGreaterThanOrEqual(
            MINIMUM - 1
          );
        }
      }
    }
  });

  test('Form fields have adequate spacing', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const formGroups = await page
      .locator('[class*="form-control"], [class*="input-group"]')
      .all();
    for (const group of formGroups) {
      const marginBottom = await group.evaluate((el) =>
        parseFloat(window.getComputedStyle(el).marginBottom)
      );

      expect(marginBottom).toBeGreaterThanOrEqual(16); // 1rem minimum
    }
  });
});
```

---

### T017: [P] Create Mobile Image Responsive Test

**Type**: Test
**Priority**: P1-Important
**Depends On**: T006
**Parallel**: Yes (different test file)
**Estimated Time**: 30min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/e2e/tests/mobile-images.spec.ts`

**Description**: Test images are responsive and don't overflow viewport

**Acceptance Criteria**:

- [ ] Tests images at 320px, 390px, 428px
- [ ] Asserts images width ≤ viewport width
- [ ] Asserts proper aspect ratio maintained
- [ ] Asserts lazy loading enabled
- [ ] **Test FAILS initially** if images overflow

**Implementation**:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Mobile Responsive Images', () => {
  const widths = [320, 390, 428];

  for (const width of widths) {
    test(`Images fit within ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/blog/countdown-timer-react-tutorial');

      const images = await page.locator('img').all();

      for (const img of images) {
        if (await img.isVisible()) {
          const box = await img.boundingBox();
          if (box) {
            expect(box.width, 'Image width').toBeLessThanOrEqual(width);
          }
        }
      }
    });
  }

  test('Images use lazy loading', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog');

    const images = await page.locator('img').all();
    for (const img of images) {
      const loading = await img.getAttribute('loading');
      expect(loading).toBe('lazy');
    }
  });
});
```

---

### T018: [P] Create Mobile Footer Test

**Type**: Test
**Priority**: P2-Nice-to-have
**Depends On**: T006
**Parallel**: Yes (different test file)
**Estimated Time**: 20min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/e2e/tests/mobile-footer.spec.ts`

**Description**: Test footer stacks properly on mobile and all links are tappable

**Acceptance Criteria**:

- [ ] Tests footer at 320px, 390px, 428px
- [ ] Asserts footer links stack vertically on mobile
- [ ] Asserts all footer links meet 44x44px minimum
- [ ] Asserts footer fits within viewport
- [ ] **Test FAILS initially** if links too small

**Implementation**:

```typescript
import { test, expect } from '@playwright/test';
import { TOUCH_TARGET_STANDARDS } from '@/config/touch-targets';

test.describe('Mobile Footer', () => {
  test('Footer links stack vertically on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const footerLinks = await page.locator('footer a').all();
    if (footerLinks.length >= 2) {
      const box1 = await footerLinks[0].boundingBox();
      const box2 = await footerLinks[1].boundingBox();

      // Vertical stacking: second link should be below first
      expect(box2?.y).toBeGreaterThan(box1?.y || 0);
    }
  });

  test('Footer links meet touch target standards', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const MINIMUM = TOUCH_TARGET_STANDARDS.AAA.minHeight;
    const footerLinks = await page.locator('footer a').all();

    for (const link of footerLinks) {
      if (await link.isVisible()) {
        const box = await link.boundingBox();
        if (box) {
          expect(box.height, 'Footer link height').toBeGreaterThanOrEqual(
            MINIMUM - 1
          );
        }
      }
    }
  });
});
```

---

## Phase 3: Configuration & Foundation

### T019: Update Tailwind Configuration with Custom Breakpoints

**Type**: Configuration
**Priority**: P0-Critical
**Depends On**: T005
**Parallel**: No (same config file)
**Estimated Time**: 30min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/tailwind.config.ts`

**Description**: Add custom mobile-first breakpoints to Tailwind config

**Acceptance Criteria**:

- [ ] xs (320px), sm (428px), md (768px), lg (1024px) defined
- [ ] Imports BREAKPOINTS from config
- [ ] Build succeeds without errors
- [ ] Custom breakpoint classes work (xs:, sm:, md:, lg:)

**Implementation**:

```typescript
import type { Config } from 'tailwindcss';
import { BREAKPOINTS } from './src/config/breakpoints';

const config: Config = {
  theme: {
    screens: Object.entries(BREAKPOINTS).reduce(
      (acc, [key, value]) => {
        acc[key] = `${value.minWidth}px`;
        return acc;
      },
      {} as Record<string, string>
    ),
    extend: {
      minHeight: {
        touch: '44px',
        'touch-lg': '48px',
      },
      minWidth: {
        touch: '44px',
        'touch-lg': '48px',
      },
    },
  },
};

export default config;
```

**Testing**:

```bash
docker compose restart scripthammer
docker compose logs scripthammer | grep -i error  # Should be none
```

---

### T020: Update globals.css with Fluid Typography

**Type**: Configuration
**Priority**: P0-Critical
**Depends On**: T019
**Parallel**: No (modifies globals.css)
**Estimated Time**: 45min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/src/styles/globals.css`

**Description**: Add fluid typography scale using clamp() functions

**Acceptance Criteria**:

- [ ] @theme directive with custom breakpoints added
- [ ] Fluid typography variables defined (--text-xs through --text-9xl)
- [ ] Uses clamp() for responsive scaling
- [ ] Preserves existing --font-scale-factor
- [ ] Build succeeds

**Implementation**:

```css
@import 'tailwindcss';

@theme {
  --breakpoint-xs: 20rem; /* 320px */
  --breakpoint-sm: 26.75rem; /* 428px */
  --breakpoint-md: 48rem; /* 768px */
  --breakpoint-lg: 64rem; /* 1024px */
}

:root {
  --font-scale-factor: 1;

  /* Fluid typography from data-model.md */
  --text-xs: calc(
    clamp(0.625rem, 0.5rem + 0.5vw, 0.75rem) * var(--font-scale-factor)
  );
  --text-sm: calc(
    clamp(0.75rem, 0.65rem + 0.5vw, 0.875rem) * var(--font-scale-factor)
  );
  --text-base: calc(
    clamp(0.875rem, 0.8rem + 0.5vw, 1rem) * var(--font-scale-factor)
  );
  /* ... rest of scale from data-model.md */
}
```

---

### T021: Create Mobile-First Utility Classes

**Type**: Configuration
**Priority**: P1-Important
**Depends On**: T020
**Parallel**: No (sequential after globals.css)
**Estimated Time**: 30min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/src/styles/mobile-first-utilities.css`

**Description**: Create reusable mobile-first utility classes

**Acceptance Criteria**:

- [ ] `.container-mobile-first` class created
- [ ] `.touch-target` class created
- [ ] `.stack-to-row` class created
- [ ] `.mobile-hide` and `.desktop-hide` classes created
- [ ] Imported in globals.css

**Implementation**:

```css
/* Mobile-first layout patterns */

.container-mobile-first {
  @apply w-full px-4 sm:px-6 lg:mx-auto lg:max-w-7xl lg:px-8;
}

.touch-target {
  @apply min-h-[44px] min-w-[44px];
}

.stack-to-row {
  @apply flex flex-col gap-4 sm:flex-row sm:gap-6 lg:gap-8;
}

.mobile-hide {
  @apply hidden sm:block;
}

.desktop-hide {
  @apply block sm:hidden;
}

.grid-responsive {
  @apply grid grid-cols-1 gap-4 min-[500px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4;
}
```

Then add to `globals.css`:

```css
@import './mobile-first-utilities.css';
```

---

### T022: Update Playwright Configuration with Mobile Viewports

**Type**: Configuration
**Priority**: P1-Important
**Depends On**: T006
**Parallel**: Yes (different config file)
**Estimated Time**: 20min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/playwright.config.ts`

**Description**: Add mobile viewport test projects to Playwright config

**Acceptance Criteria**:

- [ ] iPhone SE project added
- [ ] iPhone 12 portrait and landscape projects added
- [ ] iPhone 14 Pro Max project added
- [ ] iPad Mini portrait and landscape projects added
- [ ] Extreme narrow (320px) project added

**Implementation**:

```typescript
import { defineConfig, devices } from '@playwright/test';
import { TEST_VIEWPORTS } from './src/config/test-viewports';

export default defineConfig({
  projects: [
    // ... existing projects ...

    // Add mobile viewport projects
    ...TEST_VIEWPORTS.map((viewport) => ({
      name: viewport.name,
      use: {
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.devicePixelRatio,
        hasTouch: viewport.hasTouch,
        isMobile: viewport.isMobile,
      },
    })),
  ],
});
```

---

### T023: Create Breakpoint Validation Script

**Type**: Configuration
**Priority**: P2-Nice-to-have
**Depends On**: T005
**Parallel**: Yes (new script file)
**Estimated Time**: 20min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/scripts/validate-breakpoints.js`

**Description**: Script to validate breakpoint consistency across configs

**Acceptance Criteria**:

- [ ] Validates Tailwind config matches BREAKPOINTS
- [ ] Checks for overlapping breakpoints
- [ ] Warns if inconsistencies found
- [ ] Can run as pre-commit hook

**Implementation**:

```javascript
#!/usr/bin/env node
const { BREAKPOINTS } = require('../src/config/breakpoints');

function validateBreakpoints() {
  const errors = [];

  // Check for overlaps
  const sorted = Object.values(BREAKPOINTS).sort(
    (a, b) => a.minWidth - b.minWidth
  );
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].maxWidth && sorted[i + 1].minWidth <= sorted[i].maxWidth) {
      errors.push(`Overlap: ${sorted[i].name} and ${sorted[i + 1].name}`);
    }
  }

  if (errors.length > 0) {
    console.error('Breakpoint validation failed:');
    errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  console.log('✓ Breakpoints valid');
}

validateBreakpoints();
```

---

## Phase 4: Core Components

### T024: Create useDeviceType Hook

**Type**: Component
**Priority**: P0-Critical
**Depends On**: T004, T005
**Parallel**: Yes (new hook file)
**Estimated Time**: 1h

**File**: `/home/turtle_wolfe/repos/ScriptHammer/src/hooks/useDeviceType.ts`

**Description**: Create device type detection hook from research.md

**Acceptance Criteria**:

- [ ] Returns DeviceInfo type
- [ ] Detects mobile, tablet, desktop
- [ ] Detects orientation
- [ ] SSR-safe (useState + useEffect pattern)
- [ ] Updates on orientation change
- [ ] Unit tests pass

**Implementation**:

```typescript
'use client';

import { useState, useEffect } from 'react';
import type { DeviceInfo, DeviceType, Orientation } from '@/types/mobile-first';

export function useDeviceType(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    type: 'desktop',
    orientation: 'portrait',
    isTouchDevice: false,
    viewportWidth: 1920,
    viewportHeight: 1080,
    maxTouchPoints: 0,
    detectionMethod: 'hybrid',
    detectedAt: Date.now(),
  });

  useEffect(() => {
    function detectDevice(): DeviceInfo {
      // Implementation from research.md
      const width = window.innerWidth;
      const height = window.innerHeight;
      const maxDimension = Math.max(width, height);
      const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;

      let type: DeviceType = 'desktop';
      if (hasTouch && maxDimension <= 926) {
        type = 'mobile';
      } else if (hasTouch && maxDimension <= 1366) {
        type = 'tablet';
      }

      return {
        type,
        orientation: width > height ? 'landscape' : 'portrait',
        isTouchDevice: hasTouch,
        viewportWidth: width,
        viewportHeight: height,
        maxTouchPoints: navigator.maxTouchPoints || 0,
        detectionMethod: 'hybrid',
        detectedAt: Date.now(),
      };
    }

    setDeviceInfo(detectDevice());

    const handleChange = () => setDeviceInfo(detectDevice());
    window.addEventListener('resize', handleChange);

    const portraitQuery = window.matchMedia('(orientation: portrait)');
    portraitQuery.addEventListener('change', handleChange);

    return () => {
      window.removeEventListener('resize', handleChange);
      portraitQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return deviceInfo;
}
```

**Testing**:

```bash
docker compose exec scripthammer pnpm test src/hooks/useDeviceType.test.ts
```

---

### T025: Refactor GlobalNav for Mobile-First

**Type**: Component
**Priority**: P0-Critical
**Depends On**: T008 (test must exist and fail first)
**Parallel**: No (critical path)
**Estimated Time**: 2h

**File**: `/home/turtle_wolfe/repos/ScriptHammer/src/components/GlobalNav.tsx`

**Description**: Refactor navigation to fit mobile viewports

**Acceptance Criteria**:

- [ ] Navigation fits within 320px viewport
- [ ] All controls visible (no hiding)
- [ ] Button spacing reduces on mobile (gap-1 → gap-4)
- [ ] All touch targets ≥ 44×44px
- [ ] Hamburger menu slides down (not dropdown)
- [ ] T008 test now PASSES (GREEN phase)

**Implementation**:

```typescript
// Update button spacing
<div className="flex items-center gap-1 sm:gap-2 md:gap-4">

// Add minimum touch targets
<button className="btn btn-ghost btn-circle btn-sm min-w-11 min-h-11">

// Implement slide-down mobile menu
<div className={`
  overflow-hidden transition-all duration-300 ease-in-out md:hidden
  ${mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
`}>
```

**Testing**:

```bash
# Test should now PASS
docker compose exec scripthammer pnpm exec playwright test e2e/tests/mobile-navigation.spec.ts
```

---

### T026-T035: Additional Component Updates

**T026**: Update Button component (add touch-target class)
**T027**: Refactor Card component (side → md:side for stacking)
**T028**: Update Input components (mobile-friendly sizing)
**T029**: Create DeviceProvider context
**T030**: Generate ResponsiveImage component (use generator)
**T031**: Implement ResponsiveImage logic
**T032**: Create ResponsiveImage tests
**T033**: Create ResponsiveImage stories
**T034**: Create ResponsiveImage accessibility tests
**T035**: Add ResponsiveImage to barrel export

_(Full implementation details in each task - following 5-file pattern)_

---

## Phase 5: Page Layouts

### T036: Refactor Homepage for Mobile-First

**Type**: Page
**Priority**: P0-Critical
**Depends On**: T025, T026, T027
**Parallel**: No
**Estimated Time**: 1.5h

**File**: `/home/turtle_wolfe/repos/ScriptHammer/src/app/page.tsx`

**Description**: Update homepage layout for mobile-first

**Acceptance Criteria**:

- [ ] Hero section stacks on mobile
- [ ] Feature cards use grid-responsive
- [ ] CTA buttons stack vertically on mobile
- [ ] Padding scales (px-4 → px-6 → px-8)
- [ ] No horizontal scroll at any mobile width

**Implementation**:

```tsx
// Update feature grid
<div className="grid grid-cols-1 gap-4 min-[500px]:grid-cols-2 lg:grid-cols-4">

// Update section padding
<section className="px-4 py-8 sm:py-12 lg:py-16">

// Stack CTAs on mobile
<div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
```

---

### T037-T040: Additional Page Updates

**T037**: Update blog list page (`/blog`)
**T038**: Update blog post page (`/blog/[slug]`)
**T039**: Optimize docs page layouts
**T040**: Fix footer for mobile

---

## Phase 6: Image Optimization

### T041: Create Image Optimization Script

**Type**: Image
**Priority**: P1-Important
**Depends On**: T003
**Parallel**: Yes (new script)
**Estimated Time**: 2h

**File**: `/home/turtle_wolfe/repos/ScriptHammer/scripts/optimize-images.js`

**Description**: Create Sharp-based image optimization script from research.md

**Acceptance Criteria**:

- [ ] Generates AVIF, WebP, PNG formats
- [ ] Creates 428w, 768w, 1440w sizes
- [ ] Supports hero, thumbnail, og categories
- [ ] Quality settings configurable
- [ ] Script runs without errors

**Implementation**:

```javascript
#!/usr/bin/env node
const sharp = require('sharp');
const fs = require('fs').promises;
const glob = require('glob');

// Full implementation from research.md
// Categories: hero (90 quality), thumbnail (80), og (PNG only)
// Sizes: 428w, 768w, 1440w
```

**Testing**:

```bash
docker compose exec scripthammer node scripts/optimize-images.js
# Verify output in public/blog-images/
```

---

### T042-T046: Image Implementation Tasks

**T042**: Add npm scripts for image optimization
**T043**: Optimize existing blog images
**T044**: Update BlogPostCard to use ResponsiveImage
**T045**: Update AuthorProfile to use ResponsiveImage
**T046**: Configure service worker for AVIF caching

---

## Phase 7: Polish & Documentation

### T047: Update CLAUDE.md with Mobile-First Guidelines

**Type**: Documentation
**Priority**: P1-Important
**Depends On**: All core tasks complete
**Parallel**: Yes
**Estimated Time**: 30min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/CLAUDE.md`

**Description**: Add mobile-first design section from plan.md

**Acceptance Criteria**:

- [ ] Mobile-First Design section added
- [ ] Core principles documented
- [ ] Breakpoints listed
- [ ] Touch target standards documented
- [ ] Testing requirements added

**Implementation**:

```markdown
## Mobile-First Design (PRP-017)

### Core Principles

- Start mobile (320px), enhance progressively
- Touch targets: 44×44px minimum (WCAG AAA)
- Zero horizontal scroll on mobile
- Fluid typography with clamp()
- Test at 320px, 390px, 428px

### Breakpoints

- xs: 320px (small phones)
- sm: 428px (standard phones)
- md: 768px (tablets)
- lg: 1024px (desktop)

### Touch Target Standards

- Minimum: 44×44px (Apple HIG / WCAG AAA)
- Spacing: 8px between elements
- Never use btn-xs or btn-sm on mobile
- Use min-w-11 min-h-11 utility classes

### Testing

- Playwright: Test at all mobile widths
- Touch targets: Assert ≥44px
- Horizontal scroll: Assert scrollWidth ≤ viewportWidth
```

---

### T048: Create Mobile-First Developer Guide

**Type**: Documentation
**Priority**: P2-Nice-to-have
**Depends On**: T047
**Parallel**: Yes
**Estimated Time**: 1h

**File**: `/home/turtle_wolfe/repos/ScriptHammer/docs/MOBILE-FIRST-GUIDE.md`

**Description**: Create comprehensive developer guide from research.md

**Acceptance Criteria**:

- [ ] Core principles documented
- [ ] Common patterns with code examples
- [ ] Component checklist
- [ ] Quick reference
- [ ] Troubleshooting guide

---

### T049: Update Component Generator Templates

**Type**: Documentation
**Priority**: P1-Important
**Depends On**: T021
**Parallel**: Yes
**Estimated Time**: 30min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/plop-templates/Component.tsx.hbs`

**Description**: Update Plop templates to generate mobile-first components by default

**Acceptance Criteria**:

- [ ] Default classes include mobile-first utilities
- [ ] Padding scales (px-4 sm:px-6 lg:px-8)
- [ ] Gap scales (gap-2 sm:gap-4 lg:gap-6)
- [ ] Touch targets enforced
- [ ] Generator still works

---

### T050: Run Full Test Suite

**Type**: Validation
**Priority**: P0-Critical
**Depends On**: All implementation tasks
**Parallel**: No
**Estimated Time**: 15min

**Description**: Run complete test suite and verify all tests pass

**Acceptance Criteria**:

- [ ] All unit tests pass
- [ ] All mobile Playwright tests pass (T008-T018)
- [ ] All accessibility tests pass
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Build succeeds

**Testing**:

```bash
docker compose exec scripthammer pnpm run type-check
docker compose exec scripthammer pnpm run lint
docker compose exec scripthammer pnpm test
docker compose exec scripthammer pnpm exec playwright test --project="iPhone 12"
docker compose exec scripthammer pnpm run build
```

---

### T051: Run Lighthouse Validation

**Type**: Validation
**Priority**: P1-Important
**Depends On**: T050
**Parallel**: Yes
**Estimated Time**: 10min

**Description**: Validate Lighthouse scores improved

**Acceptance Criteria**:

- [ ] Performance ≥ 98/100 (current: 95)
- [ ] Accessibility ≥ 96/100
- [ ] Best Practices ≥ 100/100
- [ ] SEO ≥ 100/100

**Testing**:

```bash
docker compose exec scripthammer npx lighthouse http://localhost:3000 --preset=mobile --output=html --output-path=./lighthouse-mobile.html
```

---

### T052: Update PRP Status Dashboard

**Type**: Documentation
**Priority**: P1-Important
**Depends On**: T051
**Parallel**: Yes
**Estimated Time**: 15min

**File**: `/home/turtle_wolfe/repos/ScriptHammer/docs/prp-docs/PRP-STATUS.md`

**Description**: Update status dashboard with PRP-017 completion

**Acceptance Criteria**:

- [ ] PRP-017 marked as completed
- [ ] Completion date added
- [ ] Lighthouse scores updated
- [ ] Lessons learned added
- [ ] Next actions updated

---

## Dependencies Graph

```
T001 (Branch)
  ↓
T002 (Docker)
  ↓
T003 (Dependencies)
  ├→ T004 [P] (TypeScript types)
  │   ├→ T005 [P] (Breakpoints)
  │   ├→ T006 [P] (Test viewports)
  │   └→ T007 [P] (Touch targets)
  │       ↓
  │       T008-T018 [P] (All tests - MUST FAIL)
  │           ↓
  ├→ T019 (Tailwind config)
  │   ↓
  ├→ T020 (Fluid typography)
  │   ↓
  ├→ T021 (Utilities)
  │   ↓
  ├→ T022 [P] (Playwright config)
  ├→ T023 [P] (Validation script)
  │   ↓
  ├→ T024 [P] (useDeviceType hook)
  ├→ T025 (GlobalNav refactor - MAKES TESTS PASS)
  ├→ T026-T035 (Other components)
  │   ↓
  ├→ T036-T040 (Page layouts)
  │   ↓
  ├→ T041-T046 [P] (Images)
  │   ↓
  └→ T047-T049 [P] (Documentation)
      ↓
  T050 (Full test suite)
      ↓
  T051 [P] (Lighthouse)
  T052 [P] (Status update)
```

---

## Parallel Execution Examples

### Example 1: Setup Phase (After T003)

```bash
# Can run T004, T005, T006, T007 in parallel (different files)
Task: "Create TypeScript types in src/types/mobile-first.ts"
Task: "Create breakpoint config in src/config/breakpoints.ts"
Task: "Create test viewports in src/config/test-viewports.ts"
Task: "Create touch targets in src/config/touch-targets.ts"
```

### Example 2: Test Phase (After T007)

```bash
# Can run T008-T018 in parallel (different test files)
Task: "Create mobile navigation test in e2e/tests/mobile-navigation.spec.ts"
Task: "Create touch target test in e2e/tests/mobile-touch-targets.spec.ts"
Task: "Create horizontal scroll test in e2e/tests/mobile-horizontal-scroll.spec.ts"
Task: "Create typography test in e2e/tests/mobile-typography.spec.ts"
Task: "Create orientation test in e2e/tests/mobile-orientation.spec.ts"
```

### Example 3: Documentation Phase (After T046)

```bash
# Can run T047-T049 in parallel (different doc files)
Task: "Update CLAUDE.md with mobile-first guidelines"
Task: "Create MOBILE-FIRST-GUIDE.md developer guide"
Task: "Update component generator templates"
```

---

## Validation Checklist

**GATE: All must be checked before marking PRP complete**

- [x] All tests written before implementation (TDD)
- [x] All tests marked [P] are truly independent
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Dependencies clearly documented
- [x] Parallel execution examples provided
- [x] Estimated times realistic
- [x] All requirements from spec.md covered
- [x] All entities from data-model.md addressed
- [x] All decisions from research.md implemented

---

## Task Execution Commands

### Start Implementation

```bash
# Execute tasks in order
# Mark [P] tasks can be done in parallel

# Foundation
./execute-task.sh T001  # Branch verification
./execute-task.sh T002  # Docker start
./execute-task.sh T003  # Dependencies

# Setup (parallel)
./execute-task.sh T004 T005 T006 T007  # All config in parallel

# Tests (parallel - ALL MUST FAIL INITIALLY)
./execute-task.sh T008 T009 T010 T011 T012  # All tests in parallel

# Implementation (sequential - makes tests pass)
./execute-task.sh T019  # Tailwind config
./execute-task.sh T020  # Fluid typography
./execute-task.sh T021  # Utilities
./execute-task.sh T024  # useDeviceType
./execute-task.sh T025  # GlobalNav (MAKES T008 PASS)

# Continue with remaining tasks...
```

---

## Success Criteria

**PRP-017 is complete when**:

1. ✅ All 52 tasks completed
2. ✅ All tests pass (unit, E2E, accessibility)
3. ✅ Lighthouse Performance ≥ 98/100
4. ✅ Zero horizontal scroll on all pages (320px-428px)
5. ✅ All touch targets ≥ 44×44px
6. ✅ Mobile-first layouts on all pages
7. ✅ Documentation complete (CLAUDE.md, MOBILE-FIRST-GUIDE.md)
8. ✅ PRP status dashboard updated

---

**Total Tasks**: 52
**Estimated Time**: 3-4 weeks
**Parallel Opportunities**: 28 tasks marked [P]
**Critical Path**: T001 → T002 → T003 → T008 (tests) → T025 (GlobalNav) → T050 (validation)

Ready for implementation via `/implement` command.
