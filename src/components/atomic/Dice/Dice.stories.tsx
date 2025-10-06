import type { Meta, StoryObj } from '@storybook/nextjs';
import Dice from './Dice';

const meta = {
  title: 'Atomic Design/Atomic/Dice',
  component: Dice,
  parameters: {
    layout: 'centered',
    a11y: {
      // Component-specific a11y configuration
      config: {
        rules: [
          {
            // Ensure color contrast for dice dots
            id: 'color-contrast',
            enabled: true,
          },
        ],
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    sides: {
      control: { type: 'select' },
      options: [6, 20],
      description: 'Number of sides on the dice',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof Dice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const D6: Story = {
  args: {
    sides: 6,
  },
};

export const D20: Story = {
  args: {
    sides: 20,
  },
};

export const WithCustomClass: Story = {
  args: {
    sides: 6,
    className: 'w-96',
  },
};
