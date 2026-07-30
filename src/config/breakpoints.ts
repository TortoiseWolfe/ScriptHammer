/**
 * Breakpoint Configuration
 * PRP-017: Mobile-First Design Overhaul
 *
 * Defines responsive breakpoints matching Tailwind CSS 4 configuration
 * Following mobile-first design principles
 */

import type { BreakpointConfig } from '@/types/mobile-first';

/**
 * Responsive breakpoint definitions
 *
 * Strategy: Mobile-first with progressive enhancement
 * - xs (320px): Minimum supported mobile width
 * - sm (430px): Standard mobile devices
 * - md (768px): Tablet portrait
 * - lg (1024px): Desktop and tablet landscape
 * - xl (1280px): Large desktop
 *
 * Note: Tailwind CSS 4 uses `@theme` in globals.css for configuration, which is
 * the SOURCE OF TRUTH — this file mirrors it, and `pnpm validate:breakpoints`
 * fails when the two disagree.
 *
 * `sm` is 430px, not 428px, deliberately: the iPhone 14 Pro Max is exactly 428
 * CSS px, and it is a phone, so `sm:` utilities must NOT apply there. That is
 * also why `xs` ends at 429 rather than 427 — 428 and 429 belong to the phone
 * bucket. This file said 428 while globals.css said 430, so at 428-429px the
 * hand-written media queries fired and no Tailwind `sm:` utility did (#373 B2).
 */
export const BREAKPOINTS: BreakpointConfig[] = [
  {
    name: 'xs',
    minWidth: 320,
    maxWidth: 429,
    category: 'mobile',
    mediaQuery: '(min-width: 320px) and (max-width: 429px)',
  },
  {
    name: 'sm',
    minWidth: 430,
    maxWidth: 767,
    category: 'mobile',
    mediaQuery: '(min-width: 430px) and (max-width: 767px)',
  },
  {
    name: 'md',
    minWidth: 768,
    maxWidth: 1023,
    category: 'tablet',
    mediaQuery: '(min-width: 768px) and (max-width: 1023px)',
  },
  {
    name: 'lg',
    minWidth: 1024,
    maxWidth: 1279,
    category: 'desktop',
    mediaQuery: '(min-width: 1024px) and (max-width: 1279px)',
  },
  {
    name: 'xl',
    minWidth: 1280,
    category: 'desktop',
    mediaQuery: '(min-width: 1280px)',
  },
];

/**
 * Get breakpoint configuration by name
 */
export function getBreakpoint(name: string): BreakpointConfig | undefined {
  return BREAKPOINTS.find((bp) => bp.name === name);
}

/**
 * Get breakpoint by viewport width
 */
export function getBreakpointByWidth(width: number): BreakpointConfig {
  // Find first breakpoint where width >= minWidth and width <= maxWidth (if defined)
  const breakpoint = BREAKPOINTS.find((bp) => {
    const meetsMin = width >= bp.minWidth;
    const meetsMax = bp.maxWidth === undefined || width <= bp.maxWidth;
    return meetsMin && meetsMax;
  });

  // Default to xl if width is larger than all breakpoints
  return breakpoint || BREAKPOINTS[BREAKPOINTS.length - 1];
}

/**
 * Check if current width matches breakpoint
 */
export function matchesBreakpoint(width: number, breakpoint: string): boolean {
  const bp = getBreakpoint(breakpoint);
  if (!bp) return false;

  const meetsMin = width >= bp.minWidth;
  const meetsMax = bp.maxWidth === undefined || width <= bp.maxWidth;
  return meetsMin && meetsMax;
}

/**
 * Get device category by viewport width
 */
export function getDeviceCategory(width: number): string {
  const breakpoint = getBreakpointByWidth(width);
  return breakpoint.category;
}

/**
 * Mobile-first media query helpers
 */
export const mediaQueries = {
  /** Mobile and up (>= 320px) */
  mobile: '(min-width: 320px)',
  /** Standard mobile and up (>= 430px) */
  sm: '(min-width: 430px)',
  /** Tablet and up (>= 768px) */
  md: '(min-width: 768px)',
  /** Desktop and up (>= 1024px) */
  lg: '(min-width: 1024px)',
  /** Large desktop and up (>= 1280px) */
  xl: '(min-width: 1280px)',
  /** Only mobile (< 768px) */
  mobileOnly: '(max-width: 767px)',
  /** Only tablet (768px - 1023px) */
  tabletOnly: '(min-width: 768px) and (max-width: 1023px)',
  /** Only desktop (>= 1024px) */
  desktopOnly: '(min-width: 1024px)',
} as const;
