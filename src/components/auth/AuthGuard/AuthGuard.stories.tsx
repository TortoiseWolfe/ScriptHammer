import type { Meta, StoryObj } from '@storybook/nextjs';
import AuthGuard from './AuthGuard';

const meta: Meta<typeof AuthGuard> = {
  title: 'Components/Molecular/AuthGuard',
  component: AuthGuard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'AuthGuard component for the molecular category.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    children: {
      control: 'text',
      description: 'Content to display inside the component',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Default AuthGuard content',
  },
};

export const WithChildren: Story = {
  args: {
    children: 'AuthGuard with children',
  },
};

export const Empty: Story = {
  args: {},
};
