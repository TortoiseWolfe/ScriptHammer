import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import SignUpForm from './SignUpForm';
import { AuthProvider } from '@/contexts/AuthContext';

const withAuthProvider = (Story: any) => (
  <AuthProvider>
    <Story />
  </AuthProvider>
);

const meta: Meta<typeof SignUpForm> = {
  title: 'Features/Authentication/SignUpForm',
  component: SignUpForm,
  decorators: [withAuthProvider],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'User registration form with email verification.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onSuccess: {
      action: 'sign-up-success',
    },
    className: {
      control: 'text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
