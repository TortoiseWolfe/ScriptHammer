import type { Meta, StoryObj } from '@storybook/nextjs';
import ForgotPasswordForm from './ForgotPasswordForm';

const meta: Meta<typeof ForgotPasswordForm> = {
  title: 'Features/Authentication/ForgotPasswordForm',
  component: ForgotPasswordForm,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Password reset form for forgotten passwords.',
      },
    },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/forgot-password',
        query: {},
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
