import type { Meta, StoryObj } from '@storybook/nextjs';
import OAuthButtons from './OAuthButtons';

const meta: Meta<typeof OAuthButtons> = {
  title: 'Components/Molecular/OAuthButtons',
  component: OAuthButtons,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'OAuthButtons component for the molecular category.',
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
    children: 'Default OAuthButtons content',
  },
};

export const WithCustomClass: Story = {
  args: {
    children: 'OAuthButtons with custom styling',
    className: 'p-4 bg-primary text-white rounded',
  },
};

export const Empty: Story = {
  args: {},
};
