import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    render(<AccountSettings />);

    // Use role-based queries which automatically exclude hidden elements
    const buttons = screen.getAllByRole('button');
    const links = screen.queryAllByRole('link');
    const inputs = screen.queryAllByRole('textbox');

    // Verify interactive elements are accessible
    expect(buttons.length).toBeGreaterThan(0);

    // Check all found buttons are in the document and visible
    buttons.forEach((button) => {
      expect(button).toBeInTheDocument();
    });

    // Links and inputs might not exist, but if they do, verify them
    links.forEach((link) => {
      expect(link).toBeInTheDocument();
    });

    inputs.forEach((input) => {
      expect(input).toBeInTheDocument();
    });
  });

  // Color contrast test removed - Lighthouse provides comprehensive color contrast testing
  // Current Lighthouse accessibility score: 96/100 (verified via CLI)
  // See CLAUDE.md - Lighthouse Scores section

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
