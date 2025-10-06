import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ResetPasswordForm from './ResetPasswordForm';

describe('ResetPasswordForm', () => {
  it('renders without crashing', () => {
    render(<ResetPasswordForm />);
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reset password/i })
    ).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-class';
    const { container } = render(<ResetPasswordForm className={customClass} />);
    const form = container.querySelector('form');
    expect(form).toHaveClass(customClass);
  });

  // TODO: Add more specific tests for ResetPasswordForm functionality
});
