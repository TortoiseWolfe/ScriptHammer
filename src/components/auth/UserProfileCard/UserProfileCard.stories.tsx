import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import UserProfileCard from './UserProfileCard';
import { AuthContext, AuthContextType } from '@/contexts/AuthContext';
import { User } from '@supabase/supabase-js';

// Mock authenticated user with complete profile data
const mockUser: User = {
  id: 'user-123-456-789',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'john.doe@example.com',
  email_confirmed_at: '2024-01-15T10:30:00Z',
  phone: '',
  confirmed_at: '2024-01-15T10:30:00Z',
  last_sign_in_at: '2024-03-20T14:22:00Z',
  app_metadata: {
    provider: 'email',
    providers: ['email'],
  },
  user_metadata: {
    username: 'johndoe',
    bio: 'Full-stack developer passionate about React and TypeScript. Building awesome web applications.',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
  },
  identities: [],
  created_at: '2024-01-15T10:30:00Z',
  updated_at: '2024-03-20T14:22:00Z',
};

/**
 * Decorator that provides a mock authenticated user using the real AuthContext
 */
const withMockAuthenticatedUser = (Story: any) => {
  const mockAuthValue: AuthContextType = {
    user: mockUser,
    session: null,
    isLoading: false,
    isAuthenticated: true,
    error: null,
    retryCount: 0,
    signUp: async () => ({ error: null }),
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    refreshSession: async () => {},
    retry: async () => {},
    clearError: () => {},
  };

  return (
    <AuthContext.Provider value={mockAuthValue}>
      <Story />
    </AuthContext.Provider>
  );
};

/**
 * Decorator that provides no authenticated user (unauthenticated state)
 */
const withMockUnauthenticatedUser = (Story: any) => {
  const mockAuthValue: AuthContextType = {
    user: null,
    session: null,
    isLoading: false,
    isAuthenticated: false,
    error: null,
    retryCount: 0,
    signUp: async () => ({ error: null }),
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    refreshSession: async () => {},
    retry: async () => {},
    clearError: () => {},
  };

  return (
    <AuthContext.Provider value={mockAuthValue}>
      <Story />
    </AuthContext.Provider>
  );
};

const meta: Meta<typeof UserProfileCard> = {
  title: 'Features/Authentication/UserProfileCard',
  component: UserProfileCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
User profile card displaying authenticated user information from user_profiles database table.

**Authentication Required**: This component uses the \`useAuth()\` hook and will return \`null\` if no user is authenticated.

**Displays**:
- User avatar (first letter of display_name if no avatar URL)
- Display name (from user_profiles.display_name, fallback to email)
- Email address
- Bio (from user_profiles.bio, if available)

**Data Source**: Profile data comes from user_profiles table via useUserProfile hook (same source as AccountSettings).
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * User profile card with authenticated user.
 * Shows user email, display_name, and bio from user_profiles database.
 */
export const Authenticated: Story = {
  decorators: [withMockAuthenticatedUser],
  args: {},
};

/**
 * User profile card when no user is authenticated.
 * Component returns null and renders nothing.
 */
export const Unauthenticated: Story = {
  decorators: [withMockUnauthenticatedUser],
  args: {},
  render: (args) => (
    <div className="flex flex-col items-center gap-4">
      <UserProfileCard {...args} />
      <div className="card bg-base-100 max-w-md p-6 shadow-xl">
        <p className="text-center text-sm">
          ℹ️ Component returns null when no user is authenticated. Nothing is
          rendered above this message.
        </p>
      </div>
    </div>
  ),
};

/**
 * User profile card with custom styling.
 * Demonstrates className prop for additional styling.
 */
export const WithCustomClass: Story = {
  decorators: [withMockAuthenticatedUser],
  args: {
    className: 'border-2 border-primary shadow-lg',
  },
};
