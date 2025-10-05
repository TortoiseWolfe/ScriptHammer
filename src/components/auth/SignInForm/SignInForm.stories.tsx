import type { Meta, StoryObj } from '@storybook/nextjs';
import SignInForm from './SignInForm';

const meta: Meta<typeof SignInForm> = {
  title: 'Components/Molecular/SignInForm',
  component: SignInForm,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'SignInForm component for the molecular category.',
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
    children: 'Default SignInForm content',
  },
};

export const WithCustomClass: Story = {
  args: {
    children: 'SignInForm with custom styling',
    className: 'p-4 bg-primary text-white rounded',
  },
};

export const Empty: Story = {
  args: {},
};
