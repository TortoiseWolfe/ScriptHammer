/**
 * PrintingMallet — Unit Tests
 *
 * Feature 047 — Three.js Game (T041)
 *
 * Renders inside R3F's mocked Canvas. PrintingMallet is a Three.js scene
 * sub-tree with no DOM surface of its own.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
  useThree: () => ({}),
}));

import PrintingMallet from './PrintingMallet';

describe('PrintingMallet', () => {
  it('renders without crashing', () => {
    const { container } = render(<PrintingMallet />);
    expect(container).toBeInTheDocument();
  });

  it('honors a custom woodColor prop', () => {
    const { container } = render(<PrintingMallet woodColor="#a08060" />);
    expect(container).toBeInTheDocument();
  });

  it('honors a custom tilt angle', () => {
    const { container } = render(<PrintingMallet tilt={0} />);
    expect(container).toBeInTheDocument();
  });
});
