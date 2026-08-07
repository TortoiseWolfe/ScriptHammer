/**
 * useAmbientCity — unit test.
 *
 * jsdom has no Web Audio (`window.AudioContext` is undefined), so the hook's
 * guards make `resume()`/`start()`/`stop()` safe no-ops — the same "no-op, don't
 * throw" contract useFootsteps relies on. Audible correctness (wind + distant
 * traffic + birds) is verified in a real browser (Playwright).
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAmbientCity } from './ambientCity';

describe('useAmbientCity', () => {
  it('returns resume + start + stop callbacks', () => {
    const { result } = renderHook(() => useAmbientCity());
    expect(typeof result.current.resume).toBe('function');
    expect(typeof result.current.start).toBe('function');
    expect(typeof result.current.stop).toBe('function');
  });

  it('is a silent no-op without Web Audio (jsdom) — never throws', () => {
    const { result, unmount } = renderHook(() => useAmbientCity());
    expect(() => {
      result.current.start(); // start before resume must not throw
      result.current.resume();
      result.current.stop();
      result.current.stop(); // idempotent
      unmount();
    }).not.toThrow();
  });
});
