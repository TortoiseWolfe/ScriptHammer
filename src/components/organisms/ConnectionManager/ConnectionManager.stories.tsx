import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ConnectionManager from './ConnectionManager';

const meta: Meta<typeof ConnectionManager> = {
  title: 'Components/Organisms/ConnectionManager',
  component: ConnectionManager,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const ThemeShowcase: Story = {
  args: {},
  render: () => (
    <div className="flex flex-col gap-3">
      <h3 className="text-base-content mb-2 text-lg font-semibold">
        On Surfaces
      </h3>
      <div className="bg-base-100 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-100:</span>
        <ConnectionManager />
      </div>
      <div className="bg-base-200 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-200:</span>
        <ConnectionManager />
      </div>
      <div className="bg-neutral rounded-lg p-4">
        <span className="text-neutral-content/80 text-sm">neutral:</span>
        <ConnectionManager />
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};
