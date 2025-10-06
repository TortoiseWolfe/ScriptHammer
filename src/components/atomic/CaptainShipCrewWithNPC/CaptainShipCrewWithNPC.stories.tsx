import type { Meta, StoryObj } from '@storybook/nextjs';
import CaptainShipCrewWithNPC from './CaptainShipCrewWithNPC';

const meta = {
  title: 'Atomic Design/Atomic/CaptainShipCrewWithNPC',
  component: CaptainShipCrewWithNPC,
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
} satisfies Meta<typeof CaptainShipCrewWithNPC>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HumanVsNPC: Story = {
  args: {
    playerCount: 2,
    gameMode: 'single',
  },
};

export const HumanVsThreeNPCs: Story = {
  args: {
    playerCount: 4,
    gameMode: 'target',
    targetScore: 50,
  },
};

export const AllNPCs: Story = {
  args: {
    playerCount: 4,
    gameMode: 'single',
  },
};

export const TournamentWithNPCs: Story = {
  args: {
    playerCount: 6,
    gameMode: 'target',
    targetScore: 100,
  },
};

export const QuickMatch: Story = {
  args: {
    playerCount: 2,
    gameMode: 'target',
    targetScore: 25,
  },
};

export const MaxPlayersWithNPCs: Story = {
  args: {
    playerCount: 8,
    gameMode: 'single',
  },
};
