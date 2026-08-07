/**
 * ProceduralSky — Unit Tests
 *
 * ProceduralSky is a side-effect R3F component (renders null): inside a
 * `<Canvas>` it bakes the vendored Claude-of-Duty procedural sky into
 * `scene.environment` (IBL) and adds a background dome mesh. `useThree()` throws
 * outside a Canvas, so we mock it to return an empty object — the effect's
 * `if (!gl || !scene) return` guard then makes it a safe no-op (the same guard
 * that protects SSR / the mocked-Canvas path). Real bake correctness is a
 * Playwright concern (real WebGL).
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({}),
}));

import ProceduralSky from './ProceduralSky';

describe('ProceduralSky', () => {
  it('renders nothing and does not crash without a renderer (mocked useThree)', () => {
    const { container } = render(<ProceduralSky />);
    expect(container.firstChild).toBeNull();
  });

  it('accepts an hour prop without crashing', () => {
    const { container } = render(<ProceduralSky hour={9} />);
    expect(container.firstChild).toBeNull();
  });
});
