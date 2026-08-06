import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import ProceduralSky from './ProceduralSky';

// ProceduralSky only renders meaningfully inside a <Canvas>. The decorator wraps
// every story in a minimal R3F scene with a chrome sphere so the baked sky IBL
// shows up as reflections (proving scene.environment was set).
function CanvasWrapper({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: 400, height: 300 }}>
      <Canvas camera={{ position: [0, 1, 4], fov: 55 }}>
        <mesh>
          <sphereGeometry args={[1.2, 48, 32]} />
          <meshStandardMaterial color="#c8c8c8" metalness={1} roughness={0.15} />
        </mesh>
        {children}
      </Canvas>
    </div>
  );
}

const meta: Meta<typeof ProceduralSky> = {
  title: 'Features/Game/ProceduralSky',
  component: ProceduralSky,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Harvested Claude-of-Duty procedural sky. As a child of an R3F <Canvas>, it bakes an atmospheric sky dome (drawn as the background) and an IBL environment map (assigned to scene.environment) at mount — zero assets, no HDRI — so MeshStandardMaterials gain real specular/reflections. Static (fixed hour); the component itself renders null.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    hour: {
      control: { type: 'range', min: 0, max: 24, step: 0.5 },
      description: 'Time of day (0–24) for the static sky bake. Default 16.5.',
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
type Story = StoryObj<typeof ProceduralSky>;

export const Default: Story = { args: { hour: 16.5 } };

export const Morning: Story = {
  args: { hour: 8 },
  parameters: {
    docs: {
      description: {
        story: 'Lower sun angle — the IBL on the chrome sphere shifts warmer/lower.',
      },
    },
  },
};
