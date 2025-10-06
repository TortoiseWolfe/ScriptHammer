import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import SignInForm from './SignInForm';
import { AuthProvider } from '@/contexts/AuthContext';

// Mock AuthProvider decorator for Storybook
const withAuthProvider = (Story: any) => (
  <AuthProvider>
    <Story />
  </AuthProvider>
);

const meta: Meta<typeof SignInForm> = {
  title: 'Features/Authentication/SignInForm',
  component: SignInForm,
  decorators: [withAuthProvider],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Email/password sign-in form with rate limiting and validation.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onSuccess: {
      action: 'sign-in-success',
      description: 'Callback on successful sign in',
    },
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
    className: 'max-w-md',
  },
};
