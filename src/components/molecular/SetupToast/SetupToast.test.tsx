/**
 * Unit Tests for SetupToast Component
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SetupToast from './SetupToast';

describe('SetupToast', () => {
  it('renders the success message', () => {
    render(<SetupToast onDismiss={vi.fn()} />);
    expect(screen.getByText('Encryption set up!')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Make sure you saved your messaging password/
      )
    ).toBeInTheDocument();
  });

  it('renders the dismiss button', () => {
    render(<SetupToast onDismiss={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Dismiss' });
    expect(button).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const handleDismiss = vi.fn();
    render(<SetupToast onDismiss={handleDismiss} />);

    const button = screen.getByRole('button', { name: 'Dismiss' });
    await user.click(button);

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('has aria-label on the dismiss button', () => {
    render(<SetupToast onDismiss={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Dismiss' });
    expect(button).toHaveAttribute('aria-label', 'Dismiss');
  });

  it('renders the success alert with correct styling', () => {
    const { container } = render(<SetupToast onDismiss={vi.fn()} />);
    const alert = container.querySelector('.alert-success');
    expect(alert).toBeInTheDocument();
  });

  it('renders the success icon SVG', () => {
    const { container } = render(<SetupToast onDismiss={vi.fn()} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('h-6', 'w-6');
  });
});
