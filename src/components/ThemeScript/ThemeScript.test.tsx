import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ThemeScript from './ThemeScript';

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

beforeEach(() => {
  localStorage.clear();
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
});
