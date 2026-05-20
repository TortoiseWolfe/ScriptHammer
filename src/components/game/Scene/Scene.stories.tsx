import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Scene from './Scene';

const meta = {
  title: 'Features/Game/Scene',
  component: Scene,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Root R3F Canvas for the /game/3d route. Renders the procedural ScriptHammer brand sculpt (CogRing + ScriptTags + PrintingMallet). Theme-reactive via DaisyUI CSS custom properties. Respects prefers-reduced-motion. Auto-falls-back to FallbackPanel when WebGL is unavailable.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes on the wrapper.',
    },
    idleResumeMs: {
      control: { type: 'range', min: 1000, max: 10000, step: 500 },
      description:
        'Idle window in milliseconds before auto-rotate resumes after user input. Default 3000.',
    },
  },
} satisfies Meta<typeof Scene>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const FastIdleResume: Story = {
  args: {
    idleResumeMs: 1000,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Auto-orbit resumes 1 second after the last user input, instead of the 3-second default. Useful for demonstrating the orbit gating behavior.',
      },
    },
  },
};

export const SlowIdleResume: Story = {
  args: {
    idleResumeMs: 8000,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Auto-orbit waits 8 seconds before resuming — useful when demonstrating long manual inspection of the model.',
      },
    },
  },
};
