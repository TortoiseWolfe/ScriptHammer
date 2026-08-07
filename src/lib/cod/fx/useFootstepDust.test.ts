/**
 * useFootstepDust — unit test.
 *
 * With `useThree` mocked to return no renderer (the jsdom / mocked-Canvas path),
 * the hook builds no GPU objects and `emit`/`tick` are safe no-ops. Visible
 * correctness (particles actually emit) is verified in a real browser (Playwright).
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({}),
}));

import { useFootstepDust } from './useFootstepDust';

describe('useFootstepDust', () => {
  it('returns emit + tick callbacks', () => {
    const { result } = renderHook(() => useFootstepDust());
    expect(typeof result.current.emit).toBe('function');
    expect(typeof result.current.tick).toBe('function');
  });

  it('is a no-op without a renderer (mocked useThree) — never throws', () => {
    const { result, unmount } = renderHook(() => useFootstepDust());
    expect(() => {
      result.current.emit(1, 0, 2, 'dirt');
      result.current.emit(1, 0, 2, 'unknown-surface');
      result.current.tick(0.016);
      unmount();
    }).not.toThrow();
  });
});
