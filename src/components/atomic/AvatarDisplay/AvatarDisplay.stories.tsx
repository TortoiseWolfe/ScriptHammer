import type { Meta, StoryObj } from '@storybook/nextjs';
import AvatarDisplay from './AvatarDisplay';

const meta: Meta<typeof AvatarDisplay> = {
  title: 'Components/Atomic/AvatarDisplay',
  component: AvatarDisplay,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Avatar display component with lazy loading and initials fallback. Shows user profile picture or generates initials from display name.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    avatarUrl: {
      control: 'text',
      description: 'Avatar image URL (null/undefined shows initials)',
    },
    displayName: {
      control: 'text',
      description: "User's display name (for initials fallback)",
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Size variant',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithImage: Story = {
  args: {
    avatarUrl: 'https://i.pravatar.cc/300',
    displayName: 'John Doe',
    size: 'md',
  },
};

export const WithInitials: Story = {
  args: {
    avatarUrl: null,
    displayName: 'Jane Smith',
    size: 'md',
  },
};

export const SizeSmall: Story = {
  args: {
    displayName: 'Sam Wilson',
    size: 'sm',
  },
};

export const SizeLarge: Story = {
  args: {
    displayName: 'Alex Johnson',
    size: 'lg',
  },
};

export const SizeExtraLarge: Story = {
  args: {
    displayName: 'Morgan Lee',
    size: 'xl',
  },
};
