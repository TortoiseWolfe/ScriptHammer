/**
 * SubscriptionManager Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/nextjs';
import { SubscriptionManager } from './SubscriptionManager';

const meta: Meta<typeof SubscriptionManager> = {
  title: 'Payment/SubscriptionManager',
  component: SubscriptionManager,
  parameters: {
    layout: 'fullscreen',
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

export const Default: Story = {
  args: {
    userId: 'demo-user-123',
  },
};

export const WithCustomClass: Story = {
  args: {
    userId: 'demo-user-123',
    className: 'p-8',
  },
};
