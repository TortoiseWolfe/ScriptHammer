/**
 * ProceduralSky — Accessibility Tests
 *
 * ProceduralSky renders no DOM of its own (it only mutates the Three.js scene),
 * so there is no chrome to audit — the test simply asserts axe finds no
 * violations in the empty container.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';

expect.extend(toHaveNoViolations);

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({}),
}));

import ProceduralSky from './ProceduralSky';

describe('ProceduralSky Accessibility', () => {
  it('renders no DOM chrome, so has no accessibility violations', async () => {
    const { container } = render(<ProceduralSky />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
