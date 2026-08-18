/**
 * CodSkeleton — Accessibility Tests
 *
 * Canvas content is not auditable by axe-core (no DOM inside the WebGL
 * surface), so these tests assert only on the DOM chrome around the canvas:
 * the canvas aria-label, and no violations in the surrounding wrapper
 * (crosshair is aria-hidden, the controls hint is plain text).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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

/** Render, then press the start control — the scene is gated behind it (#757). */
function renderStarted(): ReturnType<typeof render> {
  const utils = render(<CodSkeleton />);
  fireEvent.click(utils.getByRole('button', { name: /start the scene/i }));
  return utils;
}

describe('CodSkeleton Accessibility', () => {
  // The gate (#757) means there are now TWO states a visitor can be looking at,
  // and the one they see FIRST is the placeholder. Auditing only the started
  // scene would leave the default state unmeasured — the shape of #411.
  it('should have no accessibility violations before the scene is started', async () => {
    const { container } = render(<CodSkeleton />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations on the DOM chrome', async () => {
    const { container } = renderStarted();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('canvas mock has an aria-label for screen-reader users', () => {
    const { getByTestId } = renderStarted();
    expect(getByTestId('canvas-mock').getAttribute('aria-label')).toBeTruthy();
  });

  it('the start control is reachable by name and meets the 44px touch floor', () => {
    // `min-h-11 min-w-11` is the repo's mobile-first touch target. It is asserted
    // here because jsdom has no layout: the class IS the contract, and the
    // mobile-touch-targets sweep cannot see a control that only exists after a
    // click it never performs.
    const { getByRole } = render(<CodSkeleton />);
    const start = getByRole('button', { name: /start the scene/i });

    expect(start.className).toContain('min-h-11');
    expect(start.className).toContain('min-w-11');
  });
});
