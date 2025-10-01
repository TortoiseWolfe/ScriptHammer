# Quickstart: Mobile-First Design Implementation

**Feature**: PRP-017 Mobile-First Design Overhaul
**Audience**: Developers implementing mobile-first responsive design
**Time to Complete**: 30 minutes (reading + first test)

---

## Prerequisites

- Docker environment running (`docker compose up`)
- Development server active (`:3000`)
- Basic understanding of Tailwind CSS
- Familiarity with Playwright testing

---

## Quick Start Steps

### 1. Verify Current Mobile Issues (5 minutes)

**Goal**: Confirm the problem exists before fixing it.

```bash
# Open development server on mobile viewport
# Use browser DevTools device emulation: iPhone 12 (390x844)

# Visit these pages and observe issues:
open http://localhost:3000/                    # Homepage
open http://localhost:3000/blog                # Blog list
open http://localhost:3000/blog/countdown-timer-react-tutorial  # Blog post
```

**Expected Issues to Observe**:

- [ ] Navigation header wider than viewport (horizontal scroll)
- [ ] Text too small to read without zooming
- [ ] Touch targets smaller than 44x44px
- [ ] Components don't adapt to narrow screen
- [ ] Desktop layout crammed onto mobile

**Screenshot for reference**:

```bash
# Take screenshot of current state
docker compose exec scripthammer pnpm exec playwright test e2e/screenshot-current-state.spec.ts
```

---

### 2. Run Existing Mobile Tests (5 minutes)

**Goal**: Establish baseline test failures.

```bash
# Run mobile UX tests (these should currently fail or show issues)
docker compose exec scripthammer pnpm exec playwright test e2e/tests/blog-mobile-ux.spec.ts --project="iPhone 12"

# Expected failures:
# - Touch targets only 20px minimum (not 44px)
# - Horizontal scroll detected on some pages
# - Navigation controls overflow viewport
```

**Document current test status**:

```bash
# Generate test report
docker compose exec scripthammer pnpm exec playwright show-report

# Note: Save this report to compare against post-implementation
```

---

### 3. Update Tailwind Configuration (10 minutes)

**Goal**: Add mobile-first breakpoints and utilities.

**3a. Update `globals.css`** with custom breakpoints:

```bash
# Open globals.css
code src/styles/globals.css
```

Add at the top (after imports):

```css
@theme {
  /* Mobile-first breakpoints */
  --breakpoint-xs: 20rem; /* 320px */
  --breakpoint-sm: 26.75rem; /* 428px */
  --breakpoint-md: 48rem; /* 768px */
  --breakpoint-lg: 64rem; /* 1024px */
}
```

**3b. Create mobile-first utilities**:

```bash
# Create new file
touch src/styles/mobile-first-utilities.css
```

Add utility patterns:

```css
/* Mobile-first layout patterns */

/* Container: Full width → constrained */
.container-mobile-first {
  @apply w-full px-4 sm:px-6 lg:mx-auto lg:max-w-7xl lg:px-8;
}

/* Touch targets: Minimum 44px */
.touch-target {
  @apply min-h-[44px] min-w-[44px];
}

/* Stack → Row */
.stack-to-row {
  @apply flex flex-col gap-4 sm:flex-row sm:gap-6 lg:gap-8;
}
```

**3c. Import utilities in `globals.css`**:

```css
@import './mobile-first-utilities.css';
```

**3d. Verify build**:

```bash
# Restart dev server to pick up changes
docker compose restart scripthammer

# Check for CSS errors
docker compose logs scripthammer | grep -i error
```

---

### 4. Fix First Component: Navigation (5 minutes)

**Goal**: Make navigation fit in mobile viewport.

**4a. Locate navigation component**:

```bash
code src/components/GlobalNav.tsx
```

**4b. Apply quick fix for button sizing**:

Find this line (around line 161):

```tsx
<div className="flex items-center gap-4">
```

Change to:

```tsx
<div className="flex items-center gap-1 sm:gap-2 md:gap-4">
```

**4c. Add minimum touch target to buttons**:

Find button elements and add `min-w-11 min-h-11`:

```tsx
<button className="btn btn-ghost btn-circle btn-sm min-w-11 min-h-11">
```

**4d. Test the fix**:

```bash
# Open in browser at 320px width (narrowest supported)
# DevTools → Responsive Design Mode → 320x568

# Verify:
# - Navigation fits within viewport
# - No horizontal scroll
# - All buttons still clickable
```

---

### 5. Run Mobile Tests Again (5 minutes)

**Goal**: Verify improvements with automated tests.

```bash
# Run mobile tests again
docker compose exec scripthammer pnpm exec playwright test e2e/tests/blog-mobile-ux.spec.ts --project="iPhone 12"

# Expected improvements:
# - Fewer horizontal scroll violations
# - Navigation fits viewport
# - Touch targets closer to 44px (still need full fix)
```

**Compare before/after screenshots**:

```bash
# Take new screenshots
docker compose exec scripthammer pnpm exec playwright test e2e/screenshot-after-quickfix.spec.ts

# Visual diff should show:
# - Tighter button spacing
# - Navigation within viewport bounds
```

---

## Validation Checklist

After completing quickstart, verify these outcomes:

### Visual Verification (Manual)

- [ ] Open site at 320px width - navigation fits within viewport
- [ ] Open site at 390px width (iPhone 12) - no horizontal scroll
- [ ] Open site at 428px width (iPhone 14 Pro Max) - components adapt properly
- [ ] Rotate device to landscape - layout still works

### Automated Tests (Playwright)

- [ ] Run `pnpm exec playwright test --project="iPhone 12"`
- [ ] Horizontal scroll test passes on homepage
- [ ] Touch target test shows improvement (moving toward 44px)

### Build Verification

- [ ] Run `docker compose exec scripthammer pnpm run build`
- [ ] Build completes without CSS errors
- [ ] Static export generates successfully

### Accessibility Check

- [ ] Run `docker compose exec scripthammer pnpm run test:a11y:dev`
- [ ] No new accessibility violations introduced
- [ ] Touch targets flagged for improvement (expected until full implementation)

---

## Next Steps

After completing this quickstart, you've:

1. ✅ Identified current mobile design issues
2. ✅ Established baseline test metrics
3. ✅ Added mobile-first Tailwind configuration
4. ✅ Fixed critical navigation overflow
5. ✅ Verified improvements with tests

**Continue with full implementation**:

```bash
# Generate full task list
# (This will be created by /tasks command)

# Implement remaining tasks:
# - Update all components with mobile-first patterns
# - Implement responsive image optimization
# - Add device orientation detection
# - Create comprehensive mobile tests
# - Update all pages for mobile-first layouts
```

**Review full plan**:

```bash
# Read implementation plan
cat specs/017-mobile-first-design/plan.md

# Review research findings
cat specs/017-mobile-first-design/research.md

# Check data model
cat specs/017-mobile-first-design/data-model.md
```

---

## Troubleshooting

### Issue: "Navigation still overflows at 320px"

**Solution**: Check button padding and gap spacing:

```tsx
// Reduce gaps further on xs breakpoint
<div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 lg:gap-4">
```

### Issue: "Touch targets still too small"

**Solution**: The quickstart only partially addresses this. Full implementation includes:

- Updating all button components
- Adding `touch-target` utility class
- Auditing DaisyUI button sizes
- Removing `btn-sm` and `btn-xs` from mobile

### Issue: "CSS changes not appearing"

**Solution**:

```bash
# Hard restart
docker compose down
docker compose up

# Clear browser cache
# DevTools → Network → Disable cache (checkbox)
```

### Issue: "Tailwind classes not recognized"

**Solution**:

```bash
# Verify Tailwind CSS 4 is installed
docker compose exec scripthammer pnpm list tailwindcss

# Should show: tailwindcss@4.1.13

# Restart build process
docker compose restart scripthammer
```

### Issue: "Tests fail with different errors"

**Solution**:

```bash
# Update Playwright browsers
docker compose exec scripthammer pnpm exec playwright install

# Clear test cache
rm -rf test-results/
rm -rf playwright-report/

# Run tests again
docker compose exec scripthammer pnpm exec playwright test
```

---

## Success Criteria

You've successfully completed the quickstart if:

1. **Visual**: Site looks significantly better on mobile (320px-428px)
2. **Functional**: Navigation fits within viewport without horizontal scroll
3. **Testable**: Playwright mobile tests show measurable improvement
4. **Buildable**: Project builds successfully with new CSS configuration

**Performance baseline**:

```bash
# Run Lighthouse on mobile
docker compose exec scripthammer npx lighthouse http://localhost:3000 --preset=mobile --quiet

# Current: Performance 95/100
# Target: Performance 98-100/100 (after full implementation)
```

---

## Quick Reference

### Key Files Modified

- `src/styles/globals.css` - Breakpoint configuration
- `src/styles/mobile-first-utilities.css` - Utility classes
- `src/components/GlobalNav.tsx` - Navigation fix

### Key Commands

```bash
# Start development
docker compose up

# Run mobile tests
docker compose exec scripthammer pnpm exec playwright test --project="iPhone 12"

# Build production
docker compose exec scripthammer pnpm run build

# Run accessibility tests
docker compose exec scripthammer pnpm run test:a11y:dev
```

### Key Breakpoints

- **xs**: 320px - Small phones (minimum supported)
- **sm**: 428px - Standard phones
- **md**: 768px - Tablets
- **lg**: 1024px - Desktop

### Key Standards

- **Touch targets**: 44×44px minimum (WCAG AAA / Apple HIG)
- **Text size**: 16px minimum on mobile
- **Spacing**: 8px minimum between interactive elements
- **Viewport**: Zero horizontal scroll at all mobile widths

---

## Resources

- **Full Plan**: `specs/017-mobile-first-design/plan.md`
- **Research**: `specs/017-mobile-first-design/research.md`
- **Data Model**: `specs/017-mobile-first-design/data-model.md`
- **PRP**: `docs/prp-docs/mobile-first-design-prp.md`
- **Spec**: `specs/017-mobile-first-design/spec.md`

**External Resources**:

- Tailwind CSS Responsive Design: https://tailwindcss.com/docs/responsive-design
- Apple HIG Touch Targets: https://developer.apple.com/design/human-interface-guidelines/inputs/touchscreen-gestures/
- WCAG 2.2 Target Size: https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced

---

**Time Estimate**: 30 minutes for quickstart
**Full Implementation**: 3-4 weeks (see `tasks.md` when generated)

Ready to continue with full implementation? Run `/tasks` to generate the complete task breakdown.
