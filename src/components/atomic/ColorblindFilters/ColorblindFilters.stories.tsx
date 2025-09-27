import type { Meta, StoryObj } from '@storybook/nextjs';
import { ColorblindFilters } from './ColorblindFilters';

const meta = {
  title: 'Atomic/ColorblindFilters',
  component: ColorblindFilters,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ColorblindFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithCustomClass: Story = {
  args: {
    className: 'custom-class',
  },
};
