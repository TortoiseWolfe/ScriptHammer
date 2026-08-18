import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import CodSkeleton from './CodSkeleton';

const meta = {
  title: 'Features/Game/CodSkeleton',
  component: CodSkeleton,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'First-person "walking skeleton" for the Claude-of-Duty extraction spike. R3F owns the render loop; the vendored CoD BVH + swept-capsule character controller run a fixed 120 Hz tick in useFrame and drive the camera. WASD + pointer-lock mouselook, collide-and-slide against a small procedural level (floor, a 0.40 m step-up, a wall, a crate) skinned with zero-asset procedural DataTexture surfaces. Falls back to FallbackPanel when WebGL is unavailable. **Every story opens on the start placeholder, not the scene** — mounting the canvas bakes 1K textures synchronously, which cost 22.6-30.2s on a GPU-less runner and timed the mobile-layout sweep out three times (#757), so it now waits to be asked. Press "Start the scene".',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes on the wrapper.',
    },
    speed: {
      control: { type: 'range', min: 1, max: 10, step: 0.5 },
      description: 'Walk speed in m/s. Default 4.5.',
    },
  },
} satisfies Meta<typeof CodSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const FastWalk: Story = {
  args: {
    speed: 8,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Higher walk speed — useful for exercising the continuous-collision sweep against the wall at speed.',
      },
    },
  },
};
