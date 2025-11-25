# Mobile-First Design Standards

All new components and pages MUST follow mobile-first design principles.

## Touch Target Requirements

- **Minimum Size**: 44×44px (WCAG AAA / Apple HIG compliance)
- **Apply to ALL**: Buttons, links, form inputs, interactive icons
- **Implementation**: Use `min-h-11 min-w-11` utility classes (Tailwind: 44px = 11 × 4px)

```tsx
// ✅ CORRECT - Mobile-first touch targets
<button className="btn btn-primary min-h-11 min-w-11">Click Me</button>
<Link href="/page" className="inline-block min-h-11 min-w-11">Link</Link>
<input className="input input-bordered min-h-11" />

// ❌ WRONG - Touch targets too small for mobile
<button className="btn btn-xs">Too Small</button>
<a href="/page" className="text-sm">No touch target</a>
```

## Responsive Spacing Pattern

Use mobile-first progressive enhancement for padding/margins:

```tsx
// Container padding: mobile → tablet → desktop
<div className="px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">

// Vertical rhythm: progressively increase spacing
<header className="mb-6 sm:mb-8 md:mb-10 lg:mb-12">

// Gap spacing: start small, grow larger
<div className="flex gap-2 sm:gap-3 md:gap-4">
```

## Layout Patterns

**Stack on mobile, horizontal on tablet+:**

```tsx
// Cards, forms, navigation
<div className="flex flex-col gap-4 sm:flex-row sm:gap-6">

// Card side-by-side layout
<Card side>  {/* Automatically applies md:card-side - stacks on mobile */}
```

## Breakpoints

Mobile-first breakpoints (defined in `src/config/breakpoints.ts`):

| Breakpoint | Width  | Device             |
| ---------- | ------ | ------------------ |
| xs         | 320px  | iPhone SE          |
| sm         | 428px  | iPhone 14 Pro Max  |
| md         | 768px  | iPad Mini          |
| lg         | 1024px | iPad Pro landscape |
| xl         | 1280px | Large desktop      |

## Device Detection

Use the `useDeviceType` hook for runtime device awareness:

```tsx
import { useDeviceType } from '@/hooks/useDeviceType';

function MyComponent() {
  const device = useDeviceType();

  if (device.category === 'mobile') {
    // Mobile-specific behavior
  }

  // Access: width, height, breakpoint, category, orientation, hasTouch
}
```

## Testing Mobile-First

Playwright is configured with 8 mobile + 2 tablet viewports:

```bash
docker compose exec scripthammer pnpm exec playwright test
# Tests automatically run against all configured mobile viewports
```

## Common Patterns

**Navigation controls:**

```tsx
<div className="flex items-center gap-0.5 sm:gap-1 md:gap-2">
  <button className="btn btn-ghost btn-circle min-h-11 min-w-11">
```

**Blog/article content:**

```tsx
<article className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
  <div className="max-w-3xl">  {/* Constrain line length for readability */}
```

**Modal/dialog close buttons:**

```tsx
<button className="btn btn-circle btn-xs sm:btn-sm min-h-11 min-w-11">✕</button>
```
