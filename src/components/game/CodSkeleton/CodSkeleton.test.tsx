/**
 * CodSkeleton — Unit Tests
 *
 * CoD-extraction spike (walking skeleton).
 *
 * Mocks @react-three/fiber so jsdom never constructs a real WebGLRenderer.
 * The vendored physics (StaticWorld BVH + CharacterController) and the
 * procedural DataTexture materials are pure CPU, so the render tree mounts
 * under the mocked Canvas — these tests assert the DOM contract + the WebGL
 * fallback path. Physics correctness is proven separately by the standalone
 * r184 smoke test; canvas rendering is a Playwright concern.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Mock @react-three/fiber: Canvas -> div (renders children), hooks -> no-ops.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, ...rest }: { children?: React.ReactNode }) => (
    <div data-testid="canvas-mock" data-props={JSON.stringify(rest)}>
      {children}
    </div>
  ),
  useFrame: () => {},
  useThree: () => ({}),
}));

import CodSkeleton from './CodSkeleton';

describe('CodSkeleton', () => {
  it('renders the canvas mock (physics world mounts without WebGL)', () => {
    const { getByTestId } = render(<CodSkeleton />);
    expect(getByTestId('canvas-mock')).toBeInTheDocument();
  });

  it('renders without crashing in jsdom (mocked canvas)', () => {
    const { container } = render(<CodSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('passes a quality-driven dpr (0 < dpr <= 2) to the canvas', () => {
    const { getByTestId } = render(<CodSkeleton />);
    const props = JSON.parse(
      getByTestId('canvas-mock').getAttribute('data-props') ?? '{}'
    );
    expect(typeof props.dpr).toBe('number');
    expect(props.dpr).toBeGreaterThan(0);
    expect(props.dpr).toBeLessThanOrEqual(2);
  });
});

describe('CodSkeleton — WebGL fallback', () => {
  it('renders FallbackPanel instead of Canvas when WebGL is unavailable', () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const { container, queryByTestId, getByRole } = render(<CodSkeleton />);
    expect(queryByTestId('canvas-mock')).not.toBeInTheDocument();
    expect(getByRole('alert')).toBeInTheDocument();
    expect(
      container.querySelector('[data-webgl-ok="false"]')
    ).toBeInTheDocument();

    HTMLCanvasElement.prototype.getContext = original;
  });

  it('renders Canvas when WebGL is available', () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ({}) as unknown as RenderingContext
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const { container, getByTestId } = render(<CodSkeleton />);
    expect(getByTestId('canvas-mock')).toBeInTheDocument();
    expect(
      container.querySelector('[data-webgl-ok="true"]')
    ).toBeInTheDocument();

    HTMLCanvasElement.prototype.getContext = original;
  });
});
