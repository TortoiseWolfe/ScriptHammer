import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ScriptTags from './ScriptTags';

const meta: Meta<typeof ScriptTags> = {
  title: 'Features/Game/ScriptTags',
  component: ScriptTags,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Procedural < > code brackets for the Three.js Game brand composition. Metallic gold with a slight emissive glow. Renders nothing outside a Canvas.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {
  args: {},
  render: () => <ScriptTags />,
} as unknown as Story;
