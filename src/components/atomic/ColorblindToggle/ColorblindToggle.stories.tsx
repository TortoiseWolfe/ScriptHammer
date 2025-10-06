import type { Meta, StoryObj } from '@storybook/nextjs';
import { ColorblindToggle } from './ColorblindToggle';

const meta = {
  title: 'Layout/Theme/ColorblindToggle',
  component: ColorblindToggle,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ColorblindToggle>;

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
