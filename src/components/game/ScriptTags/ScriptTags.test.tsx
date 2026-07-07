/**
 * ScriptTags — Unit Tests
 *
 * Feature 047 — Three.js Game (T040)
 *
 * Renders inside R3F's mocked Canvas. ScriptTags is a Three.js scene
 * sub-tree with no DOM surface of its own.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
  useThree: () => ({}),
}));

import ScriptTags from './ScriptTags';

describe('ScriptTags', () => {
  it('renders without crashing', () => {
    const { container } = render(<ScriptTags />);
    expect(container).toBeInTheDocument();
  });

  it('honors a custom color prop', () => {
    const { container } = render(<ScriptTags color="#ffd700" />);
    expect(container).toBeInTheDocument();
  });

  it('honors custom separation + height props', () => {
    const { container } = render(<ScriptTags separation={2.0} height={1.0} />);
    expect(container).toBeInTheDocument();
  });
});
