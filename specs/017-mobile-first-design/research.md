# Research: Mobile-First Design Implementation

**Date**: 2025-10-01
**Feature**: Mobile-First Design Overhaul (PRP-017)

## Overview

This document consolidates research findings for implementing comprehensive mobile-first responsive design across ScriptHammer. Research covers CSS architecture, touch standards, image optimization, and orientation detection.

---

## 1. Mobile-First CSS Architecture

### Decision

Hybrid Mobile-First Architecture with Tailwind CSS 4 + DaisyUI 5 + Fluid Typography

### Rationale

- Leverages existing Tailwind CSS 4 (v4.1.13) and DaisyUI v5 stack
- DaisyUI 5 made all modifiers responsive by default
- Atomic design pattern maps to progressive enhancement
- Addresses current gaps: no breakpoints below 640px, fixed font sizes

### Key Findings

**Current State Analysis**:

- `globals.css` has good foundation but missing custom mobile breakpoints
- Fixed font sizes via CSS variables (good) but no fluid scaling
- GlobalNav has inconsistent mobile patterns (`md:hidden`, `sm:block`)
- No explicit 320px-428px mobile range support

**Tailwind CSS 4 Approach**:

- Uses `@theme` directive in CSS (not `tailwind.config.ts`)
- Native mobile-first with utility classes
- JIT compilation optimizes bundle size

**Recommended Breakpoints**:

```css
--breakpoint-xs: 20rem; /* 320px - iPhone SE */
--breakpoint-sm: 26.75rem; /* 428px - iPhone 14 Pro Max */
--breakpoint-md: 48rem; /* 768px - Tablets */
--breakpoint-lg: 64rem; /* 1024px - Desktop */
--breakpoint-xl: 80rem; /* 1280px - Large desktop */
--breakpoint-2xl: 96rem; /* 1536px - Extra large */
```

**Fluid Typography**:

```css
/* Format: clamp(min, preferred, max) * scale-factor */
--text-base: calc(
  clamp(0.875rem, 0.8rem + 0.5vw, 1rem) * var(--font-scale-factor)
);
--text-lg: calc(
  clamp(1rem, 0.9rem + 0.5vw, 1.125rem) * var(--font-scale-factor)
);
--text-2xl: calc(
  clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem) * var(--font-scale-factor)
);
```

### Alternatives Considered

**Desktop-First (Rejected)**:

- Goes against Tailwind philosophy
- Larger initial bundle for mobile
- Requires constant overrides

**Separate CSS Files (Rejected)**:

- Maintenance nightmare with 5-file component pattern
- Breaks DaisyUI theming
- Violates "no technical debt" principle

**CSS-in-JS (Rejected)**:

- Conflicts with Tailwind CSS 4
- Runtime performance penalty
- Breaks Storybook integration

**Container Queries (Future)**:

- Tailwind CSS 4 supports them
- Excellent for component-level responsiveness
- Recommend for Sprint 4
- Use sparingly until 95%+ browser support

### Implementation Pattern

**Navigation Pattern**:

```tsx
// Mobile hamburger → Desktop full nav
<nav className="sticky top-0">
  <button className="md:hidden">Hamburger</button>
  <ul className="hidden md:flex">Desktop nav</ul>
</nav>
```

**Layout Pattern**:

```tsx
// Stack → Row
<div className="flex flex-col sm:flex-row">

// 1 → 2 → 4 columns
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
```

**Typography Pattern**:

```tsx
// Small → Large
<h1 className="text-2xl sm:text-4xl lg:text-6xl">
```

### Performance Impact

**Expected Improvements**:

- Mobile bundle: 150KB → 80KB (47% reduction)
- FCP on mobile: 30-40% faster
- Lighthouse mobile: 95 → 98-100

---

## 2. Touch Target Standards

### Decision

Target 44×44px minimum (WCAG AAA + Apple HIG + Android Material Design)

### Rationale

**Standards Alignment**:

- WCAG 2.2 Level AA: 24×24px minimum (legal baseline)
- WCAG 2.2 Level AAA: 44×44px minimum (recommended)
- Apple HIG: 44×44pt (44px on web)
- Android Material Design: 48×48dp (~48px)

**Research-Backed Ergonomics**:

- Minimum for accurate selection: 1cm × 1cm (11.6mm)
- Top of screen: 11mm minimum
- Bottom of screen: 12mm minimum
- 44×44px hits the ergonomic sweet spot

**ScriptHammer Context**:

- Existing Playwright tests only check 20px (too small!)
- PRP-017 spec requires 44×44px (FR-003, FR-017)
- DaisyUI button audit needed:
  - `btn-xs`: 24px (TOO SMALL)
  - `btn-sm`: 32px (TOO SMALL)
  - `btn`: 48px (GOOD)
  - `btn-lg`: 64px (GOOD)

### Implementation Pattern

**Tailwind Minimum Sizing**:

```tsx
// Direct sizing (44px = 11 units in Tailwind)
<button className="min-w-11 min-h-11 px-4 py-2">
  Click Me
</button>

// Responsive - larger on desktop
<button className="min-w-11 min-h-11 md:min-w-fit md:min-h-fit px-4 py-2">
  Responsive Button
</button>
```

**Icon Buttons with Expanded Hit Area**:

```tsx
// Visual: 32x32, Touch area: 44x44
<button className="relative h-8 w-8 after:absolute after:inset-[-6px] after:content-['']">
  <Icon />
</button>
```

**Spacing Between Targets**:

```tsx
// Minimum 8px gap (gap-2 in Tailwind)
<div className="flex gap-2">
  <button className="min-h-11 min-w-11">Button 1</button>
  <button className="min-h-11 min-w-11">Button 2</button>
</div>
```

**Constrained Spaces (320px)**:

```tsx
// Shrink visual but maintain touch target
<button className="relative flex h-10 w-10 items-center justify-center before:absolute before:inset-[-2px] before:content-['']">
  <Icon className="h-6 w-6" />
</button>
```

### Testing Strategy

**Playwright Test Update**:

```typescript
// Update from 20px to 44px minimum
const MINIMUM_TOUCH_TARGET = 44;
const TOLERANCE = 1;

expect(box.height).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET - TOLERANCE);
expect(box.width).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET - TOLERANCE);
```

**Component Tests**:

```typescript
it('should meet minimum touch target size (44x44px)', () => {
  const { getByRole } = render(<Button>Touch Test</Button>);
  const button = getByRole('button');
  const rect = button.getBoundingClientRect();

  expect(rect.height).toBeGreaterThanOrEqual(44);
  expect(rect.width).toBeGreaterThanOrEqual(44);
});
```

**Visual Regression**:

- Inject visualization script to highlight touch targets
- Color code: green = compliant, red = too small
- Screenshot for documentation

### Key Takeaways

1. Never use DaisyUI `btn-xs` or `btn-sm` on touch interfaces
2. Use `min-w-11 min-h-11` as standard pattern
3. 8px minimum spacing between elements (`gap-2`)
4. Visual can be smaller than hit area (use pseudo-elements)
5. Update Playwright threshold from 20px to 44px

---

## 3. Responsive Image Optimization

### Decision

Manual Optimization with Sharp + HTML `<picture>` Element

### Rationale

**Current ScriptHammer Setup**:

- Next.js 15.5.2 with `output: 'export'` (static site)
- Images set to `unoptimized: true` (no optimization)
- Sharp 0.34.4 already in devDependencies
- All images currently PNG format (~1-3 MB each)
- Lighthouse Performance: 95/100 (can improve)

**Why Next.js Image Doesn't Work**:

- Image Optimization API requires a server
- Static export generates pure HTML/CSS/JS
- `unoptimized: true` bypasses all optimization

**Why Manual Optimization Wins**:

- Maximum compression: AVIF 50% smaller than JPEG, WebP 25-34% smaller
- Zero runtime cost (build-time only)
- Better control per image category
- Works perfectly with GitHub Pages
- Only ~20 images, manual optimization is practical

**Browser Support (2025)**:

- AVIF: 93.8% (Chrome 85+, Firefox 93+, Safari 16+)
- WebP: 95.29% (all major browsers)
- PNG: 100% (universal fallback)

### Alternatives Considered

**next-image-export-optimizer (Rejected)**:

- Adds dependency complexity
- Less control than manual optimization
- Default WebP-only (must configure AVIF)
- Overkill for ~20 images

**External CDN (Cloudinary/ImageKit) (Rejected)**:

- Monthly costs ($25-99+)
- Vendor lock-in
- Overkill for small projects
- GitHub Pages is free

**Keep unoptimized: true (Rejected)**:

- 1-3 MB images on mobile
- Poor LCP scores
- Users leave before content loads

### Implementation Approach

**Optimization Script** (`scripts/optimize-images.js`):

```javascript
// Generates AVIF, WebP, PNG at multiple sizes
// Categories: hero (90 quality), thumbnail (80 quality), og (PNG only)
// Sizes: 428w (mobile), 768w (tablet), 1440w (desktop)
```

**Responsive Image Component**:

```tsx
<ResponsiveImage
  baseName="countdown-banner"
  dir="blog-images/countdown-timer-tutorial"
  alt="Countdown timer tutorial"
  category="hero"
  loading="eager"
  fetchPriority="high"
  sizes="100vw"
/>
```

**Generated HTML**:

```html
<picture>
  <source
    type="image/avif"
    srcset="...428w.avif 428w, ...768w.avif 768w, ...1440w.avif 1440w"
    sizes="100vw"
  />
  <source
    type="image/webp"
    srcset="...428w.webp 428w, ...768w.webp 768w, ...1440w.webp 1440w"
    sizes="100vw"
  />
  <img
    src="...428w.png"
    srcset="...428w.png 428w, ...768w.png 768w, ...1440w.png 1440w"
    sizes="100vw"
    alt="..."
    loading="eager"
    fetchpriority="high"
  />
</picture>
```

### Performance Impact

**File Size Comparisons**:
| Image Type | Original PNG | AVIF (85%) | WebP (85%) | Savings |
|-----------|--------------|------------|------------|---------|
| Hero (1440w) | 1.2 MB | 180 KB | 280 KB | 85% |
| Thumbnail (768w) | 450 KB | 80 KB | 120 KB | 82% |
| Mobile (428w) | 180 KB | 35 KB | 50 KB | 80% |

**Expected Lighthouse Improvements**:

- Performance: 95 → 98-100 (+3-5 points)
- LCP: -52% faster (hero images)
- Total transfer size: -71% (image payload)

**Mobile 3G Impact**:

- Current: 1.2 MB = ~13 seconds
- Optimized: 180 KB AVIF = ~2 seconds
- **85% faster load time**

### Directory Structure

```
public/
├── blog-images-source/          # Source images (NOT in git)
│   └── countdown-timer-tutorial/
│       └── countdown-banner.png  # High-res original
│
└── blog-images/                  # Optimized (in git)
    └── countdown-timer-tutorial/
        ├── countdown-banner-428w.avif
        ├── countdown-banner-428w.webp
        ├── countdown-banner-428w.png
        ├── countdown-banner-768w.avif
        ├── countdown-banner-768w.webp
        ├── countdown-banner-768w.png
        ├── countdown-banner-1440w.avif
        ├── countdown-banner-1440w.webp
        └── countdown-banner-1440w.png
```

### LCP Optimization

**Critical Best Practices**:

1. Use `loading="eager"` for LCP images (default)
2. Use `fetchPriority="high"` to prioritize
3. NEVER lazy load LCP images (15% regression)
4. Preload if above fold:

```html
<link
  rel="preload"
  as="image"
  href="/blog-images/hero-1440w.avif"
  type="image/avif"
  imagesrcset="..."
  imagesizes="100vw"
/>
```

### Migration Path

**Phase 1: Setup** (1 hour)

- Create optimization script
- Create ResponsiveImage component (5-file pattern)
- Add npm scripts
- Update .gitignore

**Phase 2: Optimize** (2 hours)

- Copy images to source directory
- Run optimization script
- Verify quality
- Commit optimized images

**Phase 3: Update Components** (1 hour)

- Replace next/image in BlogPostCard
- Replace next/image in other components

**Phase 4: Test & Measure** (1 hour)

- Build production
- Run Lighthouse
- Compare metrics

**Total Time**: ~5 hours for complete migration

---

## 4. Orientation Detection

### Decision

Hybrid CSS Media Query + JavaScript Device Detection

### Rationale

**The Problem**:

- Width-only breakpoints fail: iPhone 12 landscape (844x390) exceeds mobile breakpoints but shouldn't use tablet styles
- Orientation alone is insufficient: doesn't distinguish mobile landscape from tablet portrait
- Pure JavaScript causes SSR hydration mismatches
- WCAG 1.3.4 mandates supporting both orientations (no forced orientation)

**Why Hybrid Approach**:

1. Detect physical device type (mobile vs tablet vs desktop)
2. Combine device type with orientation
3. SSR-compatible with sensible defaults
4. Works with foldables, tablets, and mobile landscape

### Implementation Pattern

**CSS Media Queries**:

```css
/* Mobile (both orientations) */
@media (max-width: 926px) {
  /* Includes iPhone 12 landscape at 844px */
}

/* Mobile landscape specific */
@media (max-width: 926px) and (orientation: landscape) {
  /* Adjust spacing, but stay mobile layout */
}

/* Tablet (requires width AND height) */
@media (min-width: 768px) and (min-height: 600px) {
  /* True tablet - has both dimensions */
}
```

**JavaScript Hook** (`useDeviceType`):

```typescript
export function useDeviceType(): DeviceInfo {
  // Detects device type based on:
  // - Max touch points (mobile: 1-5, tablet: 5-10)
  // - Viewport dimensions + orientation
  // - User agent (fallback)
  // Returns: { type, orientation, isTouchDevice, viewportWidth, viewportHeight }
}
```

**Tailwind Configuration**:

```typescript
screens: {
  'sm': '640px',
  'md': '927px',  // Excludes iPhone 12 landscape (844px)
  'lg': '1280px',

  // Custom orientation breakpoints
  'mobile-landscape': { 'raw': '(max-width: 926px) and (orientation: landscape)' },
  'tablet-portrait': { 'raw': '(min-width: 768px) and (max-width: 1024px) and (orientation: portrait)' },
}
```

### Device Detection Logic

**Max Dimension Approach**:

```typescript
const maxDimension = Math.max(width, height);
const minDimension = Math.min(width, height);

if (hasTouch && maxDimension <= 926) {
  type = 'mobile'; // Covers iPhone 12 landscape (844px)
} else if (hasTouch && maxDimension <= 1366 && minDimension >= 600) {
  type = 'tablet'; // iPad Mini: 768x1024, iPad Pro: 1024x1366
} else {
  type = 'desktop';
}
```

### Testing Strategy

**Playwright Orientation Tests**:

```typescript
// iPhone 12 portrait (390x844)
test('iPhone 12 portrait - should use mobile styles', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPhone 12'] });
  // Verify mobile layout active
});

// iPhone 12 landscape (844x390)
test('iPhone 12 landscape - should STILL use mobile styles', async ({
  browser,
}) => {
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    viewport: { width: 844, height: 390 },
  });
  // Verify mobile layout persists (NOT switching to tablet)
});

// iPad Mini portrait (768x1024)
test('iPad Mini portrait - should use tablet styles', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPad Mini'] });
  // Verify tablet layout
});
```

### UX Considerations

**Best Practices**:

1. DO NOT force portrait orientation (WCAG 1.3.4 violation)
2. DO optimize for both orientations
3. DO provide visual hints for landscape adjustments
4. DO test with real devices

**Mobile Landscape Adjustments**:

```tsx
// Adjust spacing, not layout paradigm
<div
  className={` ${type === 'mobile' ? 'px-4 py-6' : ''} ${type === 'mobile' && orientation === 'landscape' ? 'px-6 py-3' : ''} `}
>
  {/* More horizontal padding, less vertical (screen is shorter) */}
</div>
```

### SSR Compatibility

**Preventing Hydration Errors**:

```typescript
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

// Render mobile during SSR, update after hydration
if (!mounted) {
  return <MobileVersion />;
}

return deviceInfo.type === 'mobile' ? <MobileVersion /> : <DesktopVersion />;
```

### Breakpoint Philosophy

1. Use 927px (not 768px) as tablet breakpoint to exclude iPhone 12 landscape
2. Add height constraints: `(min-width: 768px) and (min-height: 600px)`
3. Create custom Tailwind breakpoints: `mobile-landscape`, `tablet-portrait`
4. Physical device type determines UI mode, not viewport width alone

---

## Summary & Recommendations

### Priority 1: CSS Architecture

- Update `globals.css` with custom breakpoints (xs: 320px, sm: 428px)
- Implement fluid typography with clamp()
- Create mobile-first utility classes
- Update component generator templates

### Priority 2: Touch Targets

- Update Playwright tests to 44px minimum
- Audit DaisyUI button usage (no btn-xs/btn-sm on mobile)
- Add Tailwind `touch` utility classes
- Create component accessibility tests

### Priority 3: Image Optimization

- Create optimization script with Sharp
- Build ResponsiveImage component (5-file pattern)
- Optimize existing images (AVIF + WebP + PNG)
- Update BlogPostCard and other image consumers

### Priority 4: Orientation Detection

- Create `useDeviceType` hook
- Update Tailwind config with orientation breakpoints
- Add Playwright orientation tests
- Ensure WCAG 1.3.4 compliance

### Expected Overall Impact

**Performance**:

- Lighthouse: 95 → 98-100
- LCP: -52% faster
- Bundle: -47% smaller on mobile
- Total image payload: -71%

**User Experience**:

- 3x faster on 3G/4G
- Touch-friendly interactions (44x44px)
- Proper mobile layouts (not cramped desktop)
- Works in both portrait and landscape

**Development**:

- Clear mobile-first patterns
- Automated testing for violations
- Component generator produces mobile-first code
- No technical debt

### Migration Timeline

**Week 1**: Foundation (CSS architecture + touch targets)
**Week 2**: Core Components (navigation, cards, buttons)
**Week 3**: Pages (homepage, blog, docs)
**Week 4**: Polish (images, orientation, testing)

**Total Effort**: 3-4 weeks for complete mobile-first transformation
