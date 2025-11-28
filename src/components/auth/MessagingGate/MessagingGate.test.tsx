import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MessagingGate from './MessagingGate';

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
  isOAuthUser: vi.fn(),
}));

import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isOAuthUser } from '@/lib/auth/oauth-utils';

describe('MessagingGate', () => {
  const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
  const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
  const mockIsOAuthUser = isOAuthUser as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOAuthUser.mockReturnValue(false);
  });

  it('renders loading state when auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true });

    render(
      <MessagingGate>
        <div>Protected Content</div>
      </MessagingGate>
    );

    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders sign in required when no user', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false });

    render(
      <MessagingGate>
        <div>Protected Content</div>
      </MessagingGate>
    );

    expect(screen.getByText('Sign in required')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders blocked state for unverified email user', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'test-user',
        email: 'test@example.com',
        email_confirmed_at: null,
      },
      isLoading: false,
    });

    render(
      <MessagingGate>
        <div>Protected Content</div>
      </MessagingGate>
    );

    expect(screen.getByText('Email Verification Required')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /resend verification/i })
    ).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children for verified email user', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'test-user',
        email: 'test@example.com',
        email_confirmed_at: '2025-01-01T00:00:00Z',
      },
      isLoading: false,
    });

    render(
      <MessagingGate>
        <div>Protected Content</div>
      </MessagingGate>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(
      screen.queryByText('Email Verification Required')
    ).not.toBeInTheDocument();
  });

  it('renders children for OAuth user (provider-verified)', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'oauth-user',
        email: 'oauth@example.com',
        email_confirmed_at: null,
        app_metadata: { provider: 'google' },
      },
      isLoading: false,
    });
    mockIsOAuthUser.mockReturnValue(true);

    render(
      <MessagingGate>
        <div>Protected Content</div>
      </MessagingGate>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(
      screen.queryByText('Email Verification Required')
    ).not.toBeInTheDocument();
  });

  it('shows resend button in blocked state', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'test-user',
        email: 'test@example.com',
        email_confirmed_at: null,
      },
      isLoading: false,
    });

    render(
      <MessagingGate>
        <div>Protected Content</div>
      </MessagingGate>
    );

    const resendButton = screen.getByRole('button', {
      name: /resend verification/i,
    });
    expect(resendButton).toBeInTheDocument();
    expect(resendButton).not.toBeDisabled();
  });

  it('handles resend verification success', async () => {
    const mockResend = vi.fn().mockResolvedValue({ error: null });
    mockCreateClient.mockReturnValue({
      auth: { resend: mockResend },
    });

    mockUseAuth.mockReturnValue({
      user: {
        id: 'test-user',
        email: 'test@example.com',
        email_confirmed_at: null,
      },
      isLoading: false,
    });

    render(
      <MessagingGate>
        <div>Protected Content</div>
      </MessagingGate>
    );

    const resendButton = screen.getByRole('button', {
      name: /resend verification/i,
    });
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(screen.getByText(/verification email sent/i)).toBeInTheDocument();
    });
  });

  it('handles resend verification error', async () => {
    const mockResend = vi
      .fn()
      .mockResolvedValue({ error: { message: 'Rate limit exceeded' } });
    mockCreateClient.mockReturnValue({
      auth: { resend: mockResend },
    });

    mockUseAuth.mockReturnValue({
      user: {
        id: 'test-user',
        email: 'test@example.com',
        email_confirmed_at: null,
      },
      isLoading: false,
    });

    render(
      <MessagingGate>
        <div>Protected Content</div>
      </MessagingGate>
    );

    const resendButton = screen.getByRole('button', {
      name: /resend verification/i,
    });
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
    });
  });

  it('allows OAuth user with null email_confirmed_at (edge case)', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'oauth-edge-case',
        email: 'oauth@example.com',
        email_confirmed_at: null,
        app_metadata: { provider: 'github' },
      },
      isLoading: false,
    });
    mockIsOAuthUser.mockReturnValue(true);

    render(
      <MessagingGate>
        <div>Protected Content</div>
      </MessagingGate>
    );

    // OAuth users should bypass even if email_confirmed_at is null
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
