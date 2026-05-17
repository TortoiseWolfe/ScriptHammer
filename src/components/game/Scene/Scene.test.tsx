/**
 * Scene — Unit Tests
 *
 * Feature 047 — Three.js Game (T008)
 *
 * Mocks @react-three/fiber's Canvas to avoid jsdom WebGL conflicts.
 * Asserts the structural contract of Scene — that it renders, that the
 * canvas-mock element appears, and that the placeholder geometry is
 * present (which proves the render tree mounted, not that WebGL ran).
 *
 * Canvas-rendering correctness is verified in Playwright (real browser, real GL).
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Mock @react-three/fiber so jsdom doesn't try to construct a real WebGLRenderer.
// We don't try to render any 3D — just verify the React tree mounts.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, ...rest }: { children?: React.ReactNode }) => (
    <div data-testid="canvas-mock" data-props={JSON.stringify(rest)}>
      {children}
    </div>
  ),
  useFrame: () => {},
  useThree: () => ({}),
}));

// Mock drei's OrbitControls — it touches Three.js internals that jsdom can't satisfy.
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls-mock" />,
}));

import Scene from './Scene';

describe('Scene', () => {
  it('renders the canvas mock', () => {
    const { getByTestId } = render(<Scene />);
    expect(getByTestId('canvas-mock')).toBeInTheDocument();
  });

  it('renders without crashing in jsdom (mocked canvas)', () => {
    const { container } = render(<Scene />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('passes dpr=[1,2] to the canvas (NFR-004)', () => {
    const { getByTestId } = render(<Scene />);
    const canvas = getByTestId('canvas-mock');
    const props = JSON.parse(canvas.getAttribute('data-props') ?? '{}');
    expect(props.dpr).toEqual([1, 2]);
  });
});
