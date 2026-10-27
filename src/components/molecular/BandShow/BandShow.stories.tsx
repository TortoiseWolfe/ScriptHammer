import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import BandShow from './BandShow';

const meta: Meta<typeof BandShow> = {
  title: 'Components/Molecular/BandShow',
  component: BandShow,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'night',
      values: [{ name: 'night', value: '#14172b' }],
    },
    docs: {
      description: {
        component:
          'The Band Wagon show block: both nights, the channel, a calendar file and city times.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const BeforeTheShow: Story = {
  args: { now: Date.parse('2026-10-27T12:00:00Z') },
};

export const LiveNight: Story = {
  args: { now: Date.parse('2026-10-29T22:30:00Z') },
};

export const AfterTheReplay: Story = {
  args: { now: Date.parse('2026-11-02T12:00:00Z') },
};
