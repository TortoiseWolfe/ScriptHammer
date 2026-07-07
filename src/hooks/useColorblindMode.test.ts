import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColorblindMode } from './useColorblindMode';
import { ColorblindType, COLORBLIND_STORAGE_KEY } from '@/utils/colorblind';

describe('useColorblindMode', () => {
  let mockLocalStorage: { [key: string]: string } = {};

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {};

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
        clear: vi.fn(() => {
          mockLocalStorage = {};
        }),
      },
      writable: true,
    });

    // Mock document.documentElement.style
    Object.defineProperty(document.documentElement, 'style', {
      value: {
        setProperty: vi.fn(),
        removeProperty: vi.fn(),
      },
      writable: true,
    });

    // Mock document.body.style
    Object.defineProperty(document.body, 'style', {
      value: {
        filter: '',
      },
      writable: true,
    });

    // Mock classList
    document.documentElement.classList.add = vi.fn();
    document.documentElement.classList.remove = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with NONE mode by default', () => {
      const { result } = renderHook(() => useColorblindMode());

      expect(result.current.mode).toBe(ColorblindType.NONE);
      expect(result.current.patternsEnabled).toBe(false);
    });

    it('should load saved mode from localStorage', () => {
      mockLocalStorage[COLORBLIND_STORAGE_KEY] = JSON.stringify({
        mode: ColorblindType.PROTANOPIA,
        patternsEnabled: true,
      });

      const { result } = renderHook(() => useColorblindMode());

      expect(result.current.mode).toBe(ColorblindType.PROTANOPIA);
      expect(result.current.patternsEnabled).toBe(true);
    });

    it('should handle invalid localStorage data gracefully', () => {
      mockLocalStorage[COLORBLIND_STORAGE_KEY] = 'invalid json';

      const { result } = renderHook(() => useColorblindMode());

      expect(result.current.mode).toBe(ColorblindType.NONE);
      expect(result.current.patternsEnabled).toBe(false);
    });
  });

  describe('setColorblindMode', () => {
    it('should update the mode', () => {
      const { result } = renderHook(() => useColorblindMode());

      act(() => {
        result.current.setColorblindMode(ColorblindType.DEUTERANOPIA);
      });

      expect(result.current.mode).toBe(ColorblindType.DEUTERANOPIA);
    });

    it('should apply filter to document body', () => {
      const { result } = renderHook(() => useColorblindMode());

      act(() => {
        result.current.setColorblindMode(ColorblindType.TRITANOPIA);
      });

      expect(document.body.style.filter).toBe('url(#tritanopia)');
    });

    it('should set CSS variable for filter', () => {
      const { result } = renderHook(() => useColorblindMode());

      act(() => {
        result.current.setColorblindMode(ColorblindType.ACHROMATOPSIA);
      });

      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--colorblind-filter',
        'url(#achromatopsia)'
      );
    });

    it('should remove filter when set to NONE', () => {
      const { result } = renderHook(() => useColorblindMode());

      // First set a mode
      act(() => {
        result.current.setColorblindMode(ColorblindType.PROTANOPIA);
      });

      // Then set to NONE
      act(() => {
        result.current.setColorblindMode(ColorblindType.NONE);
      });

      expect(document.body.style.filter).toBe('none');
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--colorblind-filter',
        'none'
      );
    });

    it('should persist mode to localStorage', () => {
      const { result } = renderHook(() => useColorblindMode());

      act(() => {
        result.current.setColorblindMode(ColorblindType.DEUTERANOMALY);
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        COLORBLIND_STORAGE_KEY,
        expect.stringContaining(ColorblindType.DEUTERANOMALY)
      );
    });
  });

  describe('togglePatterns', () => {
    it('should toggle patterns on', () => {
      const { result } = renderHook(() => useColorblindMode());

      expect(result.current.patternsEnabled).toBe(false);

      act(() => {
        result.current.togglePatterns();
      });

      expect(result.current.patternsEnabled).toBe(true);
    });

    it('should toggle patterns off', () => {
      mockLocalStorage[COLORBLIND_STORAGE_KEY] = JSON.stringify({
        mode: ColorblindType.NONE,
        patternsEnabled: true,
      });

      const { result } = renderHook(() => useColorblindMode());

      expect(result.current.patternsEnabled).toBe(true);

      act(() => {
        result.current.togglePatterns();
      });

      expect(result.current.patternsEnabled).toBe(false);
    });

    it('should add colorblind-patterns class when enabled', () => {
      const { result } = renderHook(() => useColorblindMode());

      // First set a colorblind mode (patterns only apply when mode !== NONE)
      act(() => {
        result.current.setColorblindMode(ColorblindType.PROTANOPIA);
      });

      // Clear mocks from setColorblindMode call
      vi.clearAllMocks();

      // Now toggle patterns and check
      act(() => {
        result.current.togglePatterns();
      });

      expect(document.documentElement.classList.add).toHaveBeenCalledWith(
        'colorblind-patterns'
      );
    });

    it('should remove colorblind-patterns class when disabled', () => {
      mockLocalStorage[COLORBLIND_STORAGE_KEY] = JSON.stringify({
        mode: ColorblindType.NONE,
        patternsEnabled: true,
      });

      const { result } = renderHook(() => useColorblindMode());

      act(() => {
        result.current.togglePatterns();
      });

      expect(document.documentElement.classList.remove).toHaveBeenCalledWith(
        'colorblind-patterns'
      );
    });

    it('should persist patterns state to localStorage', () => {
      const { result } = renderHook(() => useColorblindMode());

      act(() => {
        result.current.togglePatterns();
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        COLORBLIND_STORAGE_KEY,
        expect.stringContaining('"patternsEnabled":true')
      );
    });
  });

  describe('localStorage Persistence', () => {
    it('should save both mode and patterns state', () => {
      const { result } = renderHook(() => useColorblindMode());

      // Split act() calls to ensure state updates between function calls
      act(() => {
        result.current.setColorblindMode(ColorblindType.PROTANOMALY);
      });

      act(() => {
        result.current.togglePatterns();
      });

      const savedData = JSON.parse(mockLocalStorage[COLORBLIND_STORAGE_KEY]);
      expect(savedData).toEqual({
        mode: ColorblindType.PROTANOMALY,
        patternsEnabled: true,
      });
    });

    it('should load settings on mount', () => {
      const settings = {
        mode: ColorblindType.TRITANOMALY,
        patternsEnabled: true,
      };

      mockLocalStorage[COLORBLIND_STORAGE_KEY] = JSON.stringify(settings);

      const { result } = renderHook(() => useColorblindMode());

      expect(result.current.mode).toBe(ColorblindType.TRITANOMALY);
      expect(result.current.patternsEnabled).toBe(true);
      expect(document.body.style.filter).toBe('url(#tritanomaly)');
      expect(document.documentElement.classList.add).toHaveBeenCalledWith(
        'colorblind-patterns'
      );
    });

    it('should handle missing localStorage gracefully', () => {
      // Remove localStorage mock
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true,
      });

      const { result } = renderHook(() => useColorblindMode());

      // Should still work without localStorage
      expect(result.current.mode).toBe(ColorblindType.NONE);

      act(() => {
        result.current.setColorblindMode(ColorblindType.DEUTERANOPIA);
      });

      expect(result.current.mode).toBe(ColorblindType.DEUTERANOPIA);
    });
  });

  describe('Filter Application Logic', () => {
    it('should apply correct filter for each colorblind type', () => {
      const { result } = renderHook(() => useColorblindMode());

      const types = [
        ColorblindType.PROTANOPIA,
        ColorblindType.PROTANOMALY,
        ColorblindType.DEUTERANOPIA,
        ColorblindType.DEUTERANOMALY,
        ColorblindType.TRITANOPIA,
        ColorblindType.TRITANOMALY,
        ColorblindType.ACHROMATOPSIA,
        ColorblindType.ACHROMATOMALY,
      ];

      types.forEach((type) => {
        act(() => {
          result.current.setColorblindMode(type);
        });

        expect(document.body.style.filter).toBe(`url(#${type})`);
      });
    });

    it('should maintain patterns state when changing modes', () => {
      const { result } = renderHook(() => useColorblindMode());

      // Enable patterns
      act(() => {
        result.current.togglePatterns();
      });

      expect(result.current.patternsEnabled).toBe(true);

      // Change mode
      act(() => {
        result.current.setColorblindMode(ColorblindType.DEUTERANOPIA);
      });

      // Patterns should still be enabled
      expect(result.current.patternsEnabled).toBe(true);
      expect(document.documentElement.classList.add).toHaveBeenCalledWith(
        'colorblind-patterns'
      );
    });

    it('should apply filters immediately on mode change', () => {
      const { result } = renderHook(() => useColorblindMode());

      act(() => {
        result.current.setColorblindMode(ColorblindType.PROTANOPIA);
      });

      // Should apply immediately
      expect(document.body.style.filter).toBe('url(#protanopia)');

      // Change to another mode
      act(() => {
        result.current.setColorblindMode(ColorblindType.TRITANOPIA);
      });

      // Should update immediately
      expect(document.body.style.filter).toBe('url(#tritanopia)');
    });

    it('should handle rapid mode changes', () => {
      const { result } = renderHook(() => useColorblindMode());

      act(() => {
        result.current.setColorblindMode(ColorblindType.PROTANOPIA);
        result.current.setColorblindMode(ColorblindType.DEUTERANOPIA);
        result.current.setColorblindMode(ColorblindType.TRITANOPIA);
      });

      // Final mode should be applied
      expect(result.current.mode).toBe(ColorblindType.TRITANOPIA);
      expect(document.body.style.filter).toBe('url(#tritanopia)');
    });
  });

  describe('Performance', () => {
    it('should apply filters quickly', () => {
      const { result } = renderHook(() => useColorblindMode());

      const start = performance.now();

      act(() => {
        result.current.setColorblindMode(ColorblindType.DEUTERANOPIA);
      });

      const end = performance.now();
      const duration = end - start;

      // Should be less than 10ms as per requirements
      expect(duration).toBeLessThan(10);
    });

    it('should toggle patterns quickly', () => {
      const { result } = renderHook(() => useColorblindMode());

      const start = performance.now();

      act(() => {
        result.current.togglePatterns();
      });

      const end = performance.now();
      const duration = end - start;

      // Should be less than 10ms
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Make localStorage.setItem throw
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      const { result } = renderHook(() => useColorblindMode());

      act(() => {
        result.current.setColorblindMode(ColorblindType.PROTANOPIA);
      });

      // Should still update state
      expect(result.current.mode).toBe(ColorblindType.PROTANOPIA);

      // Should log error
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it('should handle invalid colorblind type gracefully', () => {
      const { result } = renderHook(() => useColorblindMode());

      act(() => {
        // @ts-expect-error - Testing invalid input
        result.current.setColorblindMode('invalid_type');
      });

      // Should handle gracefully - likely default to NONE or ignore
      expect(document.body.style.filter).toBeDefined();
    });
  });
});
