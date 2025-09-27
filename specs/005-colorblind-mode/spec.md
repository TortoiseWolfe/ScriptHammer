# Product Requirements Prompt (PRP)

**Feature Name**: Colorblind Mode  
**Priority**: P0 (Constitutional Requirement)  
**Sprint**: Sprint 3  
**Status**: 📥 Inbox  
**Created**: 2025-09-13  
**Author**: AI Assistant (from SpecKit analysis)

---

## 1. Product Requirements

### What We're Building

A comprehensive colorblind mode system that provides filters and adjustments for all major types of color vision deficiencies. This will integrate with the existing accessibility controls and work across all 32 themes, ensuring the application is usable for the 8% of men and 0.5% of women with color vision deficiencies.

### Why We're Building It

- Constitutional requirement (Section 2: Accessibility - colorblind support)
- Currently marked as "❌ colorblind" not implemented
- Affects ~300 million people worldwide
- Essential for inclusive design
- Complements WCAG AA compliance

### Success Criteria

- [ ] Support for all major colorblind types
- [ ] CSS filters for real-time conversion
- [ ] Pattern overlays for critical UI elements
- [ ] Works with all 32 themes
- [ ] Persistent user preference
- [ ] Performance impact < 10ms
- [ ] Accessible toggle in UI
- [ ] Simulation mode for testing

### Out of Scope

- Hardware-level color correction
- Custom filter creation by users
- Real-time image recoloring
- Video content filtering
- External content adaptation

---

## 2. Context & Codebase Intelligence

### Existing Patterns to Follow

#### Accessibility Context

```typescript
// src/contexts/AccessibilityContext.tsx
export const AccessibilityProvider: React.FC = ({ children }) => {
  const [fontSize, setFontSize] = useState('base');
  const [spacing, setSpacing] = useState('normal');
  // Add colorblindMode here
};
```

#### Theme System Integration

```typescript
// Works with existing theme system
const theme = document.documentElement.getAttribute('data-theme');
```

#### CSS Variable System

```css
/* globals.css - Add filter variables */
:root {
  --colorblind-filter: none;
  --colorblind-patterns: none;
}
```

### Dependencies & Libraries

```bash
# No external libraries needed
# Pure CSS implementation
# Optional for simulation testing:
pnpm add -D colorblind
```

### File Structure

```
src/
├── components/
│   └── accessibility/
│       ├── ColorblindToggle/
│       │   ├── index.tsx
│       │   ├── ColorblindToggle.tsx
│       │   ├── ColorblindToggle.test.tsx
│       │   └── ColorblindToggle.stories.tsx
│       └── ColorblindSimulator/
│           └── ColorblindSimulator.tsx
├── styles/
│   ├── colorblind-filters.css
│   └── colorblind-patterns.css
├── utils/
│   └── colorblind.ts
└── hooks/
    └── useColorblindMode.ts
```

---

## 3. Technical Specifications

### Colorblind Types & Filters

```typescript
// src/utils/colorblind.ts
export enum ColorblindType {
  NONE = 'none',
  PROTANOPIA = 'protanopia', // Red-blind (1% of males)
  PROTANOMALY = 'protanomaly', // Red-weak (1% of males)
  DEUTERANOPIA = 'deuteranopia', // Green-blind (1% of males)
  DEUTERANOMALY = 'deuteranomaly', // Green-weak (5% of males)
  TRITANOPIA = 'tritanopia', // Blue-blind (0.001%)
  TRITANOMALY = 'tritanomaly', // Blue-weak (0.01%)
  ACHROMATOPSIA = 'achromatopsia', // Complete colorblind (0.003%)
  ACHROMATOMALY = 'achromatomaly', // Partial colorblind
}

export const colorblindFilters: Record<ColorblindType, string> = {
  [ColorblindType.NONE]: 'none',
  [ColorblindType.PROTANOPIA]: 'url(#protanopia)',
  [ColorblindType.PROTANOMALY]: 'url(#protanomaly)',
  [ColorblindType.DEUTERANOPIA]: 'url(#deuteranopia)',
  [ColorblindType.DEUTERANOMALY]: 'url(#deuteranomaly)',
  [ColorblindType.TRITANOPIA]: 'url(#tritanopia)',
  [ColorblindType.TRITANOMALY]: 'url(#tritanomaly)',
  [ColorblindType.ACHROMATOPSIA]: 'url(#achromatopsia)',
  [ColorblindType.ACHROMATOMALY]: 'url(#achromatomaly)',
};
```

### SVG Filter Definitions

```tsx
// src/components/accessibility/ColorblindFilters.tsx
export default function ColorblindFilters() {
  return (
    <svg className="hidden">
      <defs>
        {/* Protanopia (Red-Blind) */}
        <filter id="protanopia">
          <feColorMatrix
            type="matrix"
            values="0.567, 0.433, 0,     0, 0
                    0.558, 0.442, 0,     0, 0
                    0,     0.242, 0.758, 0, 0
                    0,     0,     0,     1, 0"
          />
        </filter>

        {/* Deuteranopia (Green-Blind) */}
        <filter id="deuteranopia">
          <feColorMatrix
            type="matrix"
            values="0.625, 0.375, 0,   0, 0
                    0.7,   0.3,   0,   0, 0
                    0,     0.3,   0.7, 0, 0
                    0,     0,     0,   1, 0"
          />
        </filter>

        {/* Tritanopia (Blue-Blind) */}
        <filter id="tritanopia">
          <feColorMatrix
            type="matrix"
            values="0.95, 0.05,  0,     0, 0
                    0,    0.433, 0.567, 0, 0
                    0,    0.475, 0.525, 0, 0
                    0,    0,     0,     1, 0"
          />
        </filter>

        {/* Achromatopsia (Complete Color Blindness) */}
        <filter id="achromatopsia">
          <feColorMatrix
            type="matrix"
            values="0.299, 0.587, 0.114, 0, 0
                    0.299, 0.587, 0.114, 0, 0
                    0.299, 0.587, 0.114, 0, 0
                    0,     0,     0,     1, 0"
          />
        </filter>

        {/* Additional filters for other types... */}
      </defs>
    </svg>
  );
}
```

### Colorblind Mode Hook

```typescript
// src/hooks/useColorblindMode.ts
import { useState, useEffect } from 'react';
import { ColorblindType, colorblindFilters } from '@/utils/colorblind';

const STORAGE_KEY = 'colorblind-mode';

export function useColorblindMode() {
  const [mode, setMode] = useState<ColorblindType>(ColorblindType.NONE);
  const [patternsEnabled, setPatternsEnabled] = useState(false);

  useEffect(() => {
    // Load saved preference
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const { mode, patterns } = JSON.parse(saved);
      setMode(mode);
      setPatternsEnabled(patterns);
      applyColorblindMode(mode, patterns);
    }
  }, []);

  const applyColorblindMode = (type: ColorblindType, patterns: boolean) => {
    const root = document.documentElement;

    // Apply SVG filter
    root.style.setProperty('--colorblind-filter', colorblindFilters[type]);

    // Apply to body
    document.body.style.filter = `var(--colorblind-filter)`;

    // Enable patterns for better distinction
    if (patterns) {
      root.classList.add('colorblind-patterns');
    } else {
      root.classList.remove('colorblind-patterns');
    }

    // Save preference
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: type,
        patterns,
      })
    );
  };

  const setColorblindMode = (type: ColorblindType) => {
    setMode(type);
    applyColorblindMode(type, patternsEnabled);
  };

  const togglePatterns = () => {
    const newPatternsState = !patternsEnabled;
    setPatternsEnabled(newPatternsState);
    applyColorblindMode(mode, newPatternsState);
  };

  return {
    mode,
    setColorblindMode,
    patternsEnabled,
    togglePatterns,
  };
}
```

### Colorblind Toggle Component

```typescript
// src/components/accessibility/ColorblindToggle/ColorblindToggle.tsx
'use client';

import { useColorblindMode } from '@/hooks/useColorblindMode';
import { ColorblindType } from '@/utils/colorblind';
import { Eye, EyeOff } from 'lucide-react';

export default function ColorblindToggle() {
  const { mode, setColorblindMode, patternsEnabled, togglePatterns } = useColorblindMode();

  const colorblindOptions = [
    { value: ColorblindType.NONE, label: 'Normal Vision' },
    { value: ColorblindType.PROTANOPIA, label: 'Protanopia (Red-Blind)' },
    { value: ColorblindType.DEUTERANOPIA, label: 'Deuteranopia (Green-Blind)' },
    { value: ColorblindType.TRITANOPIA, label: 'Tritanopia (Blue-Blind)' },
    { value: ColorblindType.ACHROMATOPSIA, label: 'Achromatopsia (No Color)' },
  ];

  return (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost gap-2">
        {mode === ColorblindType.NONE ? <Eye /> : <EyeOff />}
        <span className="hidden sm:inline">Color Vision</span>
      </label>

      <div tabIndex={0} className="dropdown-content card card-compact w-80 p-4 shadow bg-base-100">
        <div className="card-body">
          <h3 className="font-bold text-lg">Color Vision Settings</h3>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Color Vision Type</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={mode}
              onChange={(e) => setColorblindMode(e.target.value as ColorblindType)}
            >
              {colorblindOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {mode !== ColorblindType.NONE && (
            <div className="form-control mt-4">
              <label className="label cursor-pointer">
                <span className="label-text">Enable Patterns</span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={patternsEnabled}
                  onChange={togglePatterns}
                />
              </label>
              <span className="label-text-alt">
                Adds patterns to help distinguish colors
              </span>
            </div>
          )}

          <div className="alert alert-info mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span className="text-sm">
              {mode === ColorblindType.NONE
                ? 'Select a color vision type to apply filters'
                : `Simulating ${colorblindOptions.find(o => o.value === mode)?.label}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Pattern Overlays CSS

```css
/* src/styles/colorblind-patterns.css */
.colorblind-patterns {
  /* Success/Error Distinction */
  .alert-success::before {
    content: '✓';
    position: absolute;
    left: 1rem;
    font-size: 1.5rem;
    opacity: 0.3;
  }

  .alert-error::before {
    content: '✗';
    position: absolute;
    left: 1rem;
    font-size: 1.5rem;
    opacity: 0.3;
  }

  /* Button States */
  .btn-primary {
    background-image: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(255, 255, 255, 0.05) 10px,
      rgba(255, 255, 255, 0.05) 20px
    );
  }

  .btn-secondary {
    background-image: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 10px,
      rgba(0, 0, 0, 0.05) 10px,
      rgba(0, 0, 0, 0.05) 20px
    );
  }

  /* Badge Patterns */
  .badge-success {
    background-image: radial-gradient(
      circle,
      transparent 20%,
      rgba(255, 255, 255, 0.1) 20%
    );
    background-size: 10px 10px;
  }

  .badge-error {
    background-image: linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.1) 25%,
      transparent 25%
    );
    background-size: 10px 10px;
  }
}
```

### Integration with Accessibility Page

```typescript
// app/accessibility/page.tsx
import ColorblindToggle from '@/components/accessibility/ColorblindToggle';
import ColorblindFilters from '@/components/accessibility/ColorblindFilters';

export default function AccessibilityPage() {
  return (
    <>
      <ColorblindFilters /> {/* Hidden SVG filters */}

      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Accessibility Controls</h1>

        <div className="grid gap-6">
          {/* Existing controls */}

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Color Vision</h2>
              <p>Adjust the display for different types of color vision.</p>
              <ColorblindToggle />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
```

---

## 4. Implementation Runbook

### Step 1: Create Colorblind Utilities

```bash
touch src/utils/colorblind.ts
touch src/hooks/useColorblindMode.ts
```

### Step 2: Create Filter Components

```bash
mkdir -p src/components/accessibility/ColorblindToggle
mkdir -p src/components/accessibility
touch src/components/accessibility/ColorblindFilters.tsx
```

### Step 3: Add Styles

```bash
touch src/styles/colorblind-filters.css
touch src/styles/colorblind-patterns.css
```

### Step 4: Update Global Styles

```css
/* app/globals.css */
@import './styles/colorblind-filters.css';
@import './styles/colorblind-patterns.css';
```

### Step 5: Testing

- [ ] Test all colorblind modes
- [ ] Verify filter accuracy
- [ ] Check pattern overlays
- [ ] Test with all 32 themes
- [ ] Verify persistence
- [ ] Performance testing

---

## 5. Validation Loops

### Pre-Implementation Checks

- [x] Filter matrices researched
- [x] Pattern strategies defined
- [x] Accessibility context exists
- [ ] User research completed

### During Implementation

- [ ] Filters render correctly
- [ ] No performance impact
- [ ] Patterns visible
- [ ] Settings persist

### Post-Implementation

- [ ] All modes working
- [ ] User testing completed
- [ ] Documentation ready
- [ ] Integrated with themes

---

## 6. Risk Mitigation

### Potential Risks

1. **Risk**: Performance impact from filters
   **Mitigation**: Use CSS filters, GPU accelerated

2. **Risk**: Incorrect filter matrices
   **Mitigation**: Use scientifically validated values

3. **Risk**: Patterns too intrusive
   **Mitigation**: Make patterns optional, subtle

4. **Risk**: Theme conflicts
   **Mitigation**: Test all 32 themes systematically

---

## 7. References

### Internal Documentation

- Constitution: `/docs/constitution.md` (Section 2: Accessibility)
- Accessibility Context: `/src/contexts/AccessibilityContext.tsx`
- Theme System: `/src/components/ThemeSwitcher.tsx`

### External Resources

- [Colorblind Web Page Filter](https://www.toptal.com/designers/colorfilter/)
- [Color Oracle](https://colororacle.org/)
- [Coblis Colorblind Simulator](https://www.color-blindness.com/coblis-color-blindness-simulator/)
- [W3C Color Contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

---

## PRP Workflow Status

### Review Checklist (Inbox → Outbox)

- [ ] Product requirements clear and complete
- [ ] Technical approach validated
- [ ] Resources available
- [ ] No blocking dependencies
- [ ] Approved by: [PENDING]

### Processing Status (Outbox → Processed)

- [ ] Specification generated
- [ ] Plan created
- [ ] Tasks broken down
- [ ] Implementation started
- [ ] Completed on: [PENDING]

---

<!--
PRP for Colorblind Mode
Generated from SpecKit constitution analysis
Ensures application is usable for all color vision types
-->
