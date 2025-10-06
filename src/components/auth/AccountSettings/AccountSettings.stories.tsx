import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import AccountSettings from './AccountSettings';
import { AuthProvider } from '@/contexts/AuthContext';

// Mock AuthProvider decorator for Storybook
const withAuthProvider = (Story: any) => (
  <AuthProvider>
    <Story />
  </AuthProvider>
);

const meta: Meta<typeof AccountSettings> = {
  title: 'Features/Authentication/AccountSettings',
  component: AccountSettings,
  decorators: [withAuthProvider],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Account settings management for authenticated users.',
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

export const Default: Story = {
  args: {},
};

export const WithCustomClass: Story = {
  args: {
    className: 'max-w-2xl',
  },
};
