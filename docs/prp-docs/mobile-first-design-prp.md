# PRP-017: Mobile-First Design Overhaul

## Problem Statement

**Date**: 2025-10-01
**Status**: Proposed
**Priority**: P0 (Critical - affects user experience)

### The Issue

The current mobile design looks like **desktop crammed onto a phone screen** rather than a purposeful mobile-first experience. Users on mobile devices see:

- Navigation header wider than viewport (causing horizontal scroll)
- Components that don't adapt properly to narrow screens
- Touch targets too small for mobile interaction
- Typography sized for desktop, not optimized for mobile reading
- Overall layout that fights against mobile constraints instead of embracing them

This is a **holistic design problem**, not just a navbar issue. The entire site needs mobile-first thinking applied consistently.

## Core Problem

**Mobile was treated as an afterthought, not the primary design target.**

The site appears to have been designed desktop-first with responsive breakpoints added later, rather than being built mobile-first and progressively enhanced for larger screens.

## Requirements

### R1: Mobile-First Development Approach

- Design and build for mobile screens FIRST (320px-428px)
- Progressively enhance for tablet (768px+) and desktop (1024px+)
- Test on mobile viewport BEFORE desktop during development
- Ensure zero horizontal scroll at any mobile width

### R2: Navigation Optimization

- Nav header must fit within smallest reasonable mobile viewport (320px)
- Touch targets meet minimum 44x44px (Apple HIG) for interactive elements
- Consider moving some controls into hamburger menu on narrow screens
- Logo, menu, and essential controls always accessible

### R3: Typography & Readability

- Body text ≥16px on mobile for comfortable reading without zoom
- Line height ≥1.5 for readability
- Headings scale appropriately at each breakpoint
- Proper text hierarchy visible on mobile

### R4: Layout & Spacing

- Components adapt to mobile constraints (don't just shrink desktop layout)
- Appropriate padding/margins for touch interaction
- Cards, lists, grids reflow for vertical mobile scrolling
- Images responsive and properly sized

### R5: Touch Interaction

- All interactive elements ≥44x44px tap target
- Adequate spacing between tappable elements
- No reliance on hover states (mobile has no hover)
- Swipe/touch gestures where appropriate

### R6: Performance

- Fast load on mobile networks (3G/4G)
- Minimal layout shift on mobile
- Efficient image loading for mobile

## Success Criteria

### SC1: Zero Horizontal Scroll

- No horizontal scroll on ANY page at mobile widths (320px-428px)
- Verified across homepage, blog list, blog posts, docs
- Test passes on iPhone SE (375px), iPhone 12 (390px), iPhone 14 Pro Max (428px)

### SC2: Proper Mobile Navigation

- Nav fits within viewport at all mobile widths
- All controls accessible and tappable
- Hamburger menu works smoothly
- No overlapping or cut-off elements

### SC3: Readable Typography

- Body text comfortable to read on mobile without zooming
- Proper text hierarchy clear on small screens
- Code blocks scroll internally, don't break layout

### SC4: Touch-Friendly Interactions

- All buttons/links meet 44x44px minimum
- Adequate spacing between interactive elements
- Dropdowns/modals work well with touch

### SC5: Automated Testing

- Playwright tests verify mobile-first requirements
- Tests fail if horizontal scroll introduced
- Tests catch touch target violations
- Visual regression tests for mobile layouts

### SC6: Design System Documentation

- Mobile-first breakpoint strategy documented
- Component mobile patterns catalogued
- CLAUDE.md updated with mobile-first guidance

## Technical Design

### Phase 1: Audit & Measure (Investigation)

**Goal**: Understand current state and identify all mobile issues

1. **Test at multiple mobile widths**:
   - 320px (iPhone SE, small Android)
   - 375px (iPhone 13 Mini)
   - 390px (iPhone 12/13/14)
   - 428px (iPhone 14 Pro Max)

2. **Catalog issues across pages**:
   - Homepage
   - Blog list page
   - Blog post page
   - Docs page
   - Navigation (all pages)

3. **Identify patterns**:
   - Which components break at which widths?
   - Common layout issues?
   - Typography problems?
   - Touch target failures?

### Phase 2: Navigation Fix (Quick Win)

**Priority**: Fix most visible issue first

1. **Analyze nav button layout**:
   - Current: Logo + Hamburger + FontSize + Colorblind + Theme (4-5 buttons)
   - Measure actual space needed vs available

2. **Implement solutions**:
   - Option A: Hide font/colorblind controls on narrow screens (show in hamburger)
   - Option B: Make buttons truly shrinkable with `min-w-0`
   - Option C: Combination approach with breakpoints

3. **Test at all widths**: Ensure nav works 320px-428px

### Phase 3: Component Mobile Patterns

**Goal**: Fix layout components holistically

1. **Blog post layout**:
   - Featured image sizing
   - Code block containment
   - Metadata display
   - Share buttons
   - Footer visibility

2. **Homepage**:
   - Hero section
   - Feature cards
   - Call-to-action buttons

3. **Shared components**:
   - Cards (various types)
   - Lists
   - Grids

### Phase 4: Typography System

**Goal**: Mobile-first text sizing

1. **Define mobile-first scale**:
   - Base mobile sizes (12px-20px)
   - Desktop enhancements (14px-24px)
   - Proper line-height ratios

2. **Apply systematically**:
   - Update BlogContent typography
   - Fix heading hierarchy
   - Ensure readable body text

### Phase 5: Automated Testing

**Goal**: Prevent regressions

1. **Playwright mobile tests**:
   - Horizontal scroll detection
   - Touch target validation
   - Typography checks
   - Visual regression baselines

2. **CI integration**:
   - Run mobile tests on every PR
   - Fail if mobile-first violations detected

### Phase 6: Documentation

**Goal**: Embed mobile-first culture

1. **Update CLAUDE.md**:
   - Mobile-first principles
   - Breakpoint strategy
   - Testing requirements

2. **Component patterns**:
   - Document mobile-first component patterns
   - Add to Storybook with mobile viewports

## Implementation Strategy

### Use SpecKit Workflow

This PRP follows the PRP/SpecKit methodology:

1. **This PRP** defines the problem and high-level approach
2. **`/specify`** will generate detailed specification
3. **`/plan`** will create implementation plan with technical details
4. **`/tasks`** will break down into actionable tasks
5. **`/implement`** will execute the plan

### Branch Strategy

```bash
./scripts/prp-to-feature.sh mobile-first-design 017
```

Creates branch: `017-mobile-first-design`

### Development Approach

**Mobile-first at every step**:

1. Test changes at 320px FIRST
2. Verify at 390px (most common iPhone)
3. Check tablet breakpoint (768px)
4. Finally verify desktop (1024px+)

**Never**:

- Design on desktop and hope it works on mobile
- Use fixed widths that don't adapt
- Assume desktop behavior translates to mobile

## Risks & Mitigations

| Risk                                        | Impact | Mitigation                                       |
| ------------------------------------------- | ------ | ------------------------------------------------ |
| Breaking desktop layout while fixing mobile | High   | Test at all breakpoints, visual regression tests |
| Taking too long (many components to fix)    | Medium | Phase approach, fix nav first for quick win      |
| Introducing new issues while fixing         | Medium | Comprehensive test suite, staged rollout         |
| Not catching all mobile issues in audit     | Medium | Test on real devices, user feedback loop         |

## Lessons Learned (From PRP-016)

**What NOT to do**:

- Don't rely on DOM queries for visual issues
- Don't make blind fixes based on automated tests
- Don't test on only one device/width

**What TO do**:

- Test on real devices or accurate emulation
- Use visual verification (human eyes + screenshots)
- Test across multiple mobile widths
- Fix holistically, not with band-aids

## Out of Scope

The following are NOT part of this PRP:

- Desktop-specific features
- Performance optimizations beyond mobile basics
- Advanced PWA features
- Tablet-specific optimizations (unless easy win)

## Related PRPs

- PRP-016: Automated Visual Testing - methodology for testing
- Future: PRP for tablet optimization (if needed)

## References

- [Mobile-First Design Principles](https://web.dev/mobile-first/)
- [Apple Human Interface Guidelines - Touch Targets](https://developer.apple.com/design/human-interface-guidelines/ios/visual-design/adaptivity-and-layout/)
- [Responsive Web Design Basics](https://web.dev/responsive-web-design-basics/)
- [Mobile UX Best Practices](https://web.dev/mobile-ux/)

---

**Author**: TortoiseWolfe (Human) + Claude Code (Assistant)
**Priority**: P0 - Critical UX issue affecting all mobile users
**Estimated Effort**: 1-2 days
**Value**: Vastly improved mobile user experience
