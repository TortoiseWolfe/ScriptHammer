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
 *
 * THE SCENE IS GATED BEHIND A START (#757), so every test that wants the canvas
 * has to ask for it. That gate is the fix for a route which took 22.6-30.2s on a
 * GPU-less chromium runner and 12.7-41.7s on webkit before its layout could be
 * measured, timing out `mobile-horizontal-scroll` three times and blocking two
 * merges. The guards below are what stop it coming back a fourth time.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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

/** Render, then press the start control — for tests that need the live scene. */
function renderStarted(): ReturnType<typeof render> {
  const utils = render(<CodSkeleton />);
  fireEvent.click(utils.getByRole('button', { name: /start the scene/i }));
  return utils;
}

describe('CodSkeleton', () => {
  it('renders the canvas mock once started (physics world mounts without WebGL)', () => {
    const { getByTestId } = renderStarted();
    expect(getByTestId('canvas-mock')).toBeInTheDocument();
  });

  it('renders without crashing in jsdom (mocked canvas)', () => {
    const { container } = render(<CodSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('passes a quality-driven dpr (0 < dpr <= 2) to the canvas', () => {
    const { getByTestId } = renderStarted();
    const props = JSON.parse(
      getByTestId('canvas-mock').getAttribute('data-props') ?? '{}'
    );
    expect(typeof props.dpr).toBe('number');
    expect(props.dpr).toBeGreaterThan(0);
    expect(props.dpr).toBeLessThanOrEqual(2);
  });
});

describe('CodSkeleton — the scene is gated behind a start (#757)', () => {
  it('mounts NO canvas until the visitor asks for one', () => {
    // The whole point. If this regresses, `/game/cod-skeleton` goes back to
    // spending ~28s of a 30s test budget on a mount nobody requested, and the
    // mobile-layout sweep starts timing out again on branches that never touched
    // this route.
    const { queryByTestId, container } = render(<CodSkeleton />);

    expect(queryByTestId('canvas-mock')).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-scene-started="false"]')
    ).toBeInTheDocument();
  });

  it('mounts the canvas after the start control is pressed', () => {
    // The other half: a gate that never opens would pass the test above while
    // shipping a dead route.
    const { getByTestId, container } = renderStarted();

    expect(getByTestId('canvas-mock')).toBeInTheDocument();
    expect(
      container.querySelector('[data-scene-started="true"]')
    ).toBeInTheDocument();
  });

  it('gives the placeholder the SAME box as the started scene', () => {
    // The coverage floor (#396). `mobile-horizontal-scroll` measures this route's
    // geometry; if the placeholder sized itself differently from the canvas
    // wrapper, the sweep would quietly start measuring something else and its
    // green would stop meaning what it used to mean. jsdom has no layout, so the
    // decidable invariant is that both branches carry the identical wrapper class
    // — which is why the sizing lives on the wrapper and not on either branch.
    // Unmount between the two renders: both mount into the same document, so
    // leaving the first up makes `getByRole('button')` ambiguous rather than wrong
    // — a failure that looks like a component bug and is not one.
    const first = render(<CodSkeleton />);
    const before = first.container
      .querySelector('[data-scene-started]')
      ?.getAttribute('class');
    first.unmount();

    const after = renderStarted()
      .container.querySelector('[data-scene-started]')
      ?.getAttribute('class');

    expect(before).toBeTruthy();
    expect(after).toBe(before);
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

  it('renders Canvas when WebGL is available and the scene is started', () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ({}) as unknown as RenderingContext
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const { container, getByTestId } = renderStarted();
    expect(getByTestId('canvas-mock')).toBeInTheDocument();
    expect(
      container.querySelector('[data-webgl-ok="true"]')
    ).toBeInTheDocument();

    HTMLCanvasElement.prototype.getContext = original;
  });
});
