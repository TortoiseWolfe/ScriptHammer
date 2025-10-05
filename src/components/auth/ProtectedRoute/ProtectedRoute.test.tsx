import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ProtectedRoute from './ProtectedRoute';

describe('ProtectedRoute', () => {
  it('renders without crashing', () => {
    render(<ProtectedRoute />);
    const element = screen.getByText(/ProtectedRoute/i);
    expect(element).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    const testContent = 'Test Content';
    render(<ProtectedRoute>{testContent}</ProtectedRoute>);
    const element = screen.getByText(testContent);
    expect(element).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-class';
    const { container } = render(<ProtectedRoute className={customClass} />);
    const element = container.querySelector('.protected-route');
    expect(element).toHaveClass(customClass);
  });

  // TODO: Add more specific tests for ProtectedRoute functionality
});
