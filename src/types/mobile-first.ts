/**
 * Mobile-First Design Type Definitions
 * PRP-017: Mobile-First Design Overhaul
 *
 * Core types for responsive design system following mobile-first principles
 */

// ============================================================================
// Breakpoint System
// ============================================================================

/**
 * Breakpoint names matching Tailwind configuration
 */
export type BreakpointName = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Device categories for responsive behavior
 */
export type DeviceCategory = 'mobile' | 'tablet' | 'desktop';

/**
 * Breakpoint configuration with min-width thresholds
 */
export interface BreakpointConfig {
  /** Breakpoint identifier */
  name: BreakpointName;
  /** Minimum width in pixels */
  minWidth: number;
  /** Maximum width in pixels (undefined for largest breakpoint) */
  maxWidth?: number;
  /** Device category this breakpoint represents */
  category: DeviceCategory;
  /** CSS media query string */
  mediaQuery: string;
}

// ============================================================================
// Device Detection
// ============================================================================

/**
 * Orientation states for mobile devices
 */
export type Orientation = 'portrait' | 'landscape';

/**
 * Device type detection result
 */
export interface DeviceInfo {
  /** Current viewport width */
  width: number;
  /** Current viewport height */
  height: number;
  /** Active breakpoint name */
  breakpoint: BreakpointName;
  /** Device category */
  category: DeviceCategory;
  /** Current orientation */
  orientation: Orientation;
  /** Whether device has touch support */
  hasTouch: boolean;
  /** Whether device is in standalone PWA mode */
  isStandalone: boolean;
  /** Device pixel ratio */
  pixelRatio: number;
}

// ============================================================================
// Touch Targets
// ============================================================================

/**
 * WCAG compliance levels for touch targets
 */
export type TouchTargetLevel = 'AA' | 'AAA';

/**
 * Touch target size and spacing requirements
 */
export interface TouchTarget {
  /** Minimum width in pixels */
  minWidth: number;
  /** Minimum height in pixels */
  minHeight: number;
  /** Minimum spacing between targets in pixels */
  minSpacing: number;
  /** WCAG compliance level or custom standard */
  standard: string;
}

/**
 * Touch target validation result
 */
export interface TouchTargetValidation {
  /** Whether target meets minimum size requirements */
  isValid: boolean;
  /** Current width */
  actualWidth: number;
  /** Current height */
  actualHeight: number;
  /** Required minimum width */
  requiredWidth: number;
  /** Required minimum height */
  requiredHeight: number;
  /** Validation errors if any */
  errors?: string[];
}

// ============================================================================
// Responsive Images
// ============================================================================

/**
 * Image format types supported
 */
export type ImageFormat = 'avif' | 'webp' | 'png' | 'jpg';

/**
 * Image size categories
 */
export type ImageCategory = 'hero' | 'thumbnail' | 'og';

/**
 * Responsive image configuration
 */
export interface ResponsiveImageConfig {
  /** Base source path */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Image category for optimization */
  category: ImageCategory;
  /** Available widths for srcset */
  widths: number[];
  /** Preferred formats in order of priority */
  formats: ImageFormat[];
  /** Loading strategy */
  loading?: 'lazy' | 'eager';
  /** Sizes attribute for responsive loading */
  sizes?: string;
  /** Image quality (1-100) */
  quality?: number;
}

/**
 * Generated image source for picture element
 */
export interface ImageSource {
  /** Image format */
  format: ImageFormat;
  /** Source set with width descriptors */
  srcSet: string;
  /** MIME type */
  type: string;
}

// ============================================================================
// Typography
// ============================================================================

/**
 * Fluid typography configuration using CSS clamp()
 */
export interface TypographyScale {
  /** Typography level (h1, h2, body, etc.) */
  level: string;
  /** Minimum font size in rem */
  minSize: number;
  /** Maximum font size in rem */
  maxSize: number;
  /** Minimum viewport width for scaling */
  minViewport: number;
  /** Maximum viewport width for scaling */
  maxViewport: number;
  /** Generated CSS clamp() value */
  clampValue: string;
  /** Line height multiplier */
  lineHeight: number;
}

// ============================================================================
// Testing
// ============================================================================

/**
 * Test viewport configuration for Playwright
 */
export interface TestViewport {
  /** Viewport name (e.g., "iPhone 12") */
  name: string;
  /** Device category */
  category: DeviceCategory;
  /** Viewport width in pixels */
  width: number;
  /** Viewport height in pixels */
  height: number;
  /** Device pixel ratio */
  deviceScaleFactor: number;
  /** Whether device has touch support */
  hasTouch: boolean;
  /** Whether device is mobile */
  isMobile: boolean;
  /** User agent string */
  userAgent?: string;
}

// ============================================================================
// Component Props
// ============================================================================

/**
 * Responsive spacing values for Tailwind utilities
 */
export type ResponsiveSpacing = {
  /** Mobile spacing (default/xs/sm) */
  mobile?: string;
  /** Tablet spacing (md) */
  tablet?: string;
  /** Desktop spacing (lg/xl) */
  desktop?: string;
};

/**
 * Responsive container configuration
 */
export interface ResponsiveContainer {
  /** Whether to use full width on mobile */
  fullWidthMobile?: boolean;
  /** Padding configuration */
  padding?: ResponsiveSpacing;
  /** Maximum width constraint */
  maxWidth?: string;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Responsive prop pattern for components
 * Example: { mobile: 'flex-col', tablet: 'flex-row' }
 */
export type ResponsiveProp<T> = {
  mobile?: T;
  tablet?: T;
  desktop?: T;
};

/**
 * Breakpoint matcher for conditional rendering
 */
export type BreakpointMatcher = {
  [K in BreakpointName]?: boolean;
};
