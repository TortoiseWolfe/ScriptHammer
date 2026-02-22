import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ColorblindToggle } from './ColorblindToggle';

const meta = {
  title: 'Components/Molecular/ColorblindToggle',
  component: ColorblindToggle,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ColorblindToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithCustomClass: Story = {
  args: {
    className: 'custom-class',
  },
};

export const ThemeShowcase: Story = {
  args: {},
  render: () => (
    <div className="flex flex-col gap-3">
      <h3 className="text-base-content mb-2 text-lg font-semibold">
        On Surfaces
      </h3>
      <div className="bg-base-100 flex items-center gap-4 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-100:</span>
        <ColorblindToggle />
      </div>
      <div className="bg-base-200 flex items-center gap-4 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-200:</span>
        <ColorblindToggle />
      </div>
      <div className="bg-neutral flex items-center gap-4 rounded-lg p-4">
        <span className="text-neutral-content/80 text-sm">neutral:</span>
        <ColorblindToggle />
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};
