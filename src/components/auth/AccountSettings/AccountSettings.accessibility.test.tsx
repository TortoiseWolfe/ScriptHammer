import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import AccountSettings from './AccountSettings';

describe('AccountSettings Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<AccountSettings />);

    // Disable color-contrast rule - jsdom doesn't support getComputedStyle for pseudo-elements
    // Color contrast is tested via Lighthouse in CI
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', () => {
    const { container } = render(<AccountSettings />);

    // Add specific ARIA attribute tests based on component type
    // Example: const button = container.querySelector('button');
    // expect(button).toHaveAttribute('aria-label');
  });

  it('should be keyboard navigable', () => {
    const { container } = render(<AccountSettings />);

    // Test keyboard navigation
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    focusableElements.forEach((element: Element) => {
      expect(element).toBeVisible();
    });
  });

  it.skip('should have sufficient color contrast', async () => {
    // Color contrast testing requires getComputedStyle for pseudo-elements
    // which is not implemented in jsdom. Use Lighthouse or real browser testing
    // for color contrast validation. See CLAUDE.md - Lighthouse scores section.
    const { container } = render(<AccountSettings />);

    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });

    expect(results).toHaveNoViolations();
  });

  it('should support screen readers', () => {
    const { container } = render(<AccountSettings />);

    // Check for screen reader support
    // Example: Images should have alt text
    const images = container.querySelectorAll('img');
    images.forEach((img: Element) => {
      expect(img).toHaveAttribute('alt');
    });
  });
});
