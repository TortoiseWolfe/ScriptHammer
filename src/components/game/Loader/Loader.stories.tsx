import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Loader from './Loader';

const meta: Meta<typeof Loader> = {
  title: 'Features/Game/Loader',
  component: Loader,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Suspense fallback for the Three.js scene dynamic import. Shows a DaisyUI spinner + "Loading 3D scene..." text.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {
  args: {},
  render: () => <Loader />,
} as unknown as Story;
