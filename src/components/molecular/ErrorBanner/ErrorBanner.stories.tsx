import type { Meta, StoryObj } from '@storybook/react';
import ErrorBanner from './ErrorBanner';

const meta: Meta<typeof ErrorBanner> = {
  title: 'Components/Molecular/ErrorBanner',
  component: ErrorBanner,
  tags: ['autodocs'],
  argTypes: {
    onDismiss: { action: 'dismissed' },
  },
};

export default meta;
type Story = StoryObj<typeof ErrorBanner>;

export const Default: Story = {
  args: {
    message: 'An error occurred while loading data.',
  },
};

export const LongMessage: Story = {
  args: {
    message:
      'A critical error occurred while attempting to fetch user profile data from the server. Please check your network connection and try again. If the problem persists, contact support.',
  },
};
