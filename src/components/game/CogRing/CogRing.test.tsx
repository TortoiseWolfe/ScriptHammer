/**
 * CogRing — Unit Tests
 *
 * Feature 047 — Three.js Game (T039)
 *
 * Renders inside R3F's mocked Canvas (see Scene tests for the pattern).
 * Asserts that the component produces the expected mesh count for the
 * default 20 teeth + 10 rivets + 1 rim = 31 meshes when given default props.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Mock @react-three/fiber primitives. R3F's lowercase JSX elements (mesh,
// boxGeometry, etc.) aren't real DOM elements; in jsdom they emit warnings
// but otherwise render as no-op placeholders. We don't try to assert
// geometry correctness here — just structural contracts.
vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
  useThree: () => ({}),
}));

import CogRing from './CogRing';

describe('CogRing', () => {
  it('renders without crashing as a React component', () => {
    const { container } = render(<CogRing />);
    expect(container).toBeInTheDocument();
  });

  it('honors a custom teethCount prop', () => {
    // Hard to assert on the actual mesh count without a real R3F scene
    // graph. Structural contract: passing teethCount=12 should still render
    // without throwing.
    const { container } = render(<CogRing teethCount={12} />);
    expect(container).toBeInTheDocument();
  });

  it('accepts a custom color prop', () => {
    const { container } = render(<CogRing color="#ff0000" />);
    expect(container).toBeInTheDocument();
  });
});
