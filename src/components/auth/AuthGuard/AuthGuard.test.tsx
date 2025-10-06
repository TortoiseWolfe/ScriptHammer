import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AuthGuard from './AuthGuard';

describe('AuthGuard', () => {
  it('renders without crashing', () => {
    render(
      <AuthGuard requireVerification={false}>
        <div>Test</div>
      </AuthGuard>
    );
    const element = screen.getByText(/Test/i);
    expect(element).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    const testContent = 'Test Content';
    render(<AuthGuard requireVerification={false}>{testContent}</AuthGuard>);
    const element = screen.getByText(testContent);
    expect(element).toBeInTheDocument();
  });

  // TODO: Add more specific tests for AuthGuard functionality
});
