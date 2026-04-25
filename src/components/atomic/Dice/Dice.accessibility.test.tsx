/**
 * Accessibility Tests for Dice
 *
 * Covers axe baseline plus visual-accessibility contracts from spec
 * features/testing/037-game-a11y-tests/spec.md FR-019..023:
 *  - Aria-live region for the value (so the result is announced)
 *  - Animation class is wired during rolling state (the CSS rule in
 *    src/styles/reduced-motion.css targets the class so it can suppress
 *    the keyframe animation under user/OS reduced-motion).
 *  - Decorative icon hidden from assistive tech.
 *
 * jsdom doesn't apply imported stylesheets, so end-to-end suppression
 * verification belongs in Playwright. The DOM contract here ensures the
 * CSS has something to target.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import Dice from './Dice';

expect.extend(toHaveNoViolations);

describe('Dice Accessibility', () => {
  it('should have no accessibility violations with default props', async () => {
    const { container } = render(<Dice />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('exposes the dice value via an aria-live polite region', () => {
    const { container } = render(<Dice />);
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    // Initial state announces "not rolled yet" via .sr-only span
    expect(liveRegion?.textContent).toMatch(/not rolled yet/i);
  });

  it('marks the visual dice face as aria-hidden so screen readers use the live region only', () => {
    const { container } = render(<Dice />);
    const visualFace = container.querySelector('span[aria-hidden="true"]');
    expect(visualFace).not.toBeNull();
  });

  it('applies the animate-bounce class during the roll, so CSS can suppress it under reduced motion', () => {
    const { container } = render(<Dice />);
    const button = screen.getByRole('button', { name: /roll/i });
    act(() => {
      fireEvent.click(button);
    });
    // animate-bounce is the class our reduced-motion CSS rule targets.
    // If a future refactor switches to a different animation utility, the
    // CSS rule in src/styles/reduced-motion.css must be updated to match.
    expect(container.querySelector('.animate-bounce')).not.toBeNull();
  });
});
