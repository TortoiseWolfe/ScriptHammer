import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Controls from './Controls';

const meta: Meta<typeof Controls> = {
  title: 'Features/Game/Controls',
  component: Controls,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'drei OrbitControls wrapper with FR-005 camera constraints (polar bounded, bounded zoom, 360° yaw). Auto-orbit gating lands in Phase 5 (T023).',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Controls renders nothing visible outside a Three.js scene; this entry
// exists for documentation only.
export const Default = {
  args: {},
  render: () => <Controls />,
} as unknown as Story;
