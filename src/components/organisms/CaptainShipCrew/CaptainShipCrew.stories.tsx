import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import CaptainShipCrew from './CaptainShipCrew';

const meta = {
  title: 'Components/Organisms/CaptainShipCrew',
  component: CaptainShipCrew,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    playerCount: {
      control: { type: 'number', min: 2, max: 8 },
      description: 'Number of players in the game',
    },
    gameMode: {
      control: { type: 'select' },
      options: ['single', 'target'],
      description: 'Game mode - single round or play to target score',
    },
    targetScore: {
      control: { type: 'number', min: 10, max: 200, step: 10 },
      description: 'Target score for multi-round games',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof CaptainShipCrew>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoPlayerSingle: Story = {
  args: {
    playerCount: 2,
    gameMode: 'single',
  },
};

export const FourPlayerSingle: Story = {
  args: {
    playerCount: 4,
    gameMode: 'single',
  },
};

export const TwoPlayerTarget50: Story = {
  args: {
    playerCount: 2,
    gameMode: 'target',
    targetScore: 50,
  },
};

export const FourPlayerTarget100: Story = {
  args: {
    playerCount: 4,
    gameMode: 'target',
    targetScore: 100,
  },
};

export const BarGame: Story = {
  args: {
    playerCount: 6,
    gameMode: 'single',
  },
};

export const Tournament: Story = {
  args: {
    playerCount: 8,
    gameMode: 'target',
    targetScore: 150,
  },
};

export const QuickGame: Story = {
  args: {
    playerCount: 3,
    gameMode: 'target',
    targetScore: 25,
  },
};

export const ThemeShowcase: Story = {
  args: {
    playerCount: 2,
    gameMode: 'single',
  },
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base-content mb-2 text-lg font-semibold">
          Game Modes
        </h3>
        <div className="flex flex-wrap gap-4">
          <CaptainShipCrew playerCount={2} gameMode="single" />
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
          <CaptainShipCrew playerCount={2} gameMode="single" />
        </div>
        <div className="bg-base-200 rounded-lg p-4">
          <span className="text-base-content/80 mb-2 block text-sm">
            base-200:
          </span>
          <CaptainShipCrew playerCount={2} gameMode="single" />
        </div>
        <div className="bg-neutral rounded-lg p-4">
          <span className="text-neutral-content/80 mb-2 block text-sm">
            neutral:
          </span>
          <CaptainShipCrew playerCount={2} gameMode="single" />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};
