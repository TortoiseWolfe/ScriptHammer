import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import DraggableDice from './DraggableDice';

const meta: Meta<typeof DraggableDice> = {
  title: 'Components/Atomic/DraggableDice',
  component: DraggableDice,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    sides: {
      control: { type: 'select' },
      options: [6, 20],
    },
    value: {
      control: { type: 'number', min: 1, max: 20 },
    },
    locked: {
      control: 'boolean',
    },
    isRolling: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: 'dice-1',
    sides: 6,
    value: 4,
  },
};

export const D20: Story = {
  args: {
    id: 'dice-2',
    sides: 20,
    value: 17,
  },
};

export const Locked: Story = {
  args: {
    id: 'dice-3',
    sides: 6,
    value: 6,
    locked: true,
  },
};

export const Rolling: Story = {
  args: {
    id: 'dice-4',
    sides: 6,
    value: 3,
    isRolling: true,
  },
};

export const NoValue: Story = {
  args: {
    id: 'dice-5',
    sides: 6,
    value: null,
  },
};

export const ThemeShowcase: Story = {
  args: {
    id: 'showcase',
    sides: 6,
    value: 1,
  },
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base-content mb-2 text-lg font-semibold">States</h3>
        <div className="flex flex-wrap gap-4">
          <DraggableDice id="s1" sides={6} value={3} />
          <DraggableDice id="s2" sides={6} value={6} locked />
          <DraggableDice id="s3" sides={20} value={17} />
          <DraggableDice id="s4" sides={20} value={20} locked />
          <DraggableDice id="s5" sides={6} value={null} />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-base-content mb-2 text-lg font-semibold">
          On Surfaces
        </h3>
        <div className="bg-base-100 flex flex-wrap gap-4 rounded-lg p-4">
          <span className="text-base-content/80 text-sm">base-100:</span>
          <DraggableDice id="b1" sides={6} value={4} />
          <DraggableDice id="b2" sides={6} value={2} locked />
        </div>
        <div className="bg-base-200 flex flex-wrap gap-4 rounded-lg p-4">
          <span className="text-base-content/80 text-sm">base-200:</span>
          <DraggableDice id="b3" sides={6} value={5} />
          <DraggableDice id="b4" sides={6} value={1} locked />
        </div>
        <div className="bg-neutral flex flex-wrap gap-4 rounded-lg p-4">
          <span className="text-neutral-content/80 text-sm">neutral:</span>
          <DraggableDice id="b5" sides={6} value={3} />
          <DraggableDice id="b6" sides={6} value={6} locked />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};
