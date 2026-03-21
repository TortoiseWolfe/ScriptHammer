import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import MessagesSidebar from './MessagesSidebar';
import { withAuthProvider } from '../../../../.storybook/decorators';

const meta: Meta<typeof MessagesSidebar> = {
  title: 'Components/Organisms/MessagesSidebar',
  component: MessagesSidebar,
  decorators: [
    withAuthProvider,
    (Story) => (
      <div className="border-base-300 h-[600px] border">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Tab-stateful wrapper around UnifiedSidebar. Owns activeTab + URL ?tab= sync, per-tab scroll preservation, badge counts, and getOrCreateConversation wiring. Extracted from the messages page to reduce page line-count.',
      },
    },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/messages',
        query: {},
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    selectedConversationId: {
      control: 'text',
      description: 'Currently active conversation (highlighted in list)',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
  args: {
    onConversationSelect: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    selectedConversationId: null,
  },
};

export const WithSelectedConversation: Story = {
  args: {
    selectedConversationId: 'conv-123',
  },
};

export const ConnectionsTabViaURL: Story = {
  args: {
    selectedConversationId: null,
  },
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/messages',
        query: { tab: 'connections' },
      },
    },
    docs: {
      description: {
        story:
          'Initial tab is read from ?tab= query param. This story mounts with ?tab=connections.',
      },
    },
  },
};
