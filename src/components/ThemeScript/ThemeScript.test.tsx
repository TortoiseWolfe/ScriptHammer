import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ThemeScript from './ThemeScript';
import { CONSENT_STORAGE_KEY } from '@/config/accessibility-tokens';

/**
 * This script prevents the flash of unstyled theme, and until now nothing tested it.
 *
 * It is not pattern-matched — it is EXECUTED. `new Function` is safe here for the same
 * reason StylesheetGuard.test.tsx gives: its only input is this component's own compiled-in
 * template literal, which is exactly what ships, and executing what ships is the point.
 * jsdom reproduces everything the script depends on — localStorage, matchMedia, events.
 */
const scriptText = () => {
  const { container } = render(<ThemeScript />);
  const script = container.querySelector('script');
  expect(script).not.toBeNull();
  return script!.innerHTML;
};

/** Run the IIFE against the current jsdom document. */
const runScript = () => new Function(scriptText())();

const setSystemDark = (dark: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: dark && q.includes('dark'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

/** Grant functional consent, which is what moves persistence to localStorage. */
const allowFunctional = () =>
  localStorage.setItem(
    CONSENT_STORAGE_KEY,
    JSON.stringify({ functional: true })
  );

/**
 * Fire an OS colour-scheme change at whatever listener the script registered.
 *
 * `systemDark` is mutable and read at query time, because the handler does NOT
 * use the event's `matches` — it calls getSystemTheme(), which asks matchMedia
 * again. A stub returning a fixed `matches` therefore reports the OLD scheme no
 * matter what the event says.
 */
const fireSystemChange = (dark: boolean) => {
  let systemDark = false;
  const listeners: Array<(e: { matches: boolean }) => void> = [];
  vi.stubGlobal('matchMedia', (q: string) => ({
    get matches() {
      return systemDark && q.includes('dark');
    },
    media: q,
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) =>
      listeners.push(fn),
    removeEventListener: () => {},
  }));
  runScript();
  systemDark = dark;
  listeners.forEach((fn) => fn({ matches: dark }));
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.body.removeAttribute('data-theme');
});
afterEach(() => vi.unstubAllGlobals());

describe('ThemeScript', () => {
  it('renders one inline script and nothing visible', () => {
    const { container } = render(<ThemeScript />);
    expect(container.querySelectorAll('*')).toHaveLength(1);
    expect(container.querySelector('script')).not.toBeNull();
  });

  it('applies the stored theme before paint', () => {
    localStorage.setItem('theme', 'dracula');
    setSystemDark(true);
    runScript();
    // A stored choice beats the system preference — that is the whole point of storing it.
    expect(document.documentElement.getAttribute('data-theme')).toBe('dracula');
  });

  it('falls back to the system preference when nothing is stored', () => {
    setSystemDark(true);
    runScript();
    expect(document.documentElement.getAttribute('data-theme')).toMatch(
      /-dark$/
    );

    document.documentElement.removeAttribute('data-theme');
    setSystemDark(false);
    runScript();
    expect(document.documentElement.getAttribute('data-theme')).toMatch(
      /-light$/
    );
  });

  it('mirrors the theme onto body as well as documentElement', () => {
    localStorage.setItem('theme', 'dracula');
    setSystemDark(false);
    runScript();
    expect(document.body.getAttribute('data-theme')).toBe('dracula');
  });

  it('follows a theme change from another tab', () => {
    setSystemDark(false);
    runScript();
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'theme', newValue: 'nord' })
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('nord');
  });

  it('follows a theme change from this tab', () => {
    setSystemDark(false);
    runScript();
    window.dispatchEvent(
      new CustomEvent('themechange', { detail: { theme: 'cupcake' } })
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('cupcake');
  });

  it('survives localStorage throwing, rather than blocking paint', () => {
    // Private browsing and some embedded webviews throw on getItem. The script must
    // still set a theme — an exception here would leave the page unthemed.
    const spy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('denied');
      });
    setSystemDark(true);
    expect(() => runScript()).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toMatch(
      /-dark$/
    );
    spy.mockRestore();
  });

  describe('consent (#1016)', () => {
    it('reads sessionStorage when functional cookies are DECLINED', () => {
      // The path that had no coverage at all. applyTheme persists a declined
      // visitor's choice to sessionStorage, so a ThemeScript that only consulted
      // localStorage would paint the default and then flip on every page load.
      sessionStorage.setItem('theme', 'cupcake');
      runScript();
      expect(document.documentElement.getAttribute('data-theme')).toBe(
        'cupcake'
      );
    });

    it('reads localStorage once consent is granted', () => {
      allowFunctional();
      localStorage.setItem('theme', 'dracula');
      runScript();
      expect(document.documentElement.getAttribute('data-theme')).toBe(
        'dracula'
      );
    });

    it('still honours a theme stored BEFORE the gate existed', () => {
      // No consent record, value in localStorage — every visitor who chose a
      // theme while the nav wrote there unconditionally. Reading it back is not
      // the violation; writing it without consent was.
      localStorage.setItem('theme', 'nord');
      runScript();
      expect(document.documentElement.getAttribute('data-theme')).toBe('nord');
    });

    it('prefers the consent-selected store when BOTH hold a value', () => {
      sessionStorage.setItem('theme', 'cupcake');
      localStorage.setItem('theme', 'dracula');
      runScript();
      expect(document.documentElement.getAttribute('data-theme')).toBe(
        'cupcake'
      );
    });

    it("does NOT let an OS theme flip override a declined visitor's choice", () => {
      // The guard used to read localStorage alone, so for a declined visitor it
      // was always empty — and switching the OS to dark silently overrode a
      // theme they had explicitly picked.
      sessionStorage.setItem('theme', 'cupcake');
      fireSystemChange(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe(
        'cupcake'
      );
    });

    it('DOES follow the OS when no theme has been chosen', () => {
      // The other direction, so the guard above cannot be satisfied by a script
      // that simply ignores system changes entirely.
      fireSystemChange(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe(
        'scripthammer-dark'
      );
    });
  });
});
