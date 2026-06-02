import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Result } from 'axe-core';

/**
 * Shape returned by {@link useA11yScan}.
 */
export interface UseA11yScanResult {
  /** Current axe-core violations for the live document. */
  violations: Result[];
  /** True while an axe scan is in flight. */
  isScanning: boolean;
  /** Epoch ms of the last completed scan, or null if none has run. */
  lastScanAt: number | null;
  /** Manually trigger a (debounced) re-scan. */
  rescan: () => void;
}

/** Debounce window (ms) that coalesces route changes, DOM mutations, and StrictMode double-effects. */
const SCAN_DEBOUNCE_MS = 500;

/**
 * Loads axe-core, but ONLY in development.
 *
 * The `import('axe-core')` is wrapped in a literal `process.env.NODE_ENV === 'development'`
 * check so that Next.js's DefinePlugin replaces the condition with `false` in production
 * builds and webpack statically eliminates the dynamic import (and the ~1.3 MB axe-core
 * engine) from the bundle. The comparison MUST be lexically adjacent to `import()` — routing
 * it through an `enabled` variable defeats webpack's dead-code analysis and ships axe to prod.
 */
async function loadAxe() {
  if (process.env.NODE_ENV === 'development') {
    return (await import('axe-core')).default;
  }
  return null;
}

/**
 * Owns the dev-only axe-core scan lifecycle for {@link A11yDevOverlay}.
 *
 * Responsibilities:
 * - Dynamically `import('axe-core')` ONLY in development, inside the gated branch, so the
 *   production static export tree-shakes the dependency out entirely.
 * - Scan on mount, on App Router route change (`usePathname`), on debounced DOM mutations
 *   (MutationObserver), and on manual `rescan()`.
 *
 * In any non-development environment (production, test) the hook is inert: it returns empty
 * state and never imports axe-core, so component tests can render deterministically without
 * invoking a real scan.
 */
export function useA11yScan(): UseA11yScanResult {
  const enabled = process.env.NODE_ENV === 'development';
  const pathname = usePathname();

  const [violations, setViolations] = useState<Result[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);

  // Refs avoid stale closures and let cleanup cancel in-flight work.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanningRef = useRef(false);
  const mountedRef = useRef(true);

  const runScan = useCallback(async () => {
    if (!enabled || scanningRef.current) return;
    scanningRef.current = true;
    setIsScanning(true);
    try {
      const axe = await loadAxe();
      if (!axe) return;
      const results = await axe.run(document, { resultTypes: ['violations'] });
      if (!mountedRef.current) return;
      setViolations(results.violations);
      setLastScanAt(Date.now());
    } catch {
      // A failed scan must never break the host app; surface nothing and keep prior results.
    } finally {
      scanningRef.current = false;
      if (mountedRef.current) setIsScanning(false);
    }
  }, [enabled]);

  const scheduleScan = useCallback(() => {
    if (!enabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runScan();
    }, SCAN_DEBOUNCE_MS);
  }, [enabled, runScan]);

  // Scan on mount and whenever the route changes.
  useEffect(() => {
    if (!enabled) return;
    scheduleScan();
  }, [enabled, pathname, scheduleScan]);

  // Re-scan (debounced) when the DOM changes — covers client-side content that renders after navigation.
  useEffect(() => {
    if (!enabled || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => scheduleScan());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    return () => observer.disconnect();
  }, [enabled, scheduleScan]);

  // Track mount state and clear any pending debounce on unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { violations, isScanning, lastScanAt, rescan: scheduleScan };
}
