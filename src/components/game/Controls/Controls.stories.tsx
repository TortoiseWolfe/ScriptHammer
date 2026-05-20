import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import Controls from './Controls';

function CanvasWrapper({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: 400, height: 300, background: 'oklch(22% 0.04 282)' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={1.5} />
        <mesh>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshStandardMaterial
            color="#8b5cf6"
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>
        {children}
      </Canvas>
    </div>
  );
}

const meta: Meta<typeof Controls> = {
  title: 'Features/Game/Controls',
  component: Controls,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          "drei OrbitControls wrapper with FR-005 camera constraints: polar angle bounded (no upside-down), 360° yaw, bounded zoom (min 2 / max 10 units), damping enabled. Accepts an `autoRotate` prop driven by the parent Scene's reduced-motion + idle-resume logic.",
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    autoRotate: {
      control: 'boolean',
      description:
        'When true, the camera auto-rotates around the target at a slow rate. Wired by parent Scene; gated on prefers-reduced-motion and 3-second idle window after user input.',
    },
  },
  decorators: [
    (StoryFn) => (
      <CanvasWrapper>
        <StoryFn />
      </CanvasWrapper>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Controls>;

export const Default: Story = {
  args: { autoRotate: false },
  parameters: {
    docs: {
      description: {
        story:
          'Manual orbit. Drag to rotate, scroll to zoom. Controls only render meaningfully inside a `<Canvas>`, so the meta decorator wraps every story in a minimal R3F scene with a placeholder mesh.',
      },
    },
  },
};

export const AutoRotateActive: Story = {
  args: { autoRotate: true },
  parameters: {
    docs: {
      description: {
        story:
          'Auto-rotation enabled. In production this state is gated on `!prefers-reduced-motion && !pausedFromInput` per FR-004 + FR-005.',
      },
    },
  },
};
