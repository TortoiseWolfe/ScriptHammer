import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CopyButton } from './CopyButton';

expect.extend(toHaveNoViolations);

describe('CopyButton Accessibility', () => {
  it('should not have basic accessibility issues', async () => {
    const { container } = render(<CopyButton content="Test content to copy" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA labels', () => {
    const { getByRole } = render(<CopyButton content="Test content" />);
    const button = getByRole('button');
    expect(button).toHaveAttribute('aria-label');
  });

  it('should have screen reader text', () => {
    const { container } = render(<CopyButton content="Test content" />);
    const srOnly = container.querySelector('.sr-only');
    expect(srOnly).toBeTruthy();
    expect(srOnly?.textContent).toBe('Copy to clipboard');
  });

  it('should be keyboard accessible', () => {
    const { getByRole } = render(<CopyButton content="Test content" />);
    const button = getByRole('button');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).not.toBeDisabled();
  });
});
