import type { Meta, StoryObj } from '@storybook/nextjs';
import ForgotPasswordForm from './ForgotPasswordForm';

const meta: Meta<typeof ForgotPasswordForm> = {
  title: 'Components/Molecular/ForgotPasswordForm',
  component: ForgotPasswordForm,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'ForgotPasswordForm component for the molecular category.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    children: {
      control: 'text',
      description: 'Content to display inside the component',
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
  args: {
    children: 'Default ForgotPasswordForm content',
  },
};

export const WithCustomClass: Story = {
  args: {
    children: 'ForgotPasswordForm with custom styling',
    className: 'p-4 bg-primary text-white rounded',
  },
};

export const Empty: Story = {
  args: {},
};
