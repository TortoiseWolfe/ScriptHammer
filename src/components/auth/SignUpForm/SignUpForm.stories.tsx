import type { Meta, StoryObj } from '@storybook/nextjs';
import SignUpForm from './SignUpForm';

const meta: Meta<typeof SignUpForm> = {
  title: 'Components/Molecular/SignUpForm',
  component: SignUpForm,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'SignUpForm component for the molecular category.',
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
    children: 'Default SignUpForm content',
  },
};

export const WithCustomClass: Story = {
  args: {
    children: 'SignUpForm with custom styling',
    className: 'p-4 bg-primary text-white rounded',
  },
};

export const Empty: Story = {
  args: {},
};
