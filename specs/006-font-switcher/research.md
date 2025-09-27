# Font Switcher Technology Research

## Font Selection Research

### Accessibility-Focused Fonts

#### OpenDyslexic

- **Purpose**: Designed specifically for dyslexic readers
- **Features**: Weighted bottoms, unique letter shapes, increased spacing
- **Research**: Mixed scientific results, but strong anecdotal user preference
- **License**: Open source (SIL Open Font License)
- **Size**: ~200KB for regular weight
- **Implementation**: Self-host for offline support

#### Atkinson Hyperlegible

- **Purpose**: Maximum legibility for low vision readers
- **Creator**: Braille Institute
- **Features**: Distinguishable characters, clear letterforms
- **Research**: Proven improvements in character recognition
- **License**: Open source (SIL Open Font License)
- **Size**: ~100KB per weight
- **Implementation**: Google Fonts CDN available

### General Purpose Fonts

#### Inter

- **Purpose**: UI optimized font
- **Features**: Excellent screen rendering, variable font support
- **Usage**: Popular in modern web apps (GitHub, Mozilla)
- **License**: Open source (SIL Open Font License)
- **Size**: ~200KB for variable font
- **Implementation**: Google Fonts CDN

#### System Fonts

- **Stack**: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"`
- **Benefits**: Zero loading time, native OS feel
- **Drawbacks**: Inconsistent across platforms
- **Use case**: Default option for performance

#### Georgia

- **Purpose**: Serif font for long-form reading
- **Features**: Excellent screen readability, web-safe font
- **Availability**: Pre-installed on most systems
- **Use case**: Article content, documentation

#### JetBrains Mono

- **Purpose**: Developer-focused monospace
- **Features**: Ligatures, clear distinction between similar chars
- **License**: Open source (Apache 2.0)
- **Size**: ~150KB per weight
- **Use case**: Code blocks, technical content

## Implementation Technologies

### Font Loading Strategies

#### 1. Font Display Strategies

```css
@font-face {
  font-display: swap; /* Recommended: Show fallback immediately */
  /* Other options:
     - auto: Browser decides
     - block: Hide text briefly (FOIT)
     - fallback: Very short block period
     - optional: Use if available within 100ms
  */
}
```

#### 2. Preloading Critical Fonts

```html
<link
  rel="preload"
  href="/fonts/Inter.woff2"
  as="font"
  type="font/woff2"
  crossorigin
/>
```

#### 3. Variable Fonts

- Single file for all weights
- Smaller total size
- Better performance
- Smooth weight transitions

### CSS Custom Properties Integration

#### Current System

```css
/* DaisyUI uses CSS variables for theming */
:root {
  --primary: ...;
  --secondary: ...;
}
```

#### Proposed Addition

```css
:root {
  --font-family: system-ui, -apple-system, sans-serif;
  --font-size-adjust: 0.5; /* Prevent layout shift */
}

body {
  font-family: var(--font-family);
  font-size-adjust: var(--font-size-adjust);
}
```

### State Management Patterns

#### localStorage vs sessionStorage

- **localStorage**: Persists indefinitely (chosen approach)
- **sessionStorage**: Cleared on tab close
- **Key naming**: `font-family` (consistent with `theme`, `colorblind-mode`)

#### React Hook Pattern

Following established patterns from:

- `useColorblindMode`: Custom hook with localStorage
- `useAccessibility`: Context-based state
- Decision: Custom hook for simplicity

### Browser Compatibility

#### Font Format Support

- **WOFF2**: 96%+ browser support (primary format)
- **WOFF**: 98%+ browser support (fallback)
- **TTF/OTF**: Legacy fallback

#### CSS Features

- **CSS Variables**: 95%+ support
- **font-size-adjust**: 80%+ support (progressive enhancement)
- **font-display**: 93%+ support

## Performance Considerations

### Loading Performance

1. **System fonts**: 0ms load time
2. **Cached web fonts**: < 10ms
3. **First load web fonts**: 50-200ms depending on size
4. **Strategy**: Default to system, lazy load others

### Runtime Performance

- **CSS Variable updates**: < 1ms
- **Reflow/Repaint**: ~16ms (one frame)
- **localStorage access**: < 1ms

### Bundle Size Impact

- **Component code**: ~5KB minified
- **Font files**: 0KB (system) to 200KB (custom)
- **Total impact**: Minimal for code, optional for fonts

## Accessibility Compliance

### WCAG Requirements

- **1.4.8 Visual Presentation (AAA)**: User can select foreground/background colors
- **1.4.12 Text Spacing (AA)**: No loss of content with spacing adjustments
- **3.2.4 Consistent Identification (AA)**: Font changes maintain consistency

### Implementation Requirements

1. **Keyboard navigation**: Full dropdown control
2. **Screen reader**: Announce font changes
3. **Focus management**: Trap focus in dropdown
4. **High contrast**: Maintain visibility in all modes

## Security Considerations

### Font Loading Security

- **CORS**: Configure for CDN fonts
- **CSP**: Update Content Security Policy for font sources
- **Local fonts**: Serve from same origin

### XSS Prevention

- **Input validation**: Font IDs are predefined
- **No user uploads**: Prevents malicious font files
- **Sanitization**: Font names displayed safely

## Competitive Analysis

### Similar Implementations

#### Medium.com

- Sans/Serif toggle
- Simple two-option approach
- Stored in user account

#### GitHub

- System font by default
- No user control
- Performance focused

#### Notion

- Default, Serif, Mono options
- Account-level setting
- Clean implementation

### Our Advantages

1. More font options (6+)
2. Accessibility-focused selections
3. Local storage (no account needed)
4. Integration with theme system

## Decision Matrix

| Criteria    | System Fonts | Google Fonts | Self-Hosted | Mixed Approach |
| ----------- | ------------ | ------------ | ----------- | -------------- |
| Performance | ⭐⭐⭐⭐⭐   | ⭐⭐⭐       | ⭐⭐⭐⭐    | ⭐⭐⭐⭐       |
| Consistency | ⭐⭐         | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐  | ⭐⭐⭐⭐       |
| Offline     | ⭐⭐⭐⭐⭐   | ⭐           | ⭐⭐⭐⭐⭐  | ⭐⭐⭐⭐       |
| Bundle Size | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐   | ⭐⭐        | ⭐⭐⭐⭐       |
| Maintenance | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐     | ⭐⭐⭐      | ⭐⭐⭐         |

**Decision**: Mixed approach - System fonts default, Google Fonts for common fonts, self-host accessibility fonts

## Recommendations

### Phase 1 Implementation

1. Start with system fonts (immediate value)
2. Add Inter via Google Fonts
3. Self-host OpenDyslexic
4. Progressive enhancement for others

### Future Enhancements

1. User font upload (Phase 2)
2. Font size controls (integrate with AccessibilityContext)
3. Line height adjustments
4. Letter spacing controls

### Best Practices

1. Always provide fallback stacks
2. Test with slow connections
3. Validate with real users
4. Monitor performance metrics
