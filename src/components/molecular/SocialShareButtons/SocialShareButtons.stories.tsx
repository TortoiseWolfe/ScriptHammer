import type { Meta, StoryObj } from '@storybook/nextjs';
import SocialShareButtons from './SocialShareButtons';
import type { ShareOptions } from '@/types/social';

const mockShareOptions: ShareOptions = {
  title: 'Check out this amazing article!',
  url: 'https://example.com/blog/amazing-article',
  text: 'I just read this great article about web development and thought you might find it interesting.',
  hashtags: ['webdev', 'javascript', 'react'],
  via: 'scripthammer',
};

const meta: Meta<typeof SocialShareButtons> = {
  title: 'Features/Blog/SocialShareButtons',
  component: SocialShareButtons,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Social media share buttons with multiple platform support.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    platforms: {
      control: 'multi-select',
      options: [
        'twitter',
        'linkedin',
        'facebook',
        'reddit',
        'email',
        'copy-link',
      ],
      description: 'Platforms to display',
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
      description: 'Button size',
    },
    showLabels: {
      control: 'boolean',
      description: 'Show platform labels',
    },
    onShare: {
      action: 'shared',
      description: 'Share event handler',
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
    shareOptions: mockShareOptions,
    size: 'md',
    showLabels: false,
  },
};

export const WithLabels: Story = {
  args: {
    shareOptions: mockShareOptions,
    size: 'md',
    showLabels: true,
  },
};

export const SmallSize: Story = {
  args: {
    shareOptions: mockShareOptions,
    size: 'sm',
    showLabels: false,
  },
};

export const LargeWithLabels: Story = {
  args: {
    shareOptions: mockShareOptions,
    size: 'lg',
    showLabels: true,
  },
};

export const CustomPlatforms: Story = {
  args: {
    shareOptions: mockShareOptions,
    platforms: ['twitter', 'linkedin', 'email'],
    size: 'md',
    showLabels: true,
  },
};
