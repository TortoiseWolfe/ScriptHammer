import type { Meta, StoryObj } from '@storybook/nextjs';
import ResetPasswordForm from './ResetPasswordForm';

const meta: Meta<typeof ResetPasswordForm> = {
  title: 'Components/Molecular/ResetPasswordForm',
  component: ResetPasswordForm,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'ResetPasswordForm component for the molecular category.',
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
    children: 'Default ResetPasswordForm content',
  },
};

export const WithCustomClass: Story = {
  args: {
    children: 'ResetPasswordForm with custom styling',
    className: 'p-4 bg-primary text-white rounded',
  },
};

export const Empty: Story = {
  args: {},
};
