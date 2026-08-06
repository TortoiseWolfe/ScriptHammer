/**
 * useFootsteps — unit test.
 *
 * jsdom has no Web Audio (`window.AudioContext` is undefined), so the hook's
 * guards make `resume()` + `step()` safe no-ops — the same "no-op, don't throw"
 * contract the SSR path relies on. Audible correctness is verified in a real
 * browser (Playwright).
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFootsteps } from './useFootsteps';

describe('useFootsteps', () => {
  it('returns resume + step callbacks', () => {
    const { result } = renderHook(() => useFootsteps());
    expect(typeof result.current.resume).toBe('function');
    expect(typeof result.current.step).toBe('function');
  });

  it('is a silent no-op without Web Audio (jsdom) — never throws', () => {
    const { result, unmount } = renderHook(() => useFootsteps());
    expect(() => {
      result.current.resume();
      result.current.step(3, true, 'concrete');
      result.current.step(3, false, 'dirt');
      unmount();
    }).not.toThrow();
  });
});
