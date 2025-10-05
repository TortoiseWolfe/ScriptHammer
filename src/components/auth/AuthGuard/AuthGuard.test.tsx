import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AuthGuard from './AuthGuard';

describe('AuthGuard', () => {
  it('renders without crashing', () => {
    render(<AuthGuard />);
    const element = screen.getByText(/AuthGuard/i);
    expect(element).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    const testContent = 'Test Content';
    render(<AuthGuard>{testContent}</AuthGuard>);
    const element = screen.getByText(testContent);
    expect(element).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-class';
    const { container } = render(<AuthGuard className={customClass} />);
    const element = container.querySelector('.auth-guard');
    expect(element).toHaveClass(customClass);
  });

  // TODO: Add more specific tests for AuthGuard functionality
});
