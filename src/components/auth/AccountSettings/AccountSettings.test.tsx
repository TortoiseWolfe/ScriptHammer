import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AccountSettings from './AccountSettings';

// Mock the useUserProfile hook to return a loaded state
vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    profile: {
      id: 'test-user-id',
      username: 'testuser',
      display_name: 'Test User',
      bio: 'Test bio',
      avatar_url: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    refreshSession: vi.fn(),
  }),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
    from: () => ({
      update: () => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
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
  it('renders without crashing', () => {
    render(<AccountSettings />);
    expect(
      screen.getByRole('heading', { name: /profile settings/i })
    ).toBeInTheDocument();
  });

  // TODO: Add more specific tests for AccountSettings functionality
});
