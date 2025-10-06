import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import AuthGuard from './AuthGuard';
import { AuthProvider } from '@/contexts/AuthContext';

const withAuthProvider = (Story: any) => (
  <AuthProvider>
    <Story />
  </AuthProvider>
);

const meta: Meta<typeof AuthGuard> = {
  title: 'Features/Authentication/AuthGuard',
  component: AuthGuard,
  decorators: [withAuthProvider],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Component wrapper that conditionally renders content based on authentication state.',
      },
    },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/test-page',
        query: {},
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    requireVerification: {
      control: 'boolean',
      description: 'Require email verification',
    },
    children: {
      description: 'Content to display when authenticated',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="card bg-base-100 p-8 shadow-xl">Guarded content</div>
    ),
  },
};
