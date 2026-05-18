/**
 * theme-utils — Unit Tests
 *
 * Feature 047 — Three.js Game (T004)
 *
 * Covers:
 * - isDarkTheme (existing helper)
 * - getDaisyUIColorAsThree (new for feature 047)
 *   - reads CSS custom property from :root
 *   - resolves OKLCH triplet to a THREE.Color via browser computation
 *     (jsdom doesn't implement OKLCH parsing, so an inline fallback
 *      handles that case)
 *   - returns a sensible default when the token is unset
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Color as ThreeColor } from 'three';
import { isDarkTheme, getDaisyUIColorAsThree } from './theme-utils';

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

describe('getDaisyUIColorAsThree', () => {
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

  it('returns a THREE.Color instance', () => {
    document.documentElement.style.setProperty('--p', '0.7 0.15 250');
    const color = getDaisyUIColorAsThree('p');
    expect(color).toBeInstanceOf(ThreeColor);
  });

  it('reads the CSS custom property by token name (no -- prefix in the argument)', () => {
    // Use a known easy-to-resolve triplet. The exact sRGB values vary by browser
    // OKLCH implementation, so we assert "not white" rather than a specific hex.
    document.documentElement.style.setProperty('--p', '0.4 0.2 30');
    const color = getDaisyUIColorAsThree('p');
    // White is the sentinel value when parsing fails entirely.
    expect(color.getHexString()).not.toBe('ffffff');
  });

  it('returns a documented fallback when the token is unset', () => {
    // Ensure no --doesnotexist is set
    document.documentElement.style.removeProperty('--doesnotexist');
    const color = getDaisyUIColorAsThree('doesnotexist');
    // Documented fallback: middle gray (#808080).
    expect(color.getHexString()).toBe('808080');
  });

  it('handles raw OKLCH triplets in CSS custom property format (legacy DaisyUI 4 stored them as "L C H" without the function wrapper)', () => {
    document.documentElement.style.setProperty('--s', '0.6 0.1 180');
    const color = getDaisyUIColorAsThree('s');
    expect(color).toBeInstanceOf(ThreeColor);
    expect(color.getHexString()).not.toBe('ffffff');
  });

  it('strips whitespace from the CSS custom property value before parsing', () => {
    document.documentElement.style.setProperty('--a', '  0.5 0.12 90  ');
    const color = getDaisyUIColorAsThree('a');
    expect(color).toBeInstanceOf(ThreeColor);
    expect(color.getHexString()).not.toBe('ffffff');
  });

  it('parses DaisyUI 5 format: oklch() wrapper + percent-suffixed L', () => {
    // DaisyUI 5 writes `--color-primary: oklch(58% .233 277.117)` — wrapped
    // function call, L is a percentage (0-100), C and H are decimal.
    document.documentElement.style.setProperty(
      '--color-primary',
      'oklch(58% .233 277.117)'
    );
    const color = getDaisyUIColorAsThree('p');
    expect(color).toBeInstanceOf(ThreeColor);
    expect(color.getHexString()).not.toBe('808080');
    expect(color.getHexString()).not.toBe('ffffff');
  });

  it('maps the short DaisyUI 4 token `p` to the DaisyUI 5 name `--color-primary`', () => {
    document.documentElement.style.setProperty(
      '--color-primary',
      'oklch(45% .24 277.023)'
    );
    const color = getDaisyUIColorAsThree('p');
    expect(color).toBeInstanceOf(ThreeColor);
    expect(color.getHexString()).not.toBe('808080');
  });

  it('different OKLCH inputs produce different hex outputs (sanity check that the parser is not constant)', () => {
    document.documentElement.style.setProperty(
      '--color-primary',
      'oklch(45% .24 277)'
    );
    const a = getDaisyUIColorAsThree('p').getHexString();
    document.documentElement.style.setProperty(
      '--color-primary',
      'oklch(90% .05 30)'
    );
    const b = getDaisyUIColorAsThree('p').getHexString();
    expect(a).not.toBe(b);
    expect(a).not.toBe('808080');
    expect(b).not.toBe('808080');
  });
});

describe('getDaisyUIColorAsThree MutationObserver reactivity', () => {
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
