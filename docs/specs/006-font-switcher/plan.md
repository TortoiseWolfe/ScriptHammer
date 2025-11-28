# Font Switcher Implementation Plan

## Overview

Implement a font switching system that mirrors the ThemeSwitcher pattern, allowing users to dynamically change typography across the entire application. This enhances accessibility and user preference customization alongside the existing 32-theme system.

## Phase 0: Research & Analysis

### Current State Analysis

- **ThemeSwitcher Pattern**: Located in `src/components/theme/ThemeSwitcher.tsx`
  - Uses localStorage for persistence
  - Updates `data-theme` attribute on documentElement
  - Grid layout for theme selection
  - Preview badges for visual feedback

- **ColorblindToggle Pattern**: Located in `src/components/atomic/ColorblindToggle/`
  - Dropdown interface with descriptions
  - Custom hook for state management
  - Accessibility badges for special features
  - Integration with accessibility page

- **CSS Variable System**: Currently uses DaisyUI theme variables
  - Need to add `--font-family` variable
  - Apply through document styles

### Technology Decisions

1. **Font Loading Strategy**
   - System fonts: Immediate availability, no loading
   - Web fonts: Load on-demand with font-display: swap
   - Local fonts: Bundle OpenDyslexic for offline support

2. **State Management**
   - Custom hook: `useFontFamily` following `useColorblindMode` pattern
   - localStorage key: `font-family`
   - Default: system font stack

3. **Component Pattern**
   - Follow ColorblindToggle dropdown pattern
   - Include font preview in dropdown
   - Show accessibility badges

## Phase 1: Core Implementation

### Step 1: Font Configuration

Create font configuration with 6+ options focusing on accessibility:

```typescript
// src/config/fonts.ts
export const fonts: FontConfig[] = [
  { id: 'system', name: 'System Default', ... },
  { id: 'inter', name: 'Inter', ... },
  { id: 'opendyslexic', name: 'OpenDyslexic', accessibility: 'dyslexia-friendly' },
  { id: 'atkinson', name: 'Atkinson Hyperlegible', accessibility: 'high-readability' },
  { id: 'georgia', name: 'Georgia', ... },
  { id: 'jetbrains', name: 'JetBrains Mono', ... }
];
```

### Step 2: Custom Hook

Create `useFontFamily` hook for state management:

```typescript
// src/hooks/useFontFamily.ts
export function useFontFamily() {
  const [fontFamily, setFontFamily] = useState('system');

  // Load from localStorage
  // Apply to DOM
  // Persist changes

  return { fontFamily, setFontFamily };
}
```

### Step 3: FontSwitcher Component

Implement component following 4-file pattern:

- `FontSwitcher.tsx`: Main component with dropdown UI
- `FontSwitcher.test.tsx`: Unit tests with TDD
- `FontSwitcher.stories.tsx`: Storybook documentation
- `FontSwitcher.accessibility.test.tsx`: A11y tests

### Step 4: Integration

- Add to `/app/accessibility/page.tsx`
- Import font styles in layout
- Test with all themes

## Phase 2: Testing & Validation

### Test Coverage Requirements

- [ ] Unit tests: Font switching, persistence, defaults
- [ ] Accessibility tests: Keyboard nav, screen readers, WCAG
- [ ] Integration tests: Theme compatibility, no layout shift
- [ ] Visual tests: Font rendering across browsers

### Performance Metrics

- Initial load: < 50ms (system fonts)
- Font switch: < 100ms
- No layout shift (CLS = 0)
- Web font loading: Progressive enhancement

## Phase 3: Documentation

### User Documentation

- Add to accessibility guide
- Document font choices and benefits
- Include dyslexia-friendly information

### Developer Documentation

- Storybook stories with all variants
- Integration guide for new pages
- Font addition process

## Success Criteria

### Functional Requirements

- ✅ 6+ font options available
- ✅ Preferences persist across sessions
- ✅ Works with all 32 themes
- ✅ No layout shift on change

### Accessibility Requirements

- ✅ WCAG AA compliant
- ✅ Keyboard navigable
- ✅ Screen reader friendly
- ✅ Dyslexia-friendly options

### Performance Requirements

- ✅ < 50ms initial load
- ✅ < 100ms font switch
- ✅ Progressive enhancement
- ✅ Offline support

## Risk Mitigation

### Identified Risks

1. **Font Loading Performance**
   - Mitigation: Use system fonts by default, lazy load others

2. **Layout Shift**
   - Mitigation: Set font-size-adjust, consistent line-height

3. **Browser Compatibility**
   - Mitigation: Fallback stacks, feature detection

4. **License Compliance**
   - Mitigation: Use open-source fonts only

## Timeline

### Day 1 (Current)

- [x] Setup feature branch
- [x] Generate /plan artifacts
- [ ] Generate /tasks list
- [ ] Begin TDD implementation

### Day 2

- [ ] Complete component implementation
- [ ] Integration with accessibility page
- [ ] Full test coverage

### Day 3

- [ ] Documentation
- [ ] PR submission
- [ ] Merge to main

## Dependencies

### External

- Google Fonts CDN (Inter, Atkinson)
- OpenDyslexic font files
- JetBrains Mono font files

### Internal

- Existing theme system
- Accessibility context
- Component patterns

## Notes

This implementation follows established patterns from ThemeSwitcher and ColorblindToggle, ensuring consistency across the codebase. The focus on accessibility-first font choices aligns with the constitutional requirements for enhanced accessibility features.
