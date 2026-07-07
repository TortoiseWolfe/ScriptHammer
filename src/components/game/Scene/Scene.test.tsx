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

describe('Scene — FR-008: WebGL Fallback', () => {
  it('renders FallbackPanel instead of Canvas when WebGL is unavailable', () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    // Force the WebGL probe to return null.
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const { container, queryByTestId, getByRole } = render(<Scene />);
    expect(queryByTestId('canvas-mock')).not.toBeInTheDocument();
    expect(getByRole('alert')).toBeInTheDocument();
    expect(
      container.querySelector('[data-webgl-ok="false"]')
    ).toBeInTheDocument();

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('renders Canvas when WebGL is available', () => {
    // jsdom's default canvas.getContext returns null for "webgl" but our
    // probe still treats that as "no WebGL." Force a non-null return.
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ({}) as unknown as RenderingContext
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const { container, getByTestId } = render(<Scene />);
    expect(getByTestId('canvas-mock')).toBeInTheDocument();
    expect(
      container.querySelector('[data-webgl-ok="true"]')
    ).toBeInTheDocument();

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });
});

describe('Scene — US-3: Respect Reduced Motion', () => {
  // Note: useReducedMotion is NOT mocked here — the hook reads window.matchMedia
  // which jsdom defaults to `matches: false`. The default behavior is therefore
  // "auto-orbit active".
  it('exposes data-autorotate-active="true" by default in jsdom (no reduce preference set)', () => {
    const { container } = render(<Scene />);
    const wrapper = container.querySelector('[data-autorotate-active]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper?.getAttribute('data-autorotate-active')).toBe('true');
  });
});

describe('Scene — US-2: Theme-Aware 3D Scene', () => {
  it('exposes the current mesh color via data-mesh-color attribute (dev-mode debug for E2E)', () => {
    const { container } = render(<Scene />);
    const wrapper = container.querySelector('[data-mesh-color]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper?.getAttribute('data-mesh-color')).toBeTruthy();
  });

  it('updates data-mesh-color when data-theme changes on documentElement', async () => {
    const { container, rerender } = render(<Scene />);
    const before = container
      .querySelector('[data-mesh-color]')
      ?.getAttribute('data-mesh-color');

    // Simulate a theme switch
    await new Promise<void>((resolve) => {
      // Set --p to a different OKLCH triplet so the helper picks up a new color
      document.documentElement.style.setProperty('--p', '0.2 0.1 30');
      document.documentElement.setAttribute('data-theme', 'dark');
      // Allow the MutationObserver microtask to flush
      setTimeout(resolve, 0);
    });

    rerender(<Scene />);
    const after = container
      .querySelector('[data-mesh-color]')
      ?.getAttribute('data-mesh-color');

    expect(before).toBeTruthy();
    expect(after).toBeTruthy();
    // Different OKLCH triplets must produce a different hex (proves
    // re-extraction happened, not just a no-op pass-through).
    expect(after).not.toBe(before);

    // Cleanup
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--p');
  });
});
