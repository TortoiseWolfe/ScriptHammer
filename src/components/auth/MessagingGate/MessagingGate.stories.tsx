import type { Meta, StoryObj } from '@storybook/nextjs';
import MessagingGate from './MessagingGate';

const meta: Meta<typeof MessagingGate> = {
  title: 'Auth/MessagingGate',
  component: MessagingGate,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MessagingGate>;

/**
 * Default story showing the blocked state for unverified users
 */
export const Blocked: Story = {
  args: {
    children: <div className="p-4">Protected messaging content</div>,
  },
  parameters: {
    mockAuth: {
      user: {
        id: 'test-user',
        email: 'unverified@example.com',
        email_confirmed_at: null,
      },
      isLoading: false,
    },
    mockOAuth: false,
  },
};

/**
 * Allowed state for verified email users
 */
export const Allowed: Story = {
  args: {
    children: (
      <div className="bg-base-200 flex h-96 items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Messaging Content</h2>
          <p className="text-base-content/70 mt-2">
            You have access to messaging features!
          </p>
        </div>
      </div>
    ),
  },
  parameters: {
    mockAuth: {
      user: {
        id: 'verified-user',
        email: 'verified@example.com',
        email_confirmed_at: '2025-01-01T00:00:00Z',
      },
      isLoading: false,
    },
    mockOAuth: false,
  },
};

/**
 * OAuth user bypasses email verification
 */
export const OAuthAllowed: Story = {
  args: {
    children: (
      <div className="bg-base-200 flex h-96 items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Messaging Content</h2>
          <p className="text-base-content/70 mt-2">
            OAuth users have immediate access!
          </p>
        </div>
      </div>
    ),
  },
  parameters: {
    mockAuth: {
      user: {
        id: 'oauth-user',
        email: 'oauth@example.com',
        email_confirmed_at: null,
        app_metadata: { provider: 'google' },
      },
      isLoading: false,
    },
    mockOAuth: true,
  },
};

/**
 * Loading state while checking auth
 */
export const Loading: Story = {
  args: {
    children: <div className="p-4">Protected messaging content</div>,
  },
  parameters: {
    mockAuth: {
      user: null,
      isLoading: true,
    },
  },
};
