import type { Meta, StoryObj } from '@storybook/nextjs';
import BlogPostViewer from './BlogPostViewer';

const meta: Meta<typeof BlogPostViewer> = {
  title: 'Components/Molecular/BlogPostViewer',
  component: BlogPostViewer,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'BlogPostViewer component for the molecular category.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithCustomClass: Story = {
  args: {
    className: 'p-4 bg-primary text-white rounded',
  },
};

export const Empty: Story = {
  args: {},
};
