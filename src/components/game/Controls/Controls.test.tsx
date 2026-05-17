import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// Controls is meant to be rendered INSIDE a R3F Canvas. We can't render it
// standalone in jsdom (it has zero DOM output of its own — drei's
// OrbitControls reads/writes the Three.js camera directly). Tests here verify
// the component is importable and exports the expected default + named types.

vi.mock('@react-three/drei', () => ({
  OrbitControls: (props: Record<string, unknown>) => (
    <div data-testid="orbit-controls" data-props={JSON.stringify(props)} />
  ),
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

  it('enables auto-rotate by default', () => {
    const { getByTestId } = render(<Controls />);
    const props = JSON.parse(
      getByTestId('orbit-controls').getAttribute('data-props') ?? '{}'
    );
    expect(props.autoRotate).toBe(true);
  });

  it('disables auto-rotate when disableAutoRotate prop is true', () => {
    const { getByTestId } = render(<Controls disableAutoRotate />);
    const props = JSON.parse(
      getByTestId('orbit-controls').getAttribute('data-props') ?? '{}'
    );
    expect(props.autoRotate).toBe(false);
  });
});
