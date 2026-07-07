/**
 * useEmbedThemeColor Hook — Unit Tests (issues #39, #46)
 *
 * Covers:
 * - returns hex / hexWithHash / isDark for the seeded token
 * - recomputes when the data-theme attribute changes (MutationObserver wiring)
 * - returns the gray fallback when no token is set
 *
 * As with embed-theme.test.ts, jsdom doesn't apply DaisyUI CSS, so tokens are
 * injected via inline style. This proves the observer wiring + formatting, not
 * real-theme resolution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEmbedThemeColor } from './useEmbedThemeColor';

describe('useEmbedThemeColor', () => {
  let originalRootStyle: string;
  let originalTheme: string | null;

  beforeEach(() => {
    originalRootStyle = document.documentElement.getAttribute('style') ?? '';
    originalTheme = document.documentElement.getAttribute('data-theme');
  });

  afterEach(() => {
    if (originalRootStyle) {
      document.documentElement.setAttribute('style', originalRootStyle);
    } else {
      document.documentElement.removeAttribute('style');
    }
    if (originalTheme) {
      document.documentElement.setAttribute('data-theme', originalTheme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  });

  it('returns both hex formats agreeing on the body', () => {
    document.documentElement.style.setProperty('--color-primary', '0.4 0.2 30');
    const { result } = renderHook(() => useEmbedThemeColor('p'));
    expect(result.current.hex).toMatch(/^[0-9a-f]{6}$/);
    expect(result.current.hexWithHash).toBe(`#${result.current.hex}`);
  });

  it('reports isDark from the active data-theme', () => {
    document.documentElement.setAttribute('data-theme', 'dracula');
    const { result } = renderHook(() => useEmbedThemeColor('p'));
    expect(result.current.isDark).toBe(true);
  });

  it('recomputes when data-theme changes', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.setProperty('--color-primary', '0.4 0.2 30');
    const { result } = renderHook(() => useEmbedThemeColor('p'));

    const initialHex = result.current.hex;

    // Simulate a theme switch: change the injected token AND flip data-theme so
    // the MutationObserver fires and the hook reads the new color.
    act(() => {
      document.documentElement.style.setProperty(
        '--color-primary',
        '0.7 0.2 250'
      );
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    await waitFor(() => {
      expect(result.current.hex).not.toBe(initialHex);
    });
    expect(result.current.isDark).toBe(true);
  });

  it('returns the gray fallback when no token is set', () => {
    const { result } = renderHook(() => useEmbedThemeColor('p'));
    expect(result.current.hex).toBe('808080');
  });
});
