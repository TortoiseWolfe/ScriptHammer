import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFontFamily } from './useFontFamily';
import { fonts, DEFAULT_FONT_ID, FONT_STORAGE_KEYS } from '@/config/fonts';

// Mock the logger - use vi.hoisted to ensure it's available before mock hoisting
const mockLoggerFns = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => mockLoggerFns),
}));

// Mock the font-loader module
vi.mock('@/utils/font-loader', () => ({
  loadFont: vi.fn(() => Promise.resolve()),
  isFontLoaded: vi.fn(() => false),
  clearAllFonts: vi.fn(),
}));

describe('useFontFamily', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    // Reset document styles
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('Basic Structure', () => {
    it('should return default font on initial load', () => {
      const { result } = renderHook(() => useFontFamily());

      expect(result.current.fontFamily).toBe(DEFAULT_FONT_ID);
    });

    it('should return setFontFamily function', () => {
      const { result } = renderHook(() => useFontFamily());

      expect(typeof result.current.setFontFamily).toBe('function');
    });

    it('should return fonts array', () => {
      const { result } = renderHook(() => useFontFamily());

      expect(result.current.fonts).toEqual(fonts);
      expect(result.current.fonts.length).toBeGreaterThan(0);
    });

    it('should return current font configuration', () => {
      const { result } = renderHook(() => useFontFamily());

      expect(result.current.currentFontConfig).toBeDefined();
      expect(result.current.currentFontConfig?.id).toBe(DEFAULT_FONT_ID);
    });

    it('should return getFontById function', () => {
      const { result } = renderHook(() => useFontFamily());

      expect(typeof result.current.getFontById).toBe('function');

      const font = result.current.getFontById('inter');
      expect(font?.id).toBe('inter');
    });

    it('should return isFontLoaded function', () => {
      const { result } = renderHook(() => useFontFamily());

      expect(typeof result.current.isFontLoaded).toBe('function');
    });

    it('should return recentFonts array', () => {
      const { result } = renderHook(() => useFontFamily());

      expect(Array.isArray(result.current.recentFonts)).toBe(true);
    });

    it('should return resetFont function', () => {
      const { result } = renderHook(() => useFontFamily());

      expect(typeof result.current.resetFont).toBe('function');
    });
  });

  describe('localStorage Integration', () => {
    it('should load saved font from localStorage', () => {
      localStorage.setItem(FONT_STORAGE_KEYS.FONT_FAMILY, 'inter');

      const { result } = renderHook(() => useFontFamily());

      expect(result.current.fontFamily).toBe('inter');
    });

    it('should save font to localStorage on change', () => {
      const { result } = renderHook(() => useFontFamily());

      act(() => {
        result.current.setFontFamily('georgia');
      });

      expect(localStorage.getItem(FONT_STORAGE_KEYS.FONT_FAMILY)).toBe(
        'georgia'
      );
    });

    it('should handle invalid localStorage data', () => {
      localStorage.setItem(FONT_STORAGE_KEYS.FONT_FAMILY, 'invalid-font-id');

      const { result } = renderHook(() => useFontFamily());

      // Should fall back to default
      expect(result.current.fontFamily).toBe(DEFAULT_FONT_ID);
    });

    it('should save font settings object to localStorage', async () => {
      const { result } = renderHook(() => useFontFamily());

      await act(async () => {
        await result.current.setFontFamily('inter');
      });

      const settings = localStorage.getItem(FONT_STORAGE_KEYS.FONT_SETTINGS);
      expect(settings).toBeTruthy();

      const parsed = JSON.parse(settings!);
      expect(parsed.fontFamily).toBe('inter');
      expect(parsed.lastUpdated).toBeDefined();
    });

    it('should track recent fonts in localStorage', async () => {
      const { result } = renderHook(() => useFontFamily());

      await act(async () => {
        await result.current.setFontFamily('inter');
      });

      await act(async () => {
        await result.current.setFontFamily('georgia');
      });

      expect(result.current.recentFonts).toContain('inter');
      expect(result.current.recentFonts).toContain('georgia');
    });
  });

  describe('DOM Updates', () => {
    it('should apply font to document on load', () => {
      localStorage.setItem(FONT_STORAGE_KEYS.FONT_FAMILY, 'georgia');

      renderHook(() => useFontFamily());

      // Check if CSS variable is set
      const fontFamily =
        document.documentElement.style.getPropertyValue('--font-family');
      expect(fontFamily).toContain('Georgia');
    });

    it('should update CSS variable on font change', async () => {
      const { result } = renderHook(() => useFontFamily());

      await act(async () => {
        await result.current.setFontFamily('inter');
      });

      const fontFamily =
        document.documentElement.style.getPropertyValue('--font-family');
      expect(fontFamily).toContain('Inter');
    });

    it('should update body font-family style', () => {
      const { result } = renderHook(() => useFontFamily());

      act(() => {
        result.current.setFontFamily('jetbrains');
      });

      expect(document.body.style.fontFamily).toContain('var(--font-family)');
    });

    it('should dispatch custom event on font change', async () => {
      const { result } = renderHook(() => useFontFamily());
      const eventListener = vi.fn();

      window.addEventListener('fontchange', eventListener);

      await act(async () => {
        await result.current.setFontFamily('inter');
      });

      expect(eventListener).toHaveBeenCalled();

      window.removeEventListener('fontchange', eventListener);
    });
  });

  describe('Font Management', () => {
    it('should change font when setFontFamily is called', async () => {
      const { result } = renderHook(() => useFontFamily());

      await act(async () => {
        await result.current.setFontFamily('inter');
      });

      expect(result.current.fontFamily).toBe('inter');
      expect(result.current.currentFontConfig?.id).toBe('inter');
    });

    it('should not change font for invalid ID', async () => {
      const { result } = renderHook(() => useFontFamily());

      await act(async () => {
        await result.current.setFontFamily('invalid-font');
      });

      expect(result.current.fontFamily).toBe(DEFAULT_FONT_ID);
      expect(mockLoggerFns.warn).toHaveBeenCalledWith('Invalid font ID', {
        fontId: 'invalid-font',
      });
    });

    it('should reset to default font', async () => {
      const { result } = renderHook(() => useFontFamily());

      await act(async () => {
        await result.current.setFontFamily('inter');
      });

      await act(async () => {
        await result.current.resetFont();
      });

      expect(result.current.fontFamily).toBe(DEFAULT_FONT_ID);
    });

    it('should limit recent fonts to maximum', async () => {
      const { result } = renderHook(() => useFontFamily());

      // Add more than MAX_RECENT_FONTS
      const fontIds = [
        'inter',
        'georgia',
        'jetbrains',
        'atkinson',
        'opendyslexic',
        'system',
      ];

      for (const id of fontIds) {
        await act(async () => {
          await result.current.setFontFamily(id);
        });
      }

      expect(result.current.recentFonts.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Font Loading', () => {
    it('should mark system fonts as loaded', () => {
      const { result } = renderHook(() => useFontFamily());

      expect(result.current.isFontLoaded('system')).toBe(true);
      expect(result.current.isFontLoaded('georgia')).toBe(true);
    });

    it('should handle web font loading state', () => {
      const { result } = renderHook(() => useFontFamily());

      // Initially web fonts might not be loaded
      const isLoaded = result.current.isFontLoaded('inter');
      expect(typeof isLoaded).toBe('boolean');
    });
  });
});
