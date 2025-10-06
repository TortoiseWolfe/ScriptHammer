import type { Meta, StoryObj } from '@storybook/nextjs';
import DraggableDice from './DraggableDice';

const meta: Meta<typeof DraggableDice> = {
  title: 'Atomic Design/Atomic/DraggableDice',
  component: DraggableDice,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
