import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ThemeSongPlayer from './ThemeSongPlayer';
import { THEME_SONG, HOOK } from '@/lib/band/songs';

const meta: Meta<typeof ThemeSongPlayer> = {
  title: 'Components/Molecular/ThemeSongPlayer',
  component: ThemeSongPlayer,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'night',
      values: [{ name: 'night', value: '#14172b' }],
    },
    docs: {
      description: {
        component:
          'A native audio player with the lyrics in a closed details element. No autoplay.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Theme: Story = { args: { song: THEME_SONG } };
export const Hook: Story = { args: { song: HOOK } };
