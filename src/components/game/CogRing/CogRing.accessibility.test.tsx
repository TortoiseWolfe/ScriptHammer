/**
 * CogRing — Accessibility Tests
 *
 * Feature 047 — Three.js Game (T039)
 *
 * CogRing is a Three.js scene sub-tree — it has no DOM surface of its own.
 * jest-axe runs on the rendered (empty) container to confirm there are no
 * inappropriate DOM-level a11y issues introduced.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';

expect.extend(toHaveNoViolations);

vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
  useThree: () => ({}),
}));

import CogRing from './CogRing';

describe('CogRing Accessibility', () => {
  it('has no a11y violations when rendered in isolation (no DOM surface)', async () => {
    const { container } = render(<CogRing />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
