import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import MessagingGate from './MessagingGate';

expect.extend(toHaveNoViolations);

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      resend: vi.fn(),
    },
  })),
}));

vi.mock('@/lib/auth/oauth-utils', () => ({
  isOAuthUser: vi.fn(() => false),
}));

import { useAuth } from '@/contexts/AuthContext';

describe('MessagingGate Accessibility', () => {
  const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has no accessibility violations in blocked state', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'test-user',
        email: 'test@example.com',
        email_confirmed_at: null,
      },
      isLoading: false,
    });

    const { container } = render(
      <MessagingGate>
        <div>Protected Content</div>
      </MessagingGate>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations when allowed', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'test-user',
        email: 'test@example.com',
        email_confirmed_at: '2025-01-01T00:00:00Z',
      },
      isLoading: false,
    });

    const { container } = render(
      <MessagingGate>
        <div>Protected Content</div>
      </MessagingGate>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations in loading state', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
    });

    const { container } = render(
      <MessagingGate>
        <div>Protected Content</div>
      </MessagingGate>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has proper button accessibility attributes', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'test-user',
        email: 'test@example.com',
        email_confirmed_at: null,
      },
      isLoading: false,
    });

    const { getByRole } = render(
      <MessagingGate>
        <div>Protected Content</div>
      </MessagingGate>
    );

    const button = getByRole('button', { name: /resend verification/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });
});
