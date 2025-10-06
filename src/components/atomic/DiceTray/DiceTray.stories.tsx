import type { Meta, StoryObj } from '@storybook/nextjs';
import DiceTray from './DiceTray';

const meta = {
  title: 'Atomic Design/Atomic/DiceTray',
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
