import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import AccessibilityScript from './AccessibilityScript';

expect.extend(toHaveNoViolations);

/**
 * Script-only, so the accessibility contract is the ABSENCE — see ThemeScript's twin of
 * this file. Mounted at layout.tsx:162, above the skip link: anything rendered here would
 * precede "Skip to main content" for every keyboard and screen-reader user, on every route.
 *
 * Worth stating plainly: this component EXISTS for accessibility — it applies font size,
 * line height and family before first paint (#388). Its correctness lives in the unit test
 * beside this one, which asserts the tokens and the consent gate. What this file pins is
 * that it achieves that without putting anything in the tree itself.
 */
describe('AccessibilityScript Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<AccessibilityScript />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('contributes NOTHING to the accessibility tree', () => {
    const { container } = render(<AccessibilityScript />);
    expect(container.querySelectorAll('*')).toHaveLength(1);
    expect(container.firstElementChild?.tagName).toBe('SCRIPT');
  });

  it('adds nothing focusable ahead of the skip link', () => {
    const { container } = render(<AccessibilityScript />);
    expect(
      container.querySelectorAll(
        'a, button, input, select, textarea, [tabindex], [role]'
      )
    ).toHaveLength(0);
  });
});
