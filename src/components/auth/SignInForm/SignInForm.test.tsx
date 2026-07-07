import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SignInForm from './SignInForm';

describe('SignInForm', () => {
  it('renders without crashing', () => {
    render(<SignInForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it('renders Remember Me checkbox unchecked by default', () => {
    render(<SignInForm />);
    const checkbox = screen.getByLabelText(/remember me/i);
    expect(checkbox).not.toBeChecked();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-class';
    const { container } = render(<SignInForm className={customClass} />);
    const form = container.querySelector('form');
    expect(form).toHaveClass(customClass);
  });
});
