import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import FallbackPanel from './FallbackPanel';

const meta: Meta<typeof FallbackPanel> = {
  title: 'Features/Game/FallbackPanel',
  component: FallbackPanel,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Fallback UI rendered when WebGL is unavailable or the GPU context is lost. Phase 8 (T035) adds the themed silhouette.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {
  args: {},
  render: () => <FallbackPanel />,
} as unknown as Story;
