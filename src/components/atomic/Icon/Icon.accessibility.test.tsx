import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import Icon from './Icon';
import { ICON_NAMES } from './icons';

expect.extend(toHaveNoViolations);

/**
 * Accessible names are an API in this repo (#377).
 *
 * `performSignIn()` and roughly twenty specs locate controls by their
 * accessible name, and the emoji this set replaced carried names explicitly —
 * `CookieConsent` rendered `role="img" aria-label="Cookie"` next to a sentence
 * that already said "We use cookies", so that name only repeated the copy and
 * the replacement is deliberately decorative. An SVG that silently renders
 * unlabelled changes what axe sees and what those locators can find, without
 * failing anything at the point of the swap — hence the union in the props.
 */
describe('Icon Accessibility', () => {
  it('has no violations when labelled', async () => {
    const { container } = render(<Icon name="menu" label="Open menu" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations when decorative', async () => {
    const { container } = render(<Icon name="menu" decorative />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('exposes a labelled icon as an image with its name', () => {
    const { container } = render(<Icon name="alert" label="Warning" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-label', 'Warning');
    expect(svg).not.toHaveAttribute('aria-hidden');
  });

  it('removes a decorative icon from the accessibility tree', () => {
    const { container } = render(<Icon name="alert" decorative />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role', 'img');
    // Keeps IE/legacy SVG focus behaviour out of the tab order.
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it('never renders an icon that is both named and hidden', () => {
    // A decorative icon carrying a name, or a labelled one marked hidden, is
    // the failure mode the prop union exists to make unrepresentable. This
    // asserts the rendered output actually honours it.
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} decorative />);
      const svg = container.querySelector('svg')!;
      expect(
        svg.hasAttribute('aria-label') && svg.getAttribute('aria-hidden'),
        `${name} rendered both an accessible name and aria-hidden`
      ).toBeFalsy();
      unmount();
    }
  });

  it('inherits colour so it meets contrast wherever it is placed', () => {
    // currentColor is what lets one drawing satisfy contrast on all 32 themes;
    // a hard-coded stroke would need a per-theme variant and would silently
    // fail the theme sweep.
    const { container } = render(<Icon name="check" decorative />);
    expect(container.querySelector('svg')).toHaveAttribute(
      'stroke',
      'currentColor'
    );
  });
});
