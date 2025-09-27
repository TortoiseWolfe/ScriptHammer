# Font Switcher API Contracts

## Overview

The Font Switcher feature is entirely client-side and does not require any API contracts. All font management is handled through:

1. **localStorage** - For persisting user preferences
2. **CSS Variables** - For applying font changes
3. **Static font files** - Served from public directory or CDN

## Client-Side Interfaces

While there are no API contracts, the feature uses these client-side interfaces:

### localStorage Schema

```typescript
// Key: 'font-family'
type StoredFontFamily = string; // Font ID

// Key: 'font-settings'
interface StoredFontSettings {
  fontFamily: string;
  lastUpdated: number;
  recentFonts: string[];
}
```

### Custom Events

```typescript
// Dispatched on font change
interface FontChangeEvent {
  type: 'fontchange';
  detail: {
    previousFont: string;
    newFont: string;
    timestamp: number;
  };
}
```

### Component Props

```typescript
interface FontSwitcherProps {
  className?: string;
}
```

### Hook Returns

```typescript
interface UseFontFamilyReturn {
  fontFamily: string;
  setFontFamily: (fontId: string) => void;
  fonts: FontConfig[];
  currentFontConfig: FontConfig | undefined;
}
```

## External Resources

### Google Fonts CDN

- **Endpoint**: `https://fonts.googleapis.com/css2`
- **Method**: GET (via link tag)
- **Usage**: Loading web fonts (Inter, Atkinson Hyperlegible, JetBrains Mono)

### Static Font Files

- **Location**: `/public/fonts/`
- **Files**:
  - `OpenDyslexic-Regular.woff2`
  - `OpenDyslexic-Bold.woff2`
- **Served**: Directly by Next.js static file serving

## Security Considerations

### Content Security Policy

If CSP is enabled, ensure these directives are set:

```
font-src 'self' https://fonts.gstatic.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
```

### CORS

No CORS configuration needed as fonts are either:

- Served from same origin (self-hosted)
- Served from Google Fonts (already CORS-enabled)

## Future API Considerations

If the feature evolves to include server-side persistence, these contracts would be needed:

### Save Font Preference

```
POST /api/user/preferences/font
{
  "fontFamily": "inter"
}
```

### Get Font Preference

```
GET /api/user/preferences/font
Response: {
  "fontFamily": "inter",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

Currently, these are **NOT IMPLEMENTED** as the feature uses localStorage only.
