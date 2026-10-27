import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import BandMemberCard from './BandMemberCard';
import { ROSTER } from '@/lib/band/roster';

const meta: Meta<typeof BandMemberCard> = {
  title: 'Components/Molecular/BandMemberCard',
  component: BandMemberCard,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'night',
      values: [{ name: 'night', value: '#14172b' }],
    },
    docs: {
      description: {
        component:
          'One member of ScriptHammer, the house band: portrait, name, instrument and role.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Ivory: Story = { args: { member: ROSTER[0] } };
export const Crash: Story = { args: { member: ROSTER[1] } };
export const Verse: Story = { args: { member: ROSTER[5] } };
