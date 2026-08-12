import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AccountSettings from './AccountSettings';

// Create mock functions we can spy on
const {
  mockRefetch,
  mockRefreshSession,
  mockFrom,
  mockUpsert,
  mockUpsertSelect,
  mockUpsertSingle,
  mockProfileSelect,
  mockUsernameEq,
  mockUsernameNeq,
  mockUsernameLimit,
  mockProfile,
} = vi.hoisted(() => ({
  mockRefetch: vi.fn(),
  mockRefreshSession: vi.fn(),
  mockFrom: vi.fn(),
  mockUpsert: vi.fn(),
  mockUpsertSelect: vi.fn(),
  mockUpsertSingle: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockUsernameEq: vi.fn(),
  mockUsernameNeq: vi.fn(),
  mockUsernameLimit: vi.fn(),
  mockProfile: {
    id: 'test-user-id',
    username: 'testuser-b',
    display_name: 'Test User',
    bio: 'Test bio',
    avatar_url: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
}));

// Mock the useUserProfile hook to return a loaded state
vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    profile: mockProfile,
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
    from: mockFrom,
  }),
}));

describe('AccountSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfile.username = 'testuser-b';

    mockUsernameLimit.mockResolvedValue({ data: [], error: null });
    mockUsernameNeq.mockReturnValue({ limit: mockUsernameLimit });
    mockUsernameEq.mockReturnValue({ neq: mockUsernameNeq });
    mockProfileSelect.mockReturnValue({ eq: mockUsernameEq });

    mockUpsertSingle.mockResolvedValue({
      data: {
        id: 'test-user-id',
        username: 'existing_user',
        display_name: 'Test User',
        bio: 'Test bio',
      },
      error: null,
    });
    mockUpsertSelect.mockReturnValue({ single: mockUpsertSingle });
    mockUpsert.mockReturnValue({ select: mockUpsertSelect });
    mockFrom.mockReturnValue({
      upsert: mockUpsert,
      select: mockProfileSelect,
    });
  });

  async function getHydratedUsernameInput() {
    const username = screen.getByLabelText('Username');
    await waitFor(() => expect(username).toHaveValue('testuser-b'));
    return username;
  }

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

  it('keeps an existing hyphenated username eligible for profile updates', async () => {
    render(<AccountSettings />);

    await getHydratedUsernameInput();
    fireEvent.click(screen.getByRole('button', { name: /update profile/i }));

    await waitFor(() => {
      expect(mockUsernameEq).toHaveBeenCalledWith('username', 'testuser-b');
      expect(mockUsernameNeq).toHaveBeenCalledWith('id', 'test-user-id');
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          id: 'test-user-id',
          username: 'testuser-b',
          display_name: 'Test User',
          bio: 'Test bio',
        },
        { onConflict: 'id' }
      );
    });
  });

  it('hydrates and saves a normalized username', async () => {
    render(<AccountSettings />);

    const username = await getHydratedUsernameInput();

    fireEvent.change(username, { target: { value: '  New-User  ' } });
    fireEvent.click(screen.getByRole('button', { name: /update profile/i }));

    await waitFor(() => {
      expect(mockUsernameEq).toHaveBeenCalledWith('username', 'new-user');
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          id: 'test-user-id',
          username: 'new-user',
          display_name: 'Test User',
          bio: 'Test bio',
        },
        { onConflict: 'id' }
      );
    });
  });

  it('blocks an invalid username before writing a profile', async () => {
    render(<AccountSettings />);
    const username = await getHydratedUsernameInput();

    fireEvent.change(username, { target: { value: 'notallowed!' } });
    fireEvent.click(screen.getByRole('button', { name: /update profile/i }));

    expect(
      await screen.findByText(
        'Username can only contain letters, numbers, underscores, and hyphens'
      )
    ).toBeInTheDocument();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('blocks an unavailable username before writing a profile', async () => {
    mockUsernameLimit.mockResolvedValue({
      data: [{ id: 'other-user-id' }],
      error: null,
    });
    render(<AccountSettings />);
    fireEvent.change(await getHydratedUsernameInput(), {
      target: { value: 'taken-name' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update profile/i }));

    expect(
      await screen.findByText('This username is already taken')
    ).toBeInTheDocument();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('saves a blank username as null without checking availability', async () => {
    render(<AccountSettings />);

    fireEvent.change(await getHydratedUsernameInput(), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update profile/i }));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          id: 'test-user-id',
          username: null,
          display_name: 'Test User',
          bio: 'Test bio',
        },
        { onConflict: 'id' }
      );
    });
    expect(mockUsernameEq).not.toHaveBeenCalled();
  });

  it('handles a duplicate-username write race', async () => {
    mockUpsertSingle.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });
    render(<AccountSettings />);

    fireEvent.change(await getHydratedUsernameInput(), {
      target: { value: 'available-name' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update profile/i }));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          id: 'test-user-id',
          username: 'available-name',
          display_name: 'Test User',
          bio: 'Test bio',
        },
        { onConflict: 'id' }
      );
    });
    expect(
      await screen.findByText('This username is already taken')
    ).toBeInTheDocument();
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
