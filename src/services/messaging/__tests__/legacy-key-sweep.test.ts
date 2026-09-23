import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sweepLegacyLocalStorageKeys,
  LEGACY_KEY_PREFIX,
} from '../legacy-key-sweep';

describe('sweepLegacyLocalStorageKeys (#1243)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes every sh_keys_* entry and nothing else', () => {
    localStorage.setItem(`${LEGACY_KEY_PREFIX}user-a`, '{"privateKeyJwk":{}}');
    localStorage.setItem(`${LEGACY_KEY_PREFIX}user-b`, '{}');
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('sh_keys', 'not-prefixed-with-underscore');

    expect(sweepLegacyLocalStorageKeys()).toBe(2);
    expect(localStorage.getItem(`${LEGACY_KEY_PREFIX}user-a`)).toBeNull();
    expect(localStorage.getItem(`${LEGACY_KEY_PREFIX}user-b`)).toBeNull();
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('sh_keys')).toBe(
      'not-prefixed-with-underscore'
    );
  });

  it('is idempotent', () => {
    localStorage.setItem(`${LEGACY_KEY_PREFIX}x`, '{}');
    expect(sweepLegacyLocalStorageKeys()).toBe(1);
    expect(sweepLegacyLocalStorageKeys()).toBe(0);
  });

  it('does not throw when storage throws (private mode / blocked storage)', () => {
    const hostile = {
      get length(): number {
        throw new Error('SecurityError');
      },
      key: () => null,
      removeItem: () => undefined,
    };
    expect(() => sweepLegacyLocalStorageKeys(hostile)).not.toThrow();
    expect(sweepLegacyLocalStorageKeys(hostile)).toBe(0);
  });

  it('CONTROL: the harness can see an entry that is NOT swept', () => {
    // Without this, "everything was removed" is indistinguishable from
    // "localStorage never held anything" in this environment.
    localStorage.setItem('keep-me', '1');
    expect(localStorage.length).toBe(1);
  });

  it('runs again on clearKeys(), so a logout after the fact still cleans up', async () => {
    vi.resetModules();
    const { keyManagementService } = await import('../key-service');
    localStorage.setItem(`${LEGACY_KEY_PREFIX}late`, '{"d":"private"}');
    keyManagementService.clearKeys();
    expect(localStorage.getItem(`${LEGACY_KEY_PREFIX}late`)).toBeNull();
  });

  it('runs when the key service module loads', async () => {
    localStorage.setItem(`${LEGACY_KEY_PREFIX}stale`, '{"d":"private"}');
    vi.resetModules();
    await import('../key-service');
    expect(localStorage.getItem(`${LEGACY_KEY_PREFIX}stale`)).toBeNull();
  });
});
