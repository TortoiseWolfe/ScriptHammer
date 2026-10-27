import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  KID_SAFE_ROUTES,
  isKidSafeRoute,
  isKidSafeLocation,
} from './kid-safe-routes';

describe('isKidSafeRoute', () => {
  it('lists /band', () => {
    expect(KID_SAFE_ROUTES).toContain('/band');
  });

  it.each(['/band', '/band/', '/band/anything', '/band/deep/path/'])(
    'accepts %s',
    (p) => {
      expect(isKidSafeRoute(p)).toBe(true);
    }
  );

  it.each([
    '/',
    '/bandwagon',
    '/blog/band',
    '/pricing/',
    '/ban',
    '',
    null,
    undefined,
  ])('rejects %s', (p) => {
    expect(isKidSafeRoute(p)).toBe(false);
  });

  describe('with a basePath', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('strips the basePath before matching', () => {
      vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/ScriptHammer');
      expect(isKidSafeRoute('/ScriptHammer/band/')).toBe(true);
      expect(isKidSafeRoute('/ScriptHammer/band')).toBe(true);
      expect(isKidSafeRoute('/ScriptHammer/')).toBe(false);
      expect(isKidSafeRoute('/ScriptHammer')).toBe(false);
      expect(isKidSafeRoute('/ScriptHammerband')).toBe(false);
    });
  });
});

describe('isKidSafeLocation', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('is true on /band and false elsewhere', () => {
    window.history.replaceState({}, '', '/band/');
    expect(isKidSafeLocation()).toBe(true);
    window.history.replaceState({}, '', '/pricing/');
    expect(isKidSafeLocation()).toBe(false);
  });
});
