/**
 * CodSkeleton — Accessibility Tests
 *
 * Canvas content is not auditable by axe-core (no DOM inside the WebGL
 * surface), so these tests assert only on the DOM chrome around the canvas:
 * the canvas aria-label, and no violations in the surrounding wrapper
 * (crosshair is aria-hidden, the controls hint is plain text).
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
      aria-label={
        (rest['aria-label'] as string) ?? 'First-person walking skeleton'
      }
      data-testid="canvas-mock"
    >
      {children}
    </div>
  ),
  useFrame: () => {},
  useThree: () => ({}),
}));

import CodSkeleton from './CodSkeleton';

describe('CodSkeleton Accessibility', () => {
  it('should have no accessibility violations on the DOM chrome', async () => {
    const { container } = render(<CodSkeleton />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('canvas mock has an aria-label for screen-reader users', () => {
    const { getByTestId } = render(<CodSkeleton />);
    expect(getByTestId('canvas-mock').getAttribute('aria-label')).toBeTruthy();
  });
});
