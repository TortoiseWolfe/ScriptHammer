/**
 * Font System Type Definitions
 * Provides TypeScript interfaces for the font switching feature
 */

/**
 * Font category types for grouping fonts
 */
export type FontCategory = 'sans-serif' | 'serif' | 'monospace' | 'display';

/**
 * Accessibility features that fonts may provide
 */
export type FontAccessibility = 'dyslexia-friendly' | 'high-readability';

/**
 * Font loading strategies
 */
export type FontLoadingStrategy = 'system' | 'google-fonts' | 'local';

/**
 * Configuration for a single font option
 */
export interface FontConfig {
  /** Unique identifier for the font */
  id: string;

  /** Display name shown to users */
  name: string;

  /** CSS font-family stack */
  stack: string;

  /** Font category for grouping */
  category: FontCategory;

  /** User-friendly description */
  description: string;

  /** Optional accessibility feature flag */
  accessibility?: FontAccessibility;

  /** Loading strategy for the font */
  loading?: FontLoadingStrategy;

  /** Font file URL if local or CDN */
  url?: string;

  /** Available font weights */
  weights?: number[];

  /** Preview text for dropdown display */
  previewText?: string;
}

/**
 * User's font preferences stored in localStorage
 */
export interface FontSettings {
  /** Selected font ID */
  fontFamily: string;

  /** Timestamp of last change */
  lastUpdated?: number;

  /** User's preferred fonts history for quick switching */
  recentFonts?: string[];
}

/**
 * Runtime state for font loading management
 */
export interface FontLoadState {
  /** Font ID */
  id: string;

  /** Loading status */
  status: 'idle' | 'loading' | 'loaded' | 'error';

  /** Error message if failed */
  error?: string;

  /** Load timestamp */
  loadedAt?: number;
}

/**
 * Return type for the useFontFamily hook
 */
export interface UseFontFamilyReturn {
  /** Current font ID */
  fontFamily: string;

  /** Current font configuration */
  currentFontConfig: FontConfig | undefined;

  /** All available fonts */
  fonts: FontConfig[];

  /** Set font family function */
  setFontFamily: (fontId: string) => void;

  /** Get font by ID */
  getFontById: (fontId: string) => FontConfig | undefined;

  /** Check if font is loaded */
  isFontLoaded: (fontId: string) => boolean;

  /** Recent fonts for quick access */
  recentFonts: string[];

  /** Clear font preference */
  resetFont: () => void;
}

/**
 * Font change event detail
 */
export interface FontChangeEventDetail {
  previousFont: string;
  newFont: string;
  timestamp: number;
}

/**
 * Font load event detail
 */
export interface FontLoadEventDetail {
  fontId: string;
  success: boolean;
  duration: number;
}

/**
 * Font metrics for performance tracking
 */
export interface FontMetrics {
  /** Font ID being tracked */
  fontId: string;

  /** Font switch performance */
  switchDuration: number;

  /** Font load time */
  loadDuration: number;

  /** Time to first render */
  renderTime: number;

  /** Layout shift amount */
  layoutShift: number;
}
