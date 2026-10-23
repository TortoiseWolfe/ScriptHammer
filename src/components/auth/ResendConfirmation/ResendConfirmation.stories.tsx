import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import React from 'react';
import ResendConfirmation from './ResendConfirmation';
import { AuthProvider } from '@/contexts/AuthContext';

const withAuthProvider = (Story: any) => (
  <AuthProvider>
    <Story />
  </AuthProvider>
);

const meta: Meta<typeof ResendConfirmation> = {
  title: 'Features/Authentication/ResendConfirmation',
  component: ResendConfirmation,
  decorators: [withAuthProvider],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Asks for a new confirmation email with no session, for someone whose emailed link expired or never arrived. Renders nothing once signed in.',
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
