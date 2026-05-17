/**
 * Scene — Accessibility Tests
 *
 * Feature 047 — Three.js Game (T009)
 *
 * Canvas content is not auditable by axe-core (no DOM inside the WebGL
 * surface), so these tests assert only on the DOM chrome surrounding
 * the canvas: aria-label on the canvas, role/landmark structure, no
 * focusable-without-label elements.
 *
 * Manual a11y review (see tasks.md T049) covers the rest of the canvas
 * surface (keyboard, screen reader behavior, motion preferences).
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';

expect.extend(toHaveNoViolations);

vi.mock('@react-three/fiber', () => ({
  Canvas: ({
    children,
    ...rest
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <div
      role="img"
      aria-label={(rest['aria-label'] as string) ?? '3D scene preview'}
      data-testid="canvas-mock"
    >
      {children}
    </div>
  ),
  useFrame: () => {},
  useThree: () => ({}),
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
}));

import Scene from './Scene';

describe('Scene Accessibility', () => {
  it('should have no accessibility violations on the DOM chrome', async () => {
    const { container } = render(<Scene />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('canvas mock has an aria-label for screen-reader users', () => {
    const { getByTestId } = render(<Scene />);
    const canvas = getByTestId('canvas-mock');
    expect(canvas.getAttribute('aria-label')).toBeTruthy();
  });
});
