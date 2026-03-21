import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBanner from './ErrorBanner';

describe('ErrorBanner', () => {
  const defaultProps = {
    message: 'Something went wrong',
    onDismiss: vi.fn(),
  };

  it('renders the message text', () => {
    render(<ErrorBanner {...defaultProps} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner message="Error occurred" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss error/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has role="alert"', () => {
    render(<ErrorBanner {...defaultProps} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('dismiss button has aria-label', () => {
    render(<ErrorBanner {...defaultProps} />);
    const button = screen.getByRole('button', { name: /dismiss error/i });
    expect(button).toHaveAttribute('aria-label', 'Dismiss error');
  });
});
