/**
 * theme-utils — Unit Tests
 *
 * Feature 047 — Three.js Game (T004); de-three'd in #291.
 *
 * Covers:
 * - isDarkTheme (existing helper)
 * - getDaisyUIColorAsHex (formerly getDaisyUIColorAsThree)
 *   - reads a CSS custom property from :root
 *   - resolves an OKLCH triplet to a 6-digit hex string (the inline OKLCH→sRGB
 *     math handles jsdom, which doesn't implement OKLCH parsing)
 *   - returns a sensible default when the token is unset
 *   - output is byte-identical to the old `THREE.Color(...).getHexString()`
 *     (proven across 45,260 samples in the #291 work; the exact-color guard is
 *     tests/e2e/embed-theme-contrast.spec.ts)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isDarkTheme, getDaisyUIColorAsHex } from './theme-utils';

const HEX6 = /^[0-9a-f]{6}$/;

describe('isDarkTheme', () => {
  it('returns true for known dark themes', () => {
    expect(isDarkTheme('dark')).toBe(true);
    expect(isDarkTheme('dracula')).toBe(true);
    expect(isDarkTheme('scripthammer-dark')).toBe(true);
  });

  it('returns false for light themes', () => {
    expect(isDarkTheme('light')).toBe(false);
    expect(isDarkTheme('cupcake')).toBe(false);
  });
});

describe('getDaisyUIColorAsHex', () => {
  let originalRootStyle: string;

  beforeEach(() => {
    originalRootStyle = document.documentElement.getAttribute('style') ?? '';
  });

  afterEach(() => {
    if (originalRootStyle) {
      document.documentElement.setAttribute('style', originalRootStyle);
    } else {
      document.documentElement.removeAttribute('style');
    }
  });

  it('returns a 6-digit lowercase hex string (no #)', () => {
    document.documentElement.style.setProperty('--p', '0.7 0.15 250');
    const hex = getDaisyUIColorAsHex('p');
    expect(hex).toMatch(HEX6);
  });

  it('reads the CSS custom property by token name (no -- prefix in the argument)', () => {
    // The exact sRGB values vary; assert "not white" (the parse-failure sentinel).
    document.documentElement.style.setProperty('--p', '0.4 0.2 30');
    expect(getDaisyUIColorAsHex('p')).not.toBe('ffffff');
  });

  it('returns a documented fallback when the token is unset', () => {
    document.documentElement.style.removeProperty('--doesnotexist');
    // Documented fallback: middle gray (808080).
    expect(getDaisyUIColorAsHex('doesnotexist')).toBe('808080');
  });

  it('handles raw OKLCH triplets in CSS custom property format (legacy DaisyUI 4 stored them as "L C H" without the function wrapper)', () => {
    document.documentElement.style.setProperty('--s', '0.6 0.1 180');
    const hex = getDaisyUIColorAsHex('s');
    expect(hex).toMatch(HEX6);
    expect(hex).not.toBe('ffffff');
  });

  it('strips whitespace from the CSS custom property value before parsing', () => {
    document.documentElement.style.setProperty('--a', '  0.5 0.12 90  ');
    const hex = getDaisyUIColorAsHex('a');
    expect(hex).toMatch(HEX6);
    expect(hex).not.toBe('ffffff');
  });

  it('parses DaisyUI 5 format: oklch() wrapper + percent-suffixed L', () => {
    // DaisyUI 5 writes `--color-primary: oklch(58% .233 277.117)` — wrapped
    // function call, L is a percentage (0-100), C and H are decimal.
    document.documentElement.style.setProperty(
      '--color-primary',
      'oklch(58% .233 277.117)'
    );
    const hex = getDaisyUIColorAsHex('p');
    expect(hex).toMatch(HEX6);
    expect(hex).not.toBe('808080');
    expect(hex).not.toBe('ffffff');
  });

  it('maps the short DaisyUI 4 token `p` to the DaisyUI 5 name `--color-primary`', () => {
    document.documentElement.style.setProperty(
      '--color-primary',
      'oklch(45% .24 277.023)'
    );
    const hex = getDaisyUIColorAsHex('p');
    expect(hex).toMatch(HEX6);
    expect(hex).not.toBe('808080');
  });

  it('different OKLCH inputs produce different hex outputs (sanity check that the parser is not constant)', () => {
    document.documentElement.style.setProperty(
      '--color-primary',
      'oklch(45% .24 277)'
    );
    const a = getDaisyUIColorAsHex('p');
    document.documentElement.style.setProperty(
      '--color-primary',
      'oklch(90% .05 30)'
    );
    const b = getDaisyUIColorAsHex('p');
    expect(a).not.toBe(b);
    expect(a).not.toBe('808080');
    expect(b).not.toBe('808080');
  });
});

describe('getDaisyUIColorAsHex MutationObserver reactivity', () => {
  // This case asserts that a caller can subscribe to data-theme changes via the
  // canonical MutationObserver pattern (mirrored from useMapTheme). The helper
  // itself does NOT subscribe — that's the caller's responsibility — so we
  // verify here that the pattern works end-to-end in jsdom.
  it('callback fires when data-theme attribute changes on documentElement', async () => {
    const callback = vi.fn();
    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    document.documentElement.setAttribute('data-theme', 'dark');
    // Wait for the MutationObserver microtask
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callback).toHaveBeenCalled();

    observer.disconnect();
    document.documentElement.removeAttribute('data-theme');
  });
});
