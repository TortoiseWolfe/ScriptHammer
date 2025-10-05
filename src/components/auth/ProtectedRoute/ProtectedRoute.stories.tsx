import type { Meta, StoryObj } from '@storybook/nextjs';
import ProtectedRoute from './ProtectedRoute';

const meta: Meta<typeof ProtectedRoute> = {
  title: 'Components/Molecular/ProtectedRoute',
  component: ProtectedRoute,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'ProtectedRoute component for the molecular category.',
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
    children: 'Default ProtectedRoute content',
  },
};

export const WithChildren: Story = {
  args: {
    children: 'ProtectedRoute with children',
  },
};

export const Empty: Story = {
  args: {},
};
