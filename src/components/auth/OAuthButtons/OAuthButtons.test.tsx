import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import OAuthButtons from './OAuthButtons';

describe('OAuthButtons', () => {
  it('renders without crashing', () => {
    render(<OAuthButtons />);
    const element = screen.getByText(/OAuthButtons/i);
    expect(element).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    const testContent = 'Test Content';
    render(<OAuthButtons>{testContent}</OAuthButtons>);
    const element = screen.getByText(testContent);
    expect(element).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-class';
    const { container } = render(<OAuthButtons className={customClass} />);
    const element = container.querySelector('.o-auth-buttons');
    expect(element).toHaveClass(customClass);
  });

  // TODO: Add more specific tests for OAuthButtons functionality
});
