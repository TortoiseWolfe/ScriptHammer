import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ForgotPasswordForm from './ForgotPasswordForm';

describe('ForgotPasswordForm', () => {
  it('renders without crashing', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /send reset link/i })
    ).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-class';
    const { container } = render(
      <ForgotPasswordForm className={customClass} />
    );
    const form = container.querySelector('form');
    expect(form).toHaveClass(customClass);
  });

  // TODO: Add more specific tests for ForgotPasswordForm functionality
});
