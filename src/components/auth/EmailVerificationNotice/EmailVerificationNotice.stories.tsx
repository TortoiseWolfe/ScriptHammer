import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import EmailVerificationNotice from './EmailVerificationNotice';
import { AuthProvider } from '@/contexts/AuthContext';

const withAuthProvider = (Story: any) => (
  <AuthProvider>
    <Story />
  </AuthProvider>
);

const meta: Meta<typeof EmailVerificationNotice> = {
  title: 'Features/Authentication/EmailVerificationNotice',
  component: EmailVerificationNotice,
  decorators: [withAuthProvider],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Notice banner for users who need to verify their email address.',
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
