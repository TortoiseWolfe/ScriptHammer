import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Dice from './Dice';

const meta = {
  title: 'Components/Atomic/Dice',
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

export const ThemeShowcase: Story = {
  args: {
    sides: 6,
  },
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base-content mb-2 text-lg font-semibold">
          Dice Variants
        </h3>
        <div className="flex flex-wrap gap-4">
          <Dice sides={6} />
          <Dice sides={20} />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-base-content mb-2 text-lg font-semibold">
          On Surfaces
        </h3>
        <div className="bg-base-100 flex flex-wrap gap-4 rounded-lg p-4">
          <span className="text-base-content/80 text-sm">base-100:</span>
          <Dice sides={6} />
        </div>
        <div className="bg-base-200 flex flex-wrap gap-4 rounded-lg p-4">
          <span className="text-base-content/80 text-sm">base-200:</span>
          <Dice sides={6} />
        </div>
        <div className="bg-neutral flex flex-wrap gap-4 rounded-lg p-4">
          <span className="text-neutral-content/80 text-sm">neutral:</span>
          <Dice sides={6} />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};
