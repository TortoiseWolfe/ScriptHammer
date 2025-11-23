import type { Meta, StoryObj } from '@storybook/nextjs';
import TypingIndicator from './TypingIndicator';

/**
 * Storybook Stories for TypingIndicator
 * Task: T125
 *
 * Displays typing indicator component in various states.
 */

const meta: Meta<typeof TypingIndicator> = {
  title: 'Messaging/TypingIndicator',
  component: TypingIndicator,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
TypingIndicator displays an animated typing indicator with dots.
Used to show when another user is typing in a conversation.

Features:
- Animated bouncing dots
- "[User] is typing..." text
- ARIA live region for screen readers
- Show/hide control
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    userName: {
      control: 'text',
      description: 'Display name of user who is typing',
    },
    show: {
      control: 'boolean',
      description: 'Whether to show the indicator',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default typing indicator showing "User is typing..."
 */
export const Default: Story = {
  args: {
    userName: 'User',
    show: true,
  },
};

/**
 * Typing indicator with specific user name
 */
export const WithUserName: Story = {
  args: {
    userName: 'Alice',
    show: true,
  },
};

/**
 * Hidden state (show=false)
 */
export const Hidden: Story = {
  args: {
    userName: 'User',
    show: false,
  },
};

/**
 * Long user name
 */
export const LongUserName: Story = {
  args: {
    userName: 'Christopher Alexander Thompson',
    show: true,
  },
};

/**
 * With custom styling
 */
export const CustomStyling: Story = {
  args: {
    userName: 'User',
    show: true,
    className: 'bg-base-200 rounded-lg',
  },
};
