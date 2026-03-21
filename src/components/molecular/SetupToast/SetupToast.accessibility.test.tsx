/**
 * Accessibility Tests for SetupToast
 *
 * Tests ARIA labels, semantic HTML, and axe violations
 * for the post-setup encryption toast.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import SetupToast from './SetupToast';

expect.extend(toHaveNoViolations);

describe('SetupToast Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<SetupToast onDismiss={vi.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have aria-label on the dismiss button', () => {
    render(<SetupToast onDismiss={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Dismiss' });
    expect(button).toHaveAttribute('aria-label', 'Dismiss');
  });

  it('should have a button element for dismiss action', () => {
    render(<SetupToast onDismiss={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Dismiss' });
    expect(button.tagName).toBe('BUTTON');
  });

  it('should have visible text content for the success message', () => {
    render(<SetupToast onDismiss={vi.fn()} />);
    expect(screen.getByText('Encryption set up!')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Make sure you saved your messaging password/
      )
    ).toBeInTheDocument();
  });

  it('should have the success icon SVG with proper attributes', () => {
    const { container } = render(<SetupToast onDismiss={vi.fn()} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
  });

  it('should have proper semantic structure with alert role', () => {
    const { container } = render(<SetupToast onDismiss={vi.fn()} />);
    const alert = container.querySelector('.alert');
    expect(alert).toBeInTheDocument();
  });
});
