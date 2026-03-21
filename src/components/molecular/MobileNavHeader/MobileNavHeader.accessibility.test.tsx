import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import MobileNavHeader from './MobileNavHeader';

expect.extend(toHaveNoViolations);

describe('MobileNavHeader Accessibility', () => {
  it('should have no axe violations', async () => {
    const { container } = render(<MobileNavHeader title="Messages" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has aria-label on the hamburger menu label', () => {
    const { container } = render(<MobileNavHeader title="Messages" />);
    const label = container.querySelector('label[aria-label="Open sidebar"]');
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('aria-label', 'Open sidebar');
  });

  it('has proper semantic structure', () => {
    const { container } = render(<MobileNavHeader title="Messages" />);
    // navbar wrapper exists
    const navbar = container.querySelector('.navbar');
    expect(navbar).toBeInTheDocument();
    // label element is used for the toggle (not a button without context)
    const label = container.querySelector('label[for="sidebar-drawer"]');
    expect(label).toBeInTheDocument();
    // title text is rendered in a span
    const titleSpan = container.querySelector('span.text-lg');
    expect(titleSpan).toBeInTheDocument();
    expect(titleSpan?.textContent).toBe('Messages');
  });
});
