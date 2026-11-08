import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import BandJingles from './BandJingles';

const meta: Meta<typeof BandJingles> = {
  title: 'Components/Molecular/BandJingles',
  component: BandJingles,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'night',
      values: [{ name: 'night', value: '#14172b' }],
    },
    docs: {
      description: {
        component:
          'The client jingle sample: what a jingle is, the client credit, and both approved takes with a player and a download link.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const BothTakes: Story = {};
