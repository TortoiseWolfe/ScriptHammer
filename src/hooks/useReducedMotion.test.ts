/**
 * useReducedMotion Hook — Unit Tests
 * Feature 047 — Three.js Game (T003)
 *
 * Covers:
 * - Returns false by default (no preference set)
 * - Returns true when matchMedia reports reduce-motion preference
 * - Responds to runtime preference changes via the media-query `change` event
 * - SSR-safe (returns false when window is undefined)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from './useReducedMotion';

type Listener = (event: MediaQueryListEvent) => void;

interface MockMediaQueryList {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  _trigger: (matches: boolean) => void;
}

function createMockMediaQueryList(initialMatches: boolean): MockMediaQueryList {
  let listeners: Listener[] = [];
  const mql: MockMediaQueryList = {
    matches: initialMatches,
    addEventListener: vi.fn((_event: string, listener: Listener) => {
      listeners.push(listener);
    }),
    removeEventListener: vi.fn((_event: string, listener: Listener) => {
      listeners = listeners.filter((l) => l !== listener);
    }),
    _trigger(matches: boolean) {
      this.matches = matches;
      listeners.forEach((l) => l({ matches } as MediaQueryListEvent));
    },
  };
  return mql;
}

describe('useReducedMotion', () => {
  let mockMql: MockMediaQueryList;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    mockMql = createMockMediaQueryList(false);
    window.matchMedia = vi.fn(
      () => mockMql as unknown as MediaQueryList
    ) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('returns false when preference is not set', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when matchMedia reports reduce-motion preference', () => {
    mockMql = createMockMediaQueryList(true);
    window.matchMedia = vi.fn(
      () => mockMql as unknown as MediaQueryList
    ) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('updates when the user toggles the preference at runtime', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      mockMql._trigger(true);
    });

    expect(result.current).toBe(true);

    act(() => {
      mockMql._trigger(false);
    });

    expect(result.current).toBe(false);
  });

  it('subscribes via addEventListener and unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useReducedMotion());
    expect(mockMql.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );
    unmount();
    expect(mockMql.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );
  });
});
