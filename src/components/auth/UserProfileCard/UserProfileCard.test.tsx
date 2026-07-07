import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import UserProfileCard from './UserProfileCard';

// Mock useUserProfile hook to return database profile
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
    refetch: vi.fn(),
  }),
}));

describe('UserProfileCard', () => {
  it('renders without crashing', () => {
    render(<UserProfileCard />);
    // With mocked profile, component should render the display_name
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('displays bio when available', () => {
    render(<UserProfileCard />);
    expect(screen.getByText('Test bio')).toBeInTheDocument();
  });
});
