import type { Meta, StoryObj } from '@storybook/nextjs';
import { CountdownBanner } from './CountdownBanner';

const meta: Meta<typeof CountdownBanner> = {
  title: 'Atomic Design/Atomic/CountdownBanner',
  component: CountdownBanner,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'CountdownBanner component for promotional countdown timers.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
