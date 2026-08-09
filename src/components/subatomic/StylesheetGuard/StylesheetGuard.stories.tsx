import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import StylesheetGuard from './StylesheetGuard';

const meta: Meta<typeof StylesheetGuard> = {
  title: 'Components/Subatomic/StylesheetGuard',
  component: StylesheetGuard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'StylesheetGuard component for the subatomic category.',
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
