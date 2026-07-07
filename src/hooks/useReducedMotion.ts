/**
 * useReducedMotion Hook
 * Feature 047 — Three.js Game (T003)
 *
 * Reads the user's OS-level `prefers-reduced-motion` preference and responds
 * to runtime changes (e.g., user toggles their accessibility setting without
 * reloading the page).
 *
 * Returns `true` when the user has expressed a preference for reduced motion.
 * Used by `Controls` to disable auto-orbit and idle animations per spec
 * FR-004 and US-3 acceptance scenarios.
 *
 * @example
 * ```tsx
 * const reducedMotion = useReducedMotion();
 * // ...
 * <OrbitControls autoRotate={!reducedMotion} />
 * ```
 */

'use client';

import { useState, useEffect } from 'react';

/**
 * Hook for OS-level `prefers-reduced-motion` detection with runtime reactivity.
 *
 * Features:
 * - SSR-safe (returns `false` during SSR; updates on hydration)
 * - Updates when the user toggles the OS preference at runtime (no reload required)
 * - Cleans up the media-query listener on unmount
 *
 * @returns `true` if the user prefers reduced motion, `false` otherwise.
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(
    () => {
      if (typeof window === 'undefined') return false;
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Set the initial value post-hydration (in case SSR returned false but
    // the user actually has the preference set).
    setPrefersReducedMotion(mediaQuery.matches);

    function handleChange(event: MediaQueryListEvent) {
      setPrefersReducedMotion(event.matches);
    }

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}
