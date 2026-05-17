import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Scene from './Scene';

const meta: Meta<typeof Scene> = {
  title: 'Features/Game/Scene',
  component: Scene,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Root R3F Canvas for the /game/3d route. Placeholder cube; full brand-asset sculpt lands in Phase 9 (T039+).',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Components with all-optional props produce `Args = never` in Storybook 10's
// inferred type. We cast to `Story` then use `args: {}` as the required
// satisfaction. The runtime behavior is identical.
export const Default = {
  args: {},
  render: () => <Scene />,
} as unknown as Story;
