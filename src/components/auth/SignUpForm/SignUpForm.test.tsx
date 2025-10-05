import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SignUpForm from './SignUpForm';

describe('SignUpForm', () => {
  it('renders without crashing', () => {
    render(<SignUpForm />);
    const element = screen.getByText(/SignUpForm/i);
    expect(element).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    const testContent = 'Test Content';
    render(<SignUpForm>{testContent}</SignUpForm>);
    const element = screen.getByText(testContent);
    expect(element).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-class';
    const { container } = render(<SignUpForm className={customClass} />);
    const element = container.querySelector('.sign-up-form');
    expect(element).toHaveClass(customClass);
  });

  // TODO: Add more specific tests for SignUpForm functionality
});
