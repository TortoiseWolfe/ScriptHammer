import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Loader from './Loader';

const meta = {
  title: 'Features/Game/Loader',
  component: Loader,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Suspense fallback for the Three.js scene dynamic import. Shows a DaisyUI spinner with `role="status"` and accessible label "Loading 3D scene...". Used while the ~600 KB R3F bundle downloads.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes.',
    },
  },
} satisfies Meta<typeof Loader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const Constrained: Story = {
  args: {
    className: 'h-32 w-64 border border-base-300',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Loader rendered inside a fixed-size container — useful to verify the spinner centers correctly in any aspect-video wrapper.',
      },
    },
  },
};
