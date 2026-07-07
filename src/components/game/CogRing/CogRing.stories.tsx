import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import CogRing from './CogRing';

const meta: Meta<typeof CogRing> = {
  title: 'Features/Game/CogRing',
  component: CogRing,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Procedural cog ring (rim + 20 teeth + rivets) for the Three.js Game brand composition. Renders nothing outside a Canvas; this story exists for documentation.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {
  args: {},
  render: () => <CogRing />,
} as unknown as Story;
