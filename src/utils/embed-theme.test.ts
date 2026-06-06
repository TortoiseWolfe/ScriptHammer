/**
 * embed-theme — Unit Tests (issues #39, #46)
 *
 * Covers getEmbedColor:
 * - reads --color-primary off :root and returns a 6-digit hex
 * - bare vs `#`-prefixed format flag
 * - both formats agree on the hex body
 * - falls back to 808080 when the token is unset (never white/empty)
 *
 * NOTE: jsdom does not apply DaisyUI's stylesheet, so these tests inject the
 * token via an inline style (the same approach as theme-utils.test.ts). They
 * prove the math + formatting, NOT real-theme contrast — the 34-theme contrast
 * assertion lives in tests/e2e/embed-theme-contrast.spec.ts where DaisyUI CSS
 * actually resolves.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getEmbedColor,
  contrastRatio,
  getAccessibleEmbedColor,
} from './embed-theme';

describe('getEmbedColor', () => {
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

  it('returns a bare 6-digit hex by default', () => {
    document.documentElement.style.setProperty('--color-primary', '0.4 0.2 30');
    const hex = getEmbedColor('p');
    expect(hex).toMatch(/^[0-9a-f]{6}$/);
    expect(hex.startsWith('#')).toBe(false);
  });

  it('prefixes with # when opts.hash is true', () => {
    document.documentElement.style.setProperty('--color-primary', '0.4 0.2 30');
    const hex = getEmbedColor('p', { hash: true });
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('the two formats agree on the hex body', () => {
    document.documentElement.style.setProperty(
      '--color-primary',
      '0.6 0.1 180'
    );
    const bare = getEmbedColor('p');
    const hashed = getEmbedColor('p', { hash: true });
    expect(`#${bare}`).toBe(hashed);
  });

  it('defaults the token to primary', () => {
    document.documentElement.style.setProperty('--color-primary', '0.4 0.2 30');
    expect(getEmbedColor()).toBe(getEmbedColor('p'));
  });

  it('falls back to 808080 when the token is unset (not empty, not white)', () => {
    // No --color-* set on :root → getDaisyUIColorAsThree returns #808080.
    const hex = getEmbedColor('p');
    expect(hex).toBe('808080');
    expect(getEmbedColor('p', { hash: true })).toBe('#808080');
  });

  it('resolves a different token (secondary)', () => {
    document.documentElement.style.setProperty(
      '--color-secondary',
      '0.5 0.12 90'
    );
    const hex = getEmbedColor('s');
    expect(hex).toMatch(/^[0-9a-f]{6}$/);
    // A real color, not the gray fallback.
    expect(hex).not.toBe('808080');
  });
});

describe('contrastRatio', () => {
  it('returns 21 for black vs white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('returns 1 for identical colors', () => {
    expect(contrastRatio('#3b82f6', '#3b82f6')).toBeCloseTo(1, 5);
  });

  it('is order-independent', () => {
    expect(contrastRatio('#111827', '#93c5fd')).toBeCloseTo(
      contrastRatio('#93c5fd', '#111827'),
      5
    );
  });

  it('tolerates colors with or without a leading #', () => {
    expect(contrastRatio('000000', 'ffffff')).toBeCloseTo(21, 0);
  });
});

describe('getAccessibleEmbedColor', () => {
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

  it('returns the theme primary when it clears AA on the background', () => {
    // A dark primary on a white bg easily clears 4.5:1.
    document.documentElement.style.setProperty(
      '--color-primary',
      '0.2 0.05 250' // dark blue
    );
    const result = getAccessibleEmbedColor('#ffffff', '#3b82f6', 'p');
    // It chose the theme color, not the fallback.
    expect(result).toBe(getEmbedColor('p', { hash: true }));
    expect(contrastRatio(result, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('falls back when the theme primary fails AA on the background', () => {
    // A very pale primary on white fails 4.5:1 → fallback returned.
    document.documentElement.style.setProperty(
      '--color-primary',
      '0.95 0.02 90' // near-white
    );
    const fallback = '#3b82f6';
    const result = getAccessibleEmbedColor('#ffffff', fallback, 'p');
    expect(result).toBe(fallback);
  });

  it('returns a # -prefixed hex either way', () => {
    document.documentElement.style.setProperty(
      '--color-primary',
      '0.2 0.05 250'
    );
    expect(getAccessibleEmbedColor('#ffffff', '#3b82f6', 'p')).toMatch(
      /^#[0-9a-f]{6}$/
    );
  });
});
