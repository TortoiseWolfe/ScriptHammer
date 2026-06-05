/**
 * Storage-quota helper for the offline queue (#32, feature 020).
 *
 * The offline queue persists items in IndexedDB. On constrained devices
 * (especially iOS Safari, which caps per-origin storage aggressively) the queue
 * can fill the origin's quota and silently fail to persist new items. This
 * helper wraps the StorageManager API (`navigator.storage.estimate()`) so the UI
 * can warn the user before that happens.
 *
 * `navigator.storage` is unavailable in some browsers (older Safari, non-secure
 * contexts) — every function degrades gracefully to "unknown / no warning"
 * rather than throwing.
 */

/** Fraction of quota at which we surface a warning (80%). */
export const STORAGE_WARNING_THRESHOLD = 0.8;

export interface StorageEstimateResult {
  /** Bytes currently used by this origin, or null if unavailable. */
  usage: number | null;
  /** Total bytes available to this origin, or null if unavailable. */
  quota: number | null;
  /** usage/quota in [0,1], or null if unavailable. */
  ratio: number | null;
  /** True when ratio >= STORAGE_WARNING_THRESHOLD. */
  warning: boolean;
  /** True when the StorageManager API isn't available in this environment. */
  supported: boolean;
}

const EMPTY: StorageEstimateResult = {
  usage: null,
  quota: null,
  ratio: null,
  warning: false,
  supported: false,
};

/**
 * Estimate current origin storage usage. Never throws — returns an
 * `unsupported` result if the API is missing or the call fails.
 */
export async function estimateStorage(): Promise<StorageEstimateResult> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.estimate !== 'function'
  ) {
    return EMPTY;
  }

  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (typeof usage !== 'number' || typeof quota !== 'number' || quota <= 0) {
      return { ...EMPTY, supported: true };
    }
    const ratio = usage / quota;
    return {
      usage,
      quota,
      ratio,
      warning: ratio >= STORAGE_WARNING_THRESHOLD,
      supported: true,
    };
  } catch {
    return { ...EMPTY, supported: true };
  }
}

/**
 * Convenience: true when storage usage is at/over the warning threshold.
 */
export async function isStorageNearQuota(): Promise<boolean> {
  const { warning } = await estimateStorage();
  return warning;
}

/**
 * Format a usage/quota pair as a short human string, e.g. "8.2 MB of 10 MB".
 * Returns null when either side is unknown.
 */
export function formatStorageUsage(
  usage: number | null,
  quota: number | null
): string | null {
  if (usage == null || quota == null) return null;
  const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${mb(usage)} of ${mb(quota)}`;
}
