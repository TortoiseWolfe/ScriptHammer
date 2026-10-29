import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import BandSongs from './BandSongs';
import rankingFile from '../../../../public/data/band-ranking.json';
import type { BandRankingFile } from '@/lib/band/ranking';

const meta: Meta<typeof BandSongs> = {
  title: 'Components/Molecular/BandSongs',
  component: BandSongs,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'night',
      values: [{ name: 'night', value: '#14172b' }],
    },
    docs: {
      description: {
        component:
          'The ranked Songs list on /band: cover, public counts, links to the Short and the Twitch channel, anonymous up and down buttons, and a closed "How the score works" box.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Ranked: Story = {};

export const FirstThree: Story = {
  args: {
    ranking: {
      ...(rankingFile as BandRankingFile),
      songs: (rankingFile as BandRankingFile).songs.slice(0, 3),
    },
  },
};
