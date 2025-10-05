import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ProtectedRoute from './ProtectedRoute';

describe('ProtectedRoute', () => {
  it('renders without crashing', () => {
    render(
      <ProtectedRoute>
        <div>Test</div>
      </ProtectedRoute>
    );
    const element = screen.getByText(/Test/i);
    expect(element).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    const testContent = 'Test Content';
    render(<ProtectedRoute>{testContent}</ProtectedRoute>);
    const element = screen.getByText(testContent);
    expect(element).toBeInTheDocument();
  });

  // TODO: Add more specific tests for ProtectedRoute functionality
});
