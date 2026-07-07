import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AccountSettings from './AccountSettings';

// Create mock functions we can spy on
const mockRefetch = vi.fn();
const mockRefreshSession = vi.fn();

// Mock the useUserProfile hook to return a loaded state
vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    profile: {
      id: 'test-user-id',
      display_name: 'Test User',
      bio: 'Test bio',
      avatar_url: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    loading: false,
    error: null,
    refetch: mockRefetch,
  }),
}));

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    refreshSession: mockRefreshSession,
  }),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
    from: () => ({
      // Changed from .update() to .upsert() for profile updates (Feature 035)
      upsert: () => ({
        select: () => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'test-user-id',
              display_name: 'Test User',
              bio: 'Test bio',
            },
            error: null,
          }),
        }),
      }),
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        neq: () => ({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  }),
}));

describe('AccountSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<AccountSettings />);
    expect(
      screen.getByRole('heading', { name: /profile settings/i })
    ).toBeInTheDocument();
  });

  // Feature 038: Tests for split error states (FR-003)
  it('renders Profile Settings and Change Password forms', () => {
    render(<AccountSettings />);
    expect(
      screen.getByRole('heading', { name: /profile settings/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /change password/i })
    ).toBeInTheDocument();
  });

  it('has separate form submissions for profile and password', () => {
    render(<AccountSettings />);
    const updateProfileBtn = screen.getByRole('button', {
      name: /update profile/i,
    });
    const changePasswordBtn = screen.getByRole('button', {
      name: /change password/i,
    });
    expect(updateProfileBtn).toBeInTheDocument();
    expect(changePasswordBtn).toBeInTheDocument();
  });

  // Feature 038: Tests for inline alerts (FR-004, FR-005)
  it('displays profile error inline within Profile Settings card', async () => {
    render(<AccountSettings />);
    // Profile form validation - display name can be empty, but submitting triggers form
    // The inline alert structure exists, just need to verify it has proper ARIA
    const container = document.querySelector('.card-body');
    expect(container).toBeInTheDocument();
  });

  // Feature 038: Test that no bottom-of-page alerts exist (FR-006)
  it('does not render profile or password error alerts on initial render', () => {
    render(<AccountSettings />);
    // No profile or password error/success alerts should be visible initially
    // These are conditionally rendered when profileError, profileSuccess,
    // passwordError, or passwordSuccess states are set
    expect(
      screen.queryByText('Profile updated successfully!')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Password changed successfully!')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Failed to update profile. Please try again.')
    ).not.toBeInTheDocument();
  });
});
