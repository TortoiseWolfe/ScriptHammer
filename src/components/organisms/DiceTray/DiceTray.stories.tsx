import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import DiceTray from './DiceTray';

const meta = {
  title: 'Components/Organisms/DiceTray',
  component: DiceTray,
  parameters: {
    layout: 'centered',
    a11y: {
      // Component-specific a11y configuration
      config: {
        rules: [
          {
            // Ensure proper button labeling for roll actions
            id: 'button-name',
            enabled: true,
          },
        ],
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    numberOfDice: {
      control: { type: 'number', min: 1, max: 10 },
      description: 'Number of dice in the tray',
    },
    sides: {
      control: { type: 'select' },
      options: [6, 20],
      description: 'Type of dice (D6 or D20)',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof DiceTray>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    numberOfDice: 5,
    sides: 6,
  },
};

export const ThreeD6: Story = {
  args: {
    numberOfDice: 3,
    sides: 6,
  },
};

export const FiveD20: Story = {
  args: {
    numberOfDice: 5,
    sides: 20,
  },
};

export const SingleDie: Story = {
  args: {
    numberOfDice: 1,
    sides: 6,
  },
};

export const MaxDice: Story = {
  args: {
    numberOfDice: 10,
    sides: 6,
  },
};

export const D20Campaign: Story = {
  args: {
    numberOfDice: 4,
    sides: 20,
  },
};

export const ThemeShowcase: Story = {
  args: {
    numberOfDice: 3,
    sides: 6,
  },
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base-content mb-2 text-lg font-semibold">
          Dice Tray Variants
        </h3>
        <div className="flex flex-wrap gap-4">
          <DiceTray numberOfDice={3} sides={6} />
          <DiceTray numberOfDice={2} sides={20} />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-base-content mb-2 text-lg font-semibold">
          On Surfaces
        </h3>
        <div className="bg-base-100 rounded-lg p-4">
          <span className="text-base-content/80 mb-2 block text-sm">
            base-100:
          </span>
          <DiceTray numberOfDice={3} sides={6} />
        </div>
        <div className="bg-base-200 rounded-lg p-4">
          <span className="text-base-content/80 mb-2 block text-sm">
            base-200:
          </span>
          <DiceTray numberOfDice={3} sides={6} />
        </div>
        <div className="bg-neutral rounded-lg p-4">
          <span className="text-neutral-content/80 mb-2 block text-sm">
            neutral:
          </span>
          <DiceTray numberOfDice={3} sides={6} />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};
