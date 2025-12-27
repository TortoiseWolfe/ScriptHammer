# Product Requirements Prompt (PRP)

**Feature Name**: Font Switcher
**Priority**: P1 (Constitutional Enhancement)
**Sprint**: Sprint 3
**Status**: ✅ Complete
**Created**: 2025-09-13
**Completed**: 2025-12-27
**Author**: AI Assistant (from SpecKit analysis)

---

## 1. Product Requirements

### What We're Building

A font switching system that mirrors the ThemeSwitcher pattern, allowing users to dynamically change typography across the entire application. This enhances accessibility and user preference customization alongside the existing 32-theme system.

### Why We're Building It

- Constitutional requirement (Section 6, Phase 4: Enhanced Features)
- Accessibility improvement for users with dyslexia or visual preferences
- Complements the existing theme system
- Demonstrates extensible architecture patterns
- Minimal implementation effort using existing patterns

### Success Criteria

- [x] Font switcher component mirrors ThemeSwitcher UI
- [x] At least 6 font options available
- [x] Font preference persists across sessions
- [x] Seamless integration with all 32 themes
- [x] No layout shift when switching fonts
- [x] Accessibility-friendly font options included (OpenDyslexic, Atkinson Hyperlegible)
- [x] Storybook documentation complete
- [x] Works with print stylesheets

### Out of Scope

- Custom font upload by users
- Per-component font overrides
- Variable font weight controls
- Font size controls (handled by AccessibilityContext)

---

## 2. Context & Codebase Intelligence

### Existing Patterns to Follow

#### ThemeSwitcher Pattern

```typescript
// src/components/ThemeSwitcher.tsx
'use client';

import { useEffect, useState } from 'react';
import { themes } from '@/config/themes';

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && themes.includes(savedTheme)) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };
}
```

#### CSS Variable System

```css
/* Current theme variables in globals.css */
:root {
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: 'SF Mono', Monaco, monospace;
}
```

#### Accessibility Context

```typescript
// src/contexts/AccessibilityContext.tsx
// Already handles fontSize and spacing
export const AccessibilityContext = createContext<{
  fontSize: string;
  spacing: string;
  setFontSize: (size: string) => void;
  setSpacing: (spacing: string) => void;
}>(defaultValues);
```

### Dependencies & Libraries

- Next.js font optimization (@next/font)
- No additional packages needed
- Use system fonts for performance
- Optional: Google Fonts or Fontsource

### File Structure

```
src/
├── components/
│   ├── FontSwitcher/
│   │   ├── index.tsx
│   │   ├── FontSwitcher.tsx
│   │   ├── FontSwitcher.test.tsx
│   │   └── FontSwitcher.stories.tsx
│   └── ThemeSwitcher.tsx        # Reference implementation
├── config/
│   ├── themes.ts                # Existing
│   └── fonts.ts                 # NEW: Font configurations
└── styles/
    └── fonts.css                # NEW: Font face declarations
```

---

## 3. Technical Specifications

### Font Configuration

```typescript
// src/config/fonts.ts
export interface FontConfig {
  id: string;
  name: string;
  stack: string;
  category: 'sans-serif' | 'serif' | 'monospace' | 'display';
  description: string;
  accessibility?: 'dyslexia-friendly' | 'high-readability';
}

export const fonts: FontConfig[] = [
  {
    id: 'system',
    name: 'System Default',
    stack:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    category: 'sans-serif',
    description: "Uses your operating system's default font",
  },
  {
    id: 'inter',
    name: 'Inter',
    stack: '"Inter", system-ui, sans-serif',
    category: 'sans-serif',
    description: 'Modern, highly legible font designed for screens',
  },
  {
    id: 'opendyslexic',
    name: 'OpenDyslexic',
    stack: '"OpenDyslexic", sans-serif',
    category: 'sans-serif',
    description: 'Designed to help with dyslexia',
    accessibility: 'dyslexia-friendly',
  },
  {
    id: 'atkinson',
    name: 'Atkinson Hyperlegible',
    stack: '"Atkinson Hyperlegible", system-ui, sans-serif',
    category: 'sans-serif',
    description: 'Designed for maximum legibility',
    accessibility: 'high-readability',
  },
  {
    id: 'georgia',
    name: 'Georgia',
    stack: 'Georgia, "Times New Roman", serif',
    category: 'serif',
    description: 'Classic serif font for long-form reading',
  },
  {
    id: 'jetbrains',
    name: 'JetBrains Mono',
    stack: '"JetBrains Mono", "SF Mono", Monaco, monospace',
    category: 'monospace',
    description: 'Developer-friendly monospace font',
  },
];
```

### FontSwitcher Component

```typescript
// src/components/FontSwitcher/FontSwitcher.tsx
'use client';

import { useEffect, useState } from 'react';
import { fonts } from '@/config/fonts';

export default function FontSwitcher() {
  const [currentFont, setCurrentFont] = useState('system');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Load saved preference
    const savedFont = localStorage.getItem('font-family');
    if (savedFont) {
      applyFont(savedFont);
      setCurrentFont(savedFont);
    }
  }, []);

  const applyFont = (fontId: string) => {
    const font = fonts.find(f => f.id === fontId);
    if (font) {
      document.documentElement.style.setProperty('--font-family', font.stack);
      document.body.style.fontFamily = 'var(--font-family)';
    }
  };

  const handleFontChange = (fontId: string) => {
    setCurrentFont(fontId);
    localStorage.setItem('font-family', fontId);
    applyFont(fontId);
    setIsOpen(false);
  };

  const currentFontConfig = fonts.find(f => f.id === currentFont);

  return (
    <div className="dropdown dropdown-end">
      <button tabIndex={0} className="btn btn-ghost gap-2" aria-label="Font Selection">
        <svg className="w-5 h-5" fill="none" stroke="currentColor">
          {/* Font icon */}
        </svg>
        <span className="hidden sm:inline">{currentFontConfig?.name}</span>
      </button>

      <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-72 max-h-96 overflow-y-auto">
        {fonts.map((font) => (
          <li key={font.id}>
            <button
              onClick={() => handleFontChange(font.id)}
              className={`flex flex-col items-start ${
                currentFont === font.id ? 'active' : ''
              }`}
              style={{ fontFamily: font.stack }}
            >
              <span className="font-semibold">{font.name}</span>
              <span className="text-xs opacity-60">{font.description}</span>
              {font.accessibility && (
                <span className="badge badge-sm badge-success mt-1">
                  {font.accessibility}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### CSS Implementation

```css
/* src/styles/fonts.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');

/* OpenDyslexic local font */
@font-face {
  font-family: 'OpenDyslexic';
  src: url('/fonts/OpenDyslexic-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}

:root {
  --font-family: system-ui, -apple-system, sans-serif;
}

body {
  font-family: var(--font-family);
}

/* Ensure consistent rendering */
* {
  font-feature-settings:
    'kern' 1,
    'liga' 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### Performance Requirements

- Font loading: Use font-display: swap
- Initial load: < 50ms (system fonts)
- Web fonts: Lazy load on selection
- Storage: < 1KB for preference

---

## 4. Implementation Runbook

### Step 1: Create Font Configuration

```bash
# Create font config
touch src/config/fonts.ts

# Add font configuration (see Technical Specs)
```

### Step 2: Implement FontSwitcher Component

```bash
# Create component directory
mkdir -p src/components/FontSwitcher

# Create component files
touch src/components/FontSwitcher/{index.tsx,FontSwitcher.tsx,FontSwitcher.test.tsx,FontSwitcher.stories.tsx}
```

### Step 3: Add Font Resources

```bash
# Create fonts directory
mkdir -p public/fonts

# Download OpenDyslexic font
# wget https://github.com/antijingoist/opendyslexic/raw/master/...

# Create font styles
touch src/styles/fonts.css
```

### Step 4: Integration

```typescript
// Add to app/layout.tsx
import FontSwitcher from '@/components/FontSwitcher';
import '@/styles/fonts.css';

// Add to navigation bar next to ThemeSwitcher
<FontSwitcher />
```

### Step 5: Testing

- [ ] Test all font options
- [ ] Verify persistence
- [ ] Check theme compatibility
- [ ] Test accessibility fonts
- [ ] Validate no layout shift
- [ ] Cross-browser testing

### Step 6: Documentation

- [ ] Create Storybook stories
- [ ] Document font choices
- [ ] Add to user guide
- [ ] Update accessibility docs

---

## 5. Validation Loops

### Pre-Implementation Checks

- [x] ThemeSwitcher pattern understood
- [x] CSS variable system in place
- [x] Font resources identified
- [x] Accessibility requirements clear

### During Implementation

- [x] Fonts load correctly
- [x] No FOUT/FOIT issues
- [x] Persistence works
- [x] UI matches ThemeSwitcher

### Post-Implementation

- [x] All fonts render correctly
- [x] Accessibility improved
- [x] Performance maintained
- [x] Documentation complete

---

## 6. Risk Mitigation

### Potential Risks

1. **Risk**: Font loading performance impact
   **Mitigation**: Use system fonts by default, lazy load others

2. **Risk**: Layout shift when changing fonts
   **Mitigation**: Set consistent line-height and use font-size-adjust

3. **Risk**: Font licensing issues
   **Mitigation**: Use open-source fonts or system fonts only

4. **Risk**: Accessibility fonts not rendering
   **Mitigation**: Provide fallback stacks, test thoroughly

---

## 7. References

### Internal Documentation

- Constitution: `/docs/constitution.md` (Section 6, Phase 4)
- ThemeSwitcher: `/src/components/ThemeSwitcher.tsx`
- Accessibility Context: `/src/contexts/AccessibilityContext.tsx`
- Global Styles: `/src/styles/globals.css`

### External Resources

- [Next.js Font Optimization](https://nextjs.org/docs/basic-features/font-optimization)
- [OpenDyslexic Font](https://opendyslexic.org/)
- [Atkinson Hyperlegible](https://brailleinstitute.org/freefont)
- [Web Font Best Practices](https://web.dev/font-best-practices/)

---

## PRP Workflow Status

### Review Checklist (Inbox → Outbox)

- [x] Product requirements clear and complete
- [x] Technical approach validated
- [x] Resources available
- [x] No blocking dependencies
- [x] Approved by: SpecKit

### Processing Status (Outbox → Processed)

- [x] Specification generated
- [x] Plan created
- [x] Tasks broken down
- [x] Implementation started
- [x] Completed on: 2025-12-27

---

<!--
PRP for Font Switcher
Generated from SpecKit constitution analysis
Mirrors ThemeSwitcher pattern for typography control
-->
