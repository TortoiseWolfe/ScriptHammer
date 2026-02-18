import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import SocialIcon from './SocialIcon';

const meta: Meta<typeof SocialIcon> = {
  title: 'Components/Atomic/SocialIcon',
  component: SocialIcon,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'SVG icon component for social media platforms.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    platform: {
      control: 'select',
      options: [
        'github',
        'twitter',
        'linkedin',
        'twitch',
        'youtube',
        'facebook',
        'instagram',
        'reddit',
        'mastodon',
        'bluesky',
        'threads',
        'website',
      ],
      description: 'Social platform to display icon for',
    },
    className: {
      control: 'text',
      description: 'CSS classes for sizing',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    platform: 'github',
  },
};

export const AllPlatforms: Story = {
  render: () => (
    <div className="flex gap-4">
      {(
        [
          'github',
          'twitter',
          'linkedin',
          'twitch',
          'youtube',
          'facebook',
          'instagram',
          'reddit',
          'mastodon',
          'bluesky',
          'threads',
          'website',
        ] as const
      ).map((platform) => (
        <div key={platform} className="flex flex-col items-center gap-1">
          <SocialIcon platform={platform} className="h-6 w-6" />
          <span className="text-xs">{platform}</span>
        </div>
      ))}
    </div>
  ),
};

export const LargeIcon: Story = {
  args: {
    platform: 'github',
    className: 'h-12 w-12',
  },
};
