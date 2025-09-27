# Font Switcher Data Model

## Core Entities

### FontConfig

Represents a single font option available to users.

```typescript
interface FontConfig {
  // Unique identifier for the font
  id: string;

  // Display name shown to users
  name: string;

  // CSS font-family stack
  stack: string;

  // Font category for grouping
  category: 'sans-serif' | 'serif' | 'monospace' | 'display';

  // User-friendly description
  description: string;

  // Optional accessibility feature flag
  accessibility?: 'dyslexia-friendly' | 'high-readability';

  // Loading strategy
  loading?: 'system' | 'google-fonts' | 'local';

  // Font file URL if local
  url?: string;

  // Font weights available
  weights?: number[];

  // Preview text for dropdown
  previewText?: string;
}
```

### FontSettings

User's font preferences stored in localStorage.

```typescript
interface FontSettings {
  // Selected font ID
  fontFamily: string;

  // Timestamp of last change
  lastUpdated?: number;

  // User's preferred fonts history (for quick switching)
  recentFonts?: string[];
}
```

### FontLoadState

Runtime state for font loading management.

```typescript
interface FontLoadState {
  // Font ID
  id: string;

  // Loading status
  status: 'idle' | 'loading' | 'loaded' | 'error';

  // Error message if failed
  error?: string;

  // Load timestamp
  loadedAt?: number;
}
```

## Configuration Data

### Default Font Collection

```typescript
const defaultFonts: FontConfig[] = [
  {
    id: 'system',
    name: 'System Default',
    stack:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    category: 'sans-serif',
    description: "Uses your operating system's default font",
    loading: 'system',
    previewText: 'The quick brown fox jumps over the lazy dog',
  },
  {
    id: 'inter',
    name: 'Inter',
    stack: '"Inter", system-ui, sans-serif',
    category: 'sans-serif',
    description: 'Modern, highly legible font designed for screens',
    loading: 'google-fonts',
    weights: [300, 400, 500, 600, 700],
    url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300..700&display=swap',
  },
  {
    id: 'opendyslexic',
    name: 'OpenDyslexic',
    stack: '"OpenDyslexic", sans-serif',
    category: 'sans-serif',
    description: 'Designed to help with dyslexia',
    accessibility: 'dyslexia-friendly',
    loading: 'local',
    url: '/fonts/OpenDyslexic-Regular.woff2',
    weights: [400, 700],
  },
  {
    id: 'atkinson',
    name: 'Atkinson Hyperlegible',
    stack: '"Atkinson Hyperlegible", system-ui, sans-serif',
    category: 'sans-serif',
    description: 'Designed for maximum legibility',
    accessibility: 'high-readability',
    loading: 'google-fonts',
    weights: [400, 700],
    url: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap',
  },
  {
    id: 'georgia',
    name: 'Georgia',
    stack: 'Georgia, "Times New Roman", Times, serif',
    category: 'serif',
    description: 'Classic serif font for long-form reading',
    loading: 'system',
  },
  {
    id: 'jetbrains',
    name: 'JetBrains Mono',
    stack: '"JetBrains Mono", "SF Mono", Monaco, "Courier New", monospace',
    category: 'monospace',
    description: 'Developer-friendly monospace font',
    loading: 'google-fonts',
    weights: [400, 600],
    url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap',
  },
];
```

## State Management

### Hook State Shape

```typescript
interface UseFontFamilyState {
  // Current font ID
  currentFont: string;

  // All available fonts
  fonts: FontConfig[];

  // Loading states for web fonts
  loadStates: Map<string, FontLoadState>;

  // Whether preferences are being loaded
  isLoading: boolean;

  // Error state
  error: string | null;
}
```

### Hook Return Type

```typescript
interface UseFontFamilyReturn {
  // Current font ID
  fontFamily: string;

  // Current font configuration
  currentFontConfig: FontConfig | undefined;

  // All available fonts
  fonts: FontConfig[];

  // Set font family
  setFontFamily: (fontId: string) => void;

  // Get font by ID
  getFontById: (fontId: string) => FontConfig | undefined;

  // Check if font is loaded
  isFontLoaded: (fontId: string) => boolean;

  // Recent fonts for quick access
  recentFonts: string[];

  // Clear font preference
  resetFont: () => void;
}
```

## Storage Schema

### localStorage Keys

```typescript
const STORAGE_KEYS = {
  // Current font selection
  FONT_FAMILY: 'font-family',

  // Full settings object
  FONT_SETTINGS: 'font-settings',

  // Cache for loaded fonts
  FONT_CACHE: 'font-cache',

  // User's font history
  FONT_HISTORY: 'font-history',
} as const;
```

### Storage Format

```json
{
  "font-family": "inter",
  "font-settings": {
    "fontFamily": "inter",
    "lastUpdated": 1704067200000,
    "recentFonts": ["inter", "opendyslexic", "system"]
  },
  "font-cache": {
    "inter": {
      "loaded": true,
      "timestamp": 1704067200000
    }
  },
  "font-history": ["system", "inter", "atkinson", "inter"]
}
```

## CSS Variables

### Root Variables

```css
:root {
  /* Primary font family */
  --font-family: system-ui, -apple-system, sans-serif;

  /* Font size adjustment for consistency */
  --font-size-adjust: 0.5;

  /* Font smoothing settings */
  --font-smoothing: antialiased;

  /* Letter spacing adjustments */
  --font-letter-spacing: normal;

  /* Line height for readability */
  --font-line-height: 1.5;
}
```

### Applied Styles

```css
body {
  font-family: var(--font-family);
  font-size-adjust: var(--font-size-adjust);
  -webkit-font-smoothing: var(--font-smoothing);
  -moz-osx-font-smoothing: grayscale;
  letter-spacing: var(--font-letter-spacing);
  line-height: var(--font-line-height);
}
```

## Event System

### Custom Events

```typescript
// Font change event
interface FontChangeEvent extends CustomEvent {
  detail: {
    previousFont: string;
    newFont: string;
    timestamp: number;
  };
}

// Font load event
interface FontLoadEvent extends CustomEvent {
  detail: {
    fontId: string;
    success: boolean;
    duration: number;
  };
}
```

### Event Dispatching

```typescript
// Dispatch font change
window.dispatchEvent(
  new CustomEvent('fontchange', {
    detail: {
      previousFont: 'system',
      newFont: 'inter',
      timestamp: Date.now(),
    },
  })
);

// Listen for font changes
window.addEventListener('fontchange', (event: FontChangeEvent) => {
  console.log(
    `Font changed from ${event.detail.previousFont} to ${event.detail.newFont}`
  );
});
```

## Validation Rules

### Font ID Validation

- Must be alphanumeric with hyphens
- Must exist in font configuration
- Cannot be empty

### Font Stack Validation

- Must be valid CSS font-family syntax
- Must include at least one generic fallback
- Must be properly quoted if contains spaces

### Settings Validation

- Font ID must be valid
- Timestamp must be valid number
- Recent fonts array max length: 5

## Migration Strategy

### From No Font System

```typescript
const migrateToFontSystem = () => {
  // Check for any existing font preferences
  const existingFont = localStorage.getItem('user-font');

  if (existingFont) {
    // Migrate old format
    const settings: FontSettings = {
      fontFamily: existingFont || 'system',
      lastUpdated: Date.now(),
      recentFonts: [],
    };

    localStorage.setItem(STORAGE_KEYS.FONT_SETTINGS, JSON.stringify(settings));
    localStorage.removeItem('user-font');
  }
};
```

### Version Updates

```typescript
interface VersionedFontSettings extends FontSettings {
  version: number;
}

const CURRENT_VERSION = 1;

const upgradeSettings = (settings: any): VersionedFontSettings => {
  if (!settings.version || settings.version < CURRENT_VERSION) {
    // Apply migrations
    return {
      ...settings,
      version: CURRENT_VERSION,
      // Add new fields with defaults
      recentFonts: settings.recentFonts || [],
    };
  }
  return settings;
};
```

## Performance Metrics

### Tracking Data

```typescript
interface FontMetrics {
  // Font switch performance
  switchDuration: number;

  // Font load time
  loadDuration: number;

  // Time to first render
  renderTime: number;

  // Layout shift amount
  layoutShift: number;
}
```

### Analytics Events

```typescript
const trackFontChange = (metrics: FontMetrics) => {
  // Send to analytics
  if (window.gtag) {
    window.gtag('event', 'font_change', {
      event_category: 'accessibility',
      event_label: metrics.fontId,
      value: metrics.switchDuration,
    });
  }
};
```
