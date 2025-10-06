import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SignUpForm from './SignUpForm';

describe('SignUpForm', () => {
  it('renders without crashing', () => {
    render(<SignUpForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign up/i })
    ).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-class';
    const { container } = render(<SignUpForm className={customClass} />);
    const form = container.querySelector('form');
    expect(form).toHaveClass(customClass);
  });

  // TODO: Add more specific tests for SignUpForm functionality
});
