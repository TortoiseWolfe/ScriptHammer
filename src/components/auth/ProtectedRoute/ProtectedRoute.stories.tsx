import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import ProtectedRoute from './ProtectedRoute';
import { AuthProvider } from '@/contexts/AuthContext';

const withAuthProvider = (Story: any) => (
  <AuthProvider>
    <Story />
  </AuthProvider>
);

const meta: Meta<typeof ProtectedRoute> = {
  title: 'Features/Authentication/ProtectedRoute',
  component: ProtectedRoute,
  decorators: [withAuthProvider],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Route wrapper that requires authentication.',
      },
    },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/protected',
        query: {},
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    children: {
      control: 'text',
      description: 'Content to display when authenticated',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="card bg-base-100 p-8 shadow-xl">
        Protected content - requires authentication
      </div>
    ),
  },
};
