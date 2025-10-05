import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EmailVerificationNotice from './EmailVerificationNotice';

describe('EmailVerificationNotice', () => {
  it('renders without crashing', () => {
    render(<EmailVerificationNotice />);
    const element = screen.getByText(/EmailVerificationNotice/i);
    expect(element).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    const testContent = 'Test Content';
    render(<EmailVerificationNotice>{testContent}</EmailVerificationNotice>);
    const element = screen.getByText(testContent);
    expect(element).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-class';
    const { container } = render(
      <EmailVerificationNotice className={customClass} />
    );
    const element = container.querySelector('.email-verification-notice');
    expect(element).toHaveClass(customClass);
  });

  // TODO: Add more specific tests for EmailVerificationNotice functionality
});
