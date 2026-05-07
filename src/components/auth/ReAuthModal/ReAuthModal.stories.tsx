import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ReAuthModal } from './ReAuthModal';
import { withAuthProvider } from '../../../../.storybook/decorators';

const meta: Meta<typeof ReAuthModal> = {
  title: 'Features/Authentication/ReAuthModal',
  component: ReAuthModal,
  decorators: [withAuthProvider],
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Modal for re-authenticating the user to unlock (or, for OAuth users, **create**) the messaging password used to derive E2E encryption keys.

**Two modes**, decided automatically at open time by inspecting whether the current user has encryption keys in Supabase:

- **Unlock mode** — keys exist; user enters the messaging password to derive the in-memory CryptoKey. Default for both email and OAuth users with prior keys.
- **Setup mode** — OAuth user has no keys yet (Feature 013, FR-021). Shows password + confirm fields, an OAuth provider badge ("Signed in via Google" / "Signed in via GitHub"), and a "save this password — losing it means losing access to old encrypted messages" warning.

Email users with no keys are **redirected** to \`/messages/setup\` (full-page form) rather than seeing setup mode in this modal — the browser's password manager benefits from a real \`<form>\` context. The page route is preserved as a deep-link fallback for OAuth users too (FR-022).`,
      },
      story: {
        inline: false,
        height: '600px',
      },
    },
  },
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is visible',
    },
    onSuccess: {
      action: 'success',
      description: 'Callback when re-authentication succeeds',
    },
    onClose: {
      action: 'close',
      description: 'Callback when modal is closed without success',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ReAuthModal>;

export const Default: Story = {
  args: {
    isOpen: true,
    onSuccess: fn(),
    onClose: fn(),
  },
};

export const WithoutCloseButton: Story = {
  args: {
    isOpen: true,
    onSuccess: fn(),
    // No onClose - user must authenticate
  },
  parameters: {
    docs: {
      description: {
        story:
          'Modal without close option - user must authenticate to proceed.',
      },
    },
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    onSuccess: fn(),
    onClose: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Modal when closed (not visible).',
      },
    },
  },
};

export const WithCustomClass: Story = {
  args: {
    isOpen: true,
    onSuccess: fn(),
    onClose: fn(),
    className: 'border-2 border-primary',
  },
  parameters: {
    docs: {
      description: {
        story: 'Modal with custom CSS class applied.',
      },
    },
  },
};
