import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import ThemeScript from './ThemeScript';

expect.extend(toHaveNoViolations);

/**
 * A script-only component has no DOM for axe to scan, so an axe-clean assertion alone
 * would pass no matter what this rendered. The real accessibility contract is the
 * ABSENCE, and that is what is asserted — the shape PaymentQueueSync already uses.
 *
 * This is not ceremony. ThemeScript is mounted in the ROOT LAYOUT, at layout.tsx:161,
 * ABOVE the skip link. Anything it rendered would land ahead of "Skip to main content"
 * for every keyboard and screen-reader user on every route.
 */
describe('ThemeScript Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<ThemeScript />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('contributes NOTHING to the accessibility tree', () => {
    const { container } = render(<ThemeScript />);
    // One node, and it is the script. Not "no violations" — nothing at all.
    //
    // NOT asserted via textContent: a <script>'s own source IS its textContent, so that
    // check fails on correct code. What matters is that the single node is a SCRIPT,
    // which the accessibility tree does not expose at all.
    expect(container.querySelectorAll('*')).toHaveLength(1);
    expect(container.firstElementChild?.tagName).toBe('SCRIPT');
  });

  it('adds nothing focusable ahead of the skip link', () => {
    const { container } = render(<ThemeScript />);
    expect(
      container.querySelectorAll(
        'a, button, input, select, textarea, [tabindex], [role]'
      )
    ).toHaveLength(0);
  });
});
