import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import BandRoster from './BandRoster';
import { ROSTER } from '@/lib/band/roster';

const meta: Meta<typeof BandRoster> = {
  title: 'Components/Molecular/BandRoster',
  component: BandRoster,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'night',
      values: [{ name: 'night', value: '#14172b' }],
    },
    docs: {
      description: {
        component: 'The whole band as a grid of member cards.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WholeBand: Story = {};
export const TheRhythmSection: Story = {
  args: { members: ROSTER.filter((m) => ['crash', 'chops'].includes(m.slug)) },
};
