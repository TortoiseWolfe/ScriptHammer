# Colorblind Mode Quick Start Guide

## Overview

This guide will walk you through implementing and testing the colorblind mode feature following TDD principles.

## Prerequisites

- Node.js 20+
- pnpm 10.16.1
- Docker (optional but recommended)
- Basic understanding of React Context and CSS filters

## Step 1: Run Failing Tests First (RED Phase)

### Create Component Test

```bash
# Create test file first (TDD)
touch src/components/atomic/ColorblindToggle/ColorblindToggle.test.tsx
```

```typescript
// ColorblindToggle.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ColorblindToggle } from './ColorblindToggle';

describe('ColorblindToggle', () => {
  it('should render toggle button', () => {
    render(<ColorblindToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should show colorblind modes dropdown', () => {
    render(<ColorblindToggle />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByText('Deuteranopia')).toBeInTheDocument();
  });
});
```

### Run Test (Should Fail)

```bash
pnpm test ColorblindToggle
# Expected: Test fails - component doesn't exist
```

## Step 2: Create Minimal Implementation (GREEN Phase)

### Generate Component Structure

```bash
# Use Plop generator
pnpm run generate:component
# Name: ColorblindToggle
# Category: atomic
# Has props: Yes
```

### Create Utilities

```typescript
// src/utils/colorblind.ts
export enum ColorblindType {
  NONE = 'none',
  PROTANOPIA = 'protanopia',
  DEUTERANOPIA = 'deuteranopia',
  // ... other types
}

export const colorblindFilters: Record<ColorblindType, ColorMatrix> = {
  [ColorblindType.NONE]: [
    [1, 0, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0],
  ],
  [ColorblindType.PROTANOPIA]: [
    [0.567, 0.433, 0, 0, 0],
    [0.558, 0.442, 0, 0, 0],
    [0, 0.242, 0.758, 0, 0],
    [0, 0, 0, 1, 0],
  ],
  // ... other filters
};
```

### Create Hook

```typescript
// src/hooks/useColorblindMode.ts
import { useState, useEffect } from 'react';
import { ColorblindType } from '@/utils/colorblind';

export function useColorblindMode() {
  const [mode, setMode] = useState<ColorblindType>(ColorblindType.NONE);
  const [patterns, setPatterns] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('colorblind-mode');
    if (saved) setMode(saved as ColorblindType);
  }, []);

  const applyMode = (type: ColorblindType) => {
    document.body.style.filter = `url(#${type})`;
    localStorage.setItem('colorblind-mode', type);
    setMode(type);
  };

  return { mode, patterns, setMode: applyMode, togglePatterns };
}
```

### Implement Component

```typescript
// src/components/atomic/ColorblindToggle/ColorblindToggle.tsx
export function ColorblindToggle() {
  const { mode, setMode } = useColorblindMode();

  return (
    <div className="dropdown dropdown-end">
      <button className="btn btn-ghost">
        Color Vision
      </button>
      <div className="dropdown-content">
        {/* Mode selector */}
      </div>
    </div>
  );
}
```

### Run Test Again

```bash
pnpm test ColorblindToggle
# Expected: Test passes
```

## Step 3: Add SVG Filters

### Create Filter Component

```typescript
// src/components/atomic/ColorblindFilters/ColorblindFilters.tsx
export function ColorblindFilters() {
  return (
    <svg className="hidden" aria-hidden="true">
      <defs>
        <filter id="protanopia">
          <feColorMatrix type="matrix" values="0.567 0.433 0 0 0 ..." />
        </filter>
        {/* Other filters */}
      </defs>
    </svg>
  );
}
```

### Add to Layout

```tsx
// src/app/layout.tsx
import { ColorblindFilters } from '@/components/atomic/ColorblindFilters';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ColorblindFilters />
        {children}
      </body>
    </html>
  );
}
```

## Step 4: Add Pattern Overlays

### Create Pattern Styles

```css
/* src/styles/colorblind-patterns.css */
.colorblind-patterns .btn-primary {
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    rgba(255, 255, 255, 0.05) 10px,
    rgba(255, 255, 255, 0.05) 20px
  );
}
```

### Import Styles

```css
/* src/app/globals.css */
@import '../styles/colorblind-patterns.css';
```

## Step 5: Integration Testing

### Test with Themes

```typescript
// Test with all 32 themes
describe('Theme Compatibility', () => {
  themes.forEach((theme) => {
    it(`should work with ${theme} theme`, () => {
      document.documentElement.setAttribute('data-theme', theme);
      // Apply colorblind mode
      // Verify contrast maintained
    });
  });
});
```

### Accessibility Testing

```typescript
// ColorblindToggle.accessibility.test.tsx
import { axe } from 'jest-axe';

describe('Accessibility', () => {
  it('should have no violations', async () => {
    const { container } = render(<ColorblindToggle />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

## Step 6: Manual Testing Checklist

- [ ] All 8 colorblind modes render correctly
- [ ] Filters apply to entire page
- [ ] Patterns toggle on/off
- [ ] Settings persist on reload
- [ ] Works with all themes
- [ ] Performance < 10ms
- [ ] Keyboard navigation works
- [ ] Screen reader announces changes

## Step 7: Storybook Stories

```typescript
// ColorblindToggle.stories.tsx
export default {
  title: 'Accessibility/ColorblindToggle',
  component: ColorblindToggle,
};

export const Default = {};
export const WithLabel = { args: { showLabel: true } };
export const Compact = { args: { compact: true } };
```

## Performance Validation

```javascript
// Measure filter application
console.time('colorblind-filter');
applyColorblindMode(ColorblindType.DEUTERANOPIA);
console.timeEnd('colorblind-filter');
// Expected: < 10ms
```

## Troubleshooting

### Filters Not Applying

- Ensure SVG filters are in DOM before applying
- Check filter ID matches

### Performance Issues

- Apply filter to body, not individual elements
- Use GPU-accelerated CSS

### Pattern Too Strong

- Reduce opacity to 0.05
- Make patterns optional

## Next Steps

After implementation:

1. Run full test suite: `pnpm test`
2. Check accessibility: `pnpm test:a11y`
3. Build for production: `pnpm build`
4. Update documentation
5. Create PR for review

## Success Criteria Validation

- ✅ Support for all major colorblind types
- ✅ CSS filters for real-time conversion
- ✅ Pattern overlays for critical UI elements
- ✅ Works with all 32 themes
- ✅ Persistent user preference
- ✅ Performance impact < 10ms
- ✅ Accessible toggle in UI
- ✅ Simulation mode for testing
