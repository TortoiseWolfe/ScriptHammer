import type { Meta, StoryObj } from '@storybook/nextjs';
import UserProfileCard from './UserProfileCard';

const meta: Meta<typeof UserProfileCard> = {
  title: 'Components/Molecular/UserProfileCard',
  component: UserProfileCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'UserProfileCard component for the molecular category.',
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
    children: 'Default UserProfileCard content',
  },
};

export const WithCustomClass: Story = {
  args: {
    children: 'UserProfileCard with custom styling',
    className: 'p-4 bg-primary text-white rounded',
  },
};

export const Empty: Story = {
  args: {},
};
