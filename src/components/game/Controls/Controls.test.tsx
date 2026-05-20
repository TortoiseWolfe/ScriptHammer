import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// Controls is meant to be rendered INSIDE a R3F Canvas. We can't render it
// standalone in jsdom (it has zero DOM output of its own — drei's
// OrbitControls reads/writes the Three.js camera directly). Tests here verify
// the component is importable, passes the camera constraints through, and
// honors the `autoRotate` prop (which Scene computes from useReducedMotion +
// idle-resume state).

vi.mock('@react-three/drei', () => ({
  OrbitControls: (props: Record<string, unknown>) => (
    <div data-testid="orbit-controls" data-props={JSON.stringify(props)} />
  ),
}));

// Controls calls useThree() (added in T049c to expose camera position for E2E
// multi-modality testing). useThree throws outside a <Canvas> context, so we
// mock it to return a stub camera. Position is fixed; we only care about
// constraint-passing in these unit tests, not on actual motion.
vi.mock('@react-three/fiber', () => ({
  useThree: (
    selector: (state: {
      camera: { position: { x: number; y: number; z: number } };
    }) => unknown
  ) => selector({ camera: { position: { x: 0, y: 0, z: 5 } } }),
}));

import Controls from './Controls';

describe('Controls', () => {
  it('renders without crashing (drei OrbitControls is mocked)', () => {
    const { getByTestId } = render(<Controls />);
    expect(getByTestId('orbit-controls')).toBeInTheDocument();
  });

  it('passes the FR-005 camera constraints to drei OrbitControls', () => {
    const { getByTestId } = render(<Controls />);
    const node = getByTestId('orbit-controls');
    const props = JSON.parse(node.getAttribute('data-props') ?? '{}');
    expect(props.enableDamping).toBe(true);
    expect(props.minDistance).toBe(2);
    expect(props.maxDistance).toBe(10);
    expect(props.maxPolarAngle).toBeCloseTo(Math.PI / 2, 4);
  });

  it('enables auto-rotate by default (autoRotate prop defaults to true)', () => {
    const { getByTestId } = render(<Controls />);
    const props = JSON.parse(
      getByTestId('orbit-controls').getAttribute('data-props') ?? '{}'
    );
    expect(props.autoRotate).toBe(true);
  });

  it('disables auto-rotate when autoRotate prop is false', () => {
    const { getByTestId } = render(<Controls autoRotate={false} />);
    const props = JSON.parse(
      getByTestId('orbit-controls').getAttribute('data-props') ?? '{}'
    );
    expect(props.autoRotate).toBe(false);
  });

  it('honors a custom autoRotateSpeed', () => {
    const { getByTestId } = render(<Controls autoRotateSpeed={1.5} />);
    const props = JSON.parse(
      getByTestId('orbit-controls').getAttribute('data-props') ?? '{}'
    );
    expect(props.autoRotateSpeed).toBe(1.5);
  });
});
