/**
 * Accessibility Tests for DraggableDice
 *
 * Covers axe baseline plus visual-accessibility contracts from spec
 * features/testing/037-game-a11y-tests/spec.md FR-019..023.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import DraggableDice from './DraggableDice';

expect.extend(toHaveNoViolations);

describe('DraggableDice Accessibility', () => {
  it('should have no accessibility violations with required props', async () => {
    const { container } = render(<DraggableDice id="dice-1" value={1} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in the locked state', async () => {
    const { container } = render(
      <DraggableDice id="dice-1" value={5} locked />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('applies the animate-spin class while rolling, so CSS can suppress it under reduced motion', () => {
    const { container } = render(
      <DraggableDice id="dice-1" value={3} isRolling />
    );
    // animate-spin is the class our reduced-motion CSS rule targets
    // (src/styles/reduced-motion.css). If this class changes, update the
    // CSS rule too — the suppression is class-name keyed.
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('does not animate-spin when not rolling', () => {
    const { container } = render(<DraggableDice id="dice-1" value={3} />);
    expect(container.querySelector('.animate-spin')).toBeNull();
  });

  it('exposes a descriptive aria-label including value and lock state', () => {
    const { container } = render(
      <DraggableDice id="dice-1" value={5} locked />
    );
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-label')).toMatch(/showing 5/);
    expect(root?.getAttribute('aria-label')).toMatch(/locked/);
  });
});
