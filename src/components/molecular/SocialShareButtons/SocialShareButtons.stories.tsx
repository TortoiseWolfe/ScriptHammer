import type { Meta, StoryObj } from '@storybook/nextjs-vite';
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
  title: 'Components/Molecular/SocialShareButtons',
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

export const ThemeShowcase: Story = {
  args: {
    shareOptions: mockShareOptions,
    showLabels: true,
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <h3 className="text-base-content mb-2 text-lg font-semibold">
        On Surfaces
      </h3>
      <div className="bg-base-100 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-100:</span>
        <SocialShareButtons {...args} />
      </div>
      <div className="bg-base-200 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-200:</span>
        <SocialShareButtons {...args} />
      </div>
      <div className="bg-neutral rounded-lg p-4">
        <span className="text-neutral-content/80 text-sm">neutral:</span>
        <SocialShareButtons {...args} />
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};
