import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import ErrorBanner from './ErrorBanner';

expect.extend(toHaveNoViolations);

describe('ErrorBanner Accessibility', () => {
  const defaultProps = {
    message: 'Something went wrong',
    onDismiss: vi.fn(),
  };

  it('should have no axe violations', async () => {
    const { container } = render(<ErrorBanner {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has role="alert" for screen readers', () => {
    render(<ErrorBanner {...defaultProps} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('dismiss button has an accessible aria-label', () => {
    render(<ErrorBanner {...defaultProps} />);
    const button = screen.getByRole('button', { name: /dismiss error/i });
    expect(button).toHaveAttribute('aria-label', 'Dismiss error');
  });
});
