import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import BandGauges, { BandGaugeDefs } from './BandGauges';

const meta: Meta<typeof BandGauges> = {
  title: 'Components/Molecular/BandGauges',
  component: BandGauges,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'night',
      values: [{ name: 'night', value: '#2b1f19' }],
    },
    docs: {
      description: {
        component:
          'The two brass dials on each ranked song of /band: SCORE (-15 to +15) and plays a day. Every number is also text.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <BandGaugeDefs />
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Leading: Story = {
  args: { score: 6, perDay: 15, maxPerDay: 15, net: 2 },
};

export const NoVotesYet: Story = {
  args: { score: 0, perDay: 2, maxPerDay: 15, net: 0 },
};

export const Disliked: Story = {
  args: { score: -9, perDay: 4.5, maxPerDay: 15, net: -3 },
};

export const OffTheScale: Story = {
  args: { score: 40, perDay: 8, maxPerDay: 15, net: 12 },
};
