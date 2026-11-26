import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import BandSchedule from './BandSchedule';

const meta: Meta<typeof BandSchedule> = {
  title: 'Components/Molecular/BandSchedule',
  component: BandSchedule,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'night',
      values: [{ name: 'night', value: '#14172b' }],
    },
    docs: {
      description: {
        component:
          'The Twitch channel’s weekly grid in Eastern time: the daily rows and the Thursday live-set evening.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
