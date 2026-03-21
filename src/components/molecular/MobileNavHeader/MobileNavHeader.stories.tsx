import type { Meta, StoryObj } from '@storybook/react';
import MobileNavHeader from './MobileNavHeader';

const meta: Meta<typeof MobileNavHeader> = {
  title: 'Components/Molecular/MobileNavHeader',
  component: MobileNavHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof MobileNavHeader>;

export const Default: Story = {
  args: {
    title: 'Messages',
  },
};

export const WithConversation: Story = {
  args: {
    title: 'Alice',
  },
};
