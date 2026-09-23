/**
 * Remove private-key material a shipped build left in localStorage (#1243).
 *
 * Commit 577cd243 (2026-03-26) cached derived ECDH keys — including the private
 * JWK — under `sh_keys_<userId>` in localStorage. Commit 5ba2323e (2026-04-26)
 * replaced that with a non-extractable CryptoKey in IndexedDB and deleted the
 * writer, but it deleted the logout cleanup with it, and nothing since has looked
 * for what was already written. A browser that signed in during that month and
 * never signed out before the cleanup vanished still holds a raw private key,
 * readable by any script on the origin.
 *
 * Idempotent, one pass over the keys, never throws: a disabled or private-mode
 * storage has nothing to sweep and must not break sign-in to say so.
 */
export const LEGACY_KEY_PREFIX = 'sh_keys_';

type SweepableStorage = Pick<Storage, 'length' | 'key' | 'removeItem'>;

function defaultStorage(): SweepableStorage | undefined {
  // Reading `localStorage` itself can throw (SecurityError when storage is
  // blocked), so the lookup lives inside the caller's try.
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

/** @returns how many legacy entries were removed */
export function sweepLegacyLocalStorageKeys(
  storage?: SweepableStorage
): number {
  let removed = 0;
  try {
    const s = storage ?? defaultStorage();
    if (!s) return 0;
    const doomed: string[] = [];
    for (let i = 0; i < s.length; i += 1) {
      const k = s.key(i);
      if (k && k.startsWith(LEGACY_KEY_PREFIX)) doomed.push(k);
    }
    for (const k of doomed) {
      s.removeItem(k);
      removed += 1;
    }
  } catch {
    // Storage unavailable — nothing to sweep, nothing to report.
  }
  return removed;
}
