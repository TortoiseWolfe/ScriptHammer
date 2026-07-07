/**
 * useDeviceType Hook
 * PRP-017 T024: Device Type Detection
 *
 * Hybrid device detection combining:
 * - Touch capability (navigator.maxTouchPoints)
 * - Viewport dimensions (with orientation awareness)
 * - Physical device type persistence across orientation changes
 *
 * Based on research.md Decision 1: Hybrid Detection Strategy
 *
 * @example
 * ```tsx
 * const deviceInfo = useDeviceType();
 * if (deviceInfo.type === 'mobile') {
 *   // Render mobile-optimized layout
 * }
 * ```
 */

'use client';

import { useState, useEffect } from 'react';
import type {
  DeviceInfo,
  DeviceCategory,
  Orientation,
  BreakpointName,
} from '@/types/mobile-first';
import { getBreakpointByWidth } from '@/config/breakpoints';

/**
 * Detect device type using hybrid approach
 * @returns DeviceInfo object with category, orientation, touch capability
 */
function detectDevice(): DeviceInfo {
  // SSR fallback
  if (typeof window === 'undefined') {
    return {
      width: 1920,
      height: 1080,
      breakpoint: 'xl',
      category: 'desktop',
      orientation: 'landscape',
      hasTouch: false,
      isStandalone: false,
      pixelRatio: 1,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  // Use MAXIMUM dimension to determine physical device type
  // This ensures iPhone 12 rotated to 844x390 landscape stays "mobile"
  const maxDimension = Math.max(width, height);

  // Touch capability detection
  const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;

  // Hybrid detection logic
  let category: DeviceCategory = 'desktop';

  if (hasTouch) {
    // Touch-enabled device - use max dimension to determine category
    if (maxDimension <= 926) {
      // iPhone 14 Pro Max landscape (926x428) is the largest mobile
      category = 'mobile';
    } else if (maxDimension <= 1366) {
      // iPad Pro landscape (1366x1024) is the largest tablet
      category = 'tablet';
    } else {
      // Larger touch devices (touchscreen laptops, etc.)
      category = 'desktop';
    }
  } else {
    // Non-touch device - standard breakpoint logic
    if (width < 768) {
      category = 'mobile';
    } else if (width < 1024) {
      category = 'tablet';
    } else {
      category = 'desktop';
    }
  }

  // Orientation detection
  const orientation: Orientation = width > height ? 'landscape' : 'portrait';

  // Get breakpoint for current width
  const breakpointConfig = getBreakpointByWidth(width);

  // Check if running as PWA
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true;

  return {
    width,
    height,
    breakpoint: breakpointConfig.name,
    category,
    orientation,
    hasTouch,
    isStandalone,
    pixelRatio: window.devicePixelRatio || 1,
  };
}

/**
 * Hook for responsive device type detection
 *
 * Features:
 * - SSR-safe (returns desktop during SSR)
 * - Updates on window resize
 * - Updates on orientation change
 * - Stable across orientation changes (mobile stays mobile)
 *
 * @returns DeviceInfo object
 */
export function useDeviceType(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(detectDevice);

  useEffect(() => {
    // Initial detection after hydration
    setDeviceInfo(detectDevice());

    // Update on resize
    function handleResize() {
      setDeviceInfo(detectDevice());
    }

    // Update on orientation change
    function handleOrientationChange() {
      setDeviceInfo(detectDevice());
    }

    // Debounce resize events (optional optimization)
    let resizeTimer: NodeJS.Timeout;
    function debouncedResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, 100);
    }

    window.addEventListener('resize', debouncedResize);

    // Listen for orientation change events
    const mediaQuery = window.matchMedia('(orientation: portrait)');
    mediaQuery.addEventListener('change', handleOrientationChange);

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', debouncedResize);
      mediaQuery.removeEventListener('change', handleOrientationChange);
    };
  }, []);

  return deviceInfo;
}

/**
 * Helper: Check if device is mobile (shorthand)
 */
export function useIsMobile(): boolean {
  const { category } = useDeviceType();
  return category === 'mobile';
}

/**
 * Helper: Check if device is tablet (shorthand)
 */
export function useIsTablet(): boolean {
  const { category } = useDeviceType();
  return category === 'tablet';
}

/**
 * Helper: Check if device is desktop (shorthand)
 */
export function useIsDesktop(): boolean {
  const { category } = useDeviceType();
  return category === 'desktop';
}

/**
 * Helper: Check if device has touch capability
 */
export function useHasTouch(): boolean {
  const { hasTouch } = useDeviceType();
  return hasTouch;
}
