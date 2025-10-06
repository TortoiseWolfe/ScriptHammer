/**
 * SubscriptionManager Storybook Stories
 *
 * Mock data is provided via MSW handlers in src/mocks/handlers.ts
 */

import type { Meta, StoryObj } from '@storybook/nextjs';
import { SubscriptionManager } from './SubscriptionManager';

const meta: Meta<typeof SubscriptionManager> = {
  title: 'Features/Payment/SubscriptionManager',
  component: SubscriptionManager,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Manages user subscriptions with cancel/pause/resume actions. Mock data provided via MSW.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    userId: {
      control: 'text',
      description: 'User ID to manage subscriptions for',
    },
  },
};

export default meta;
type Story = StoryObj<typeof SubscriptionManager>;

/**
 * Default view with active subscriptions
 */
export const Default: Story = {
  args: {
    userId: 'demo-user-123',
  },
};

/**
 * With custom styling
 */
export const WithCustomClass: Story = {
  args: {
    userId: 'demo-user-123',
    className: 'p-8 bg-base-200',
  },
};
