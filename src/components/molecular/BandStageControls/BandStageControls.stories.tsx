import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import BandStageControls from './BandStageControls';

const meta: Meta<typeof BandStageControls> = {
  title: 'Components/Molecular/BandStageControls',
  component: BandStageControls,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        component:
          "Play and mute controls for the band stage at Ross's Landing in /chatt walk mode (feature 053).",
      },
    },
  },
  tags: ['autodocs'],
  args: { onPlayToggle: fn(), onMuteToggle: fn() },
  argTypes: {
    playing: { control: 'boolean' },
    muted: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Stopped: Story = { args: { playing: false, muted: false } };

export const Playing: Story = { args: { playing: true, muted: false } };

export const Muted: Story = { args: { playing: true, muted: true } };
