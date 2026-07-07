import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AdminStatCard } from './AdminStatCard';

const meta: Meta<typeof AdminStatCard> = {
  title: 'Components/Molecular/AdminStatCard',
  component: AdminStatCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Displays a single statistic with optional trend indicator and link.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text', description: 'Stat label' },
    value: { control: 'text', description: 'Stat value' },
    description: { control: 'text', description: 'Optional description' },
    trend: {
      control: 'select',
      options: ['up', 'down', 'neutral', undefined],
      description: 'Trend direction',
    },
    href: { control: 'text', description: 'Optional link href' },
    className: { control: 'text', description: 'Additional CSS classes' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Total Users',
    value: 1284,
  },
};

export const WithTrendUp: Story = {
  args: {
    label: 'Active Users',
    value: 892,
    description: '+12% from last month',
    trend: 'up',
  },
};

export const WithTrendDown: Story = {
  args: {
    label: 'Error Rate',
    value: '2.4%',
    description: '-0.3% from last week',
    trend: 'down',
  },
};

export const AsLink: Story = {
  args: {
    label: 'Total Posts',
    value: 347,
    description: 'View all posts',
    href: '/admin/posts',
  },
};

export const ThemeShowcase: Story = {
  args: {
    label: 'Total Users',
    value: 1284,
    description: '+12% from last month',
    trend: 'up',
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <h3 className="text-base-content mb-2 text-lg font-semibold">
        On Surfaces
      </h3>
      <div className="bg-base-100 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-100:</span>
        <AdminStatCard {...args} />
      </div>
      <div className="bg-base-200 rounded-lg p-4">
        <span className="text-base-content/80 text-sm">base-200:</span>
        <AdminStatCard {...args} />
      </div>
      <div className="bg-neutral rounded-lg p-4">
        <span className="text-neutral-content/80 text-sm">neutral:</span>
        <AdminStatCard {...args} />
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};
