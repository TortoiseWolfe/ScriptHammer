import type { Meta, StoryObj } from '@storybook/nextjs';
import CaptainShipCrew from './CaptainShipCrew';

const meta = {
  title: 'Atomic Design/Atomic/CaptainShipCrew',
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
