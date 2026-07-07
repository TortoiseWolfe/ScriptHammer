import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Sparkline from './Sparkline';

const meta: Meta<typeof Sparkline> = {
  title: 'Components/Molecular/Sparkline',
  component: Sparkline,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Single-series SVG sparkline. No axes, no labels — just the shape. Theme-reactive via literal var() tokens, zero deps.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    tone: {
      control: { type: 'select' },
      options: ['primary', 'success', 'error', 'info'],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-48">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: [3, 5, 2, 8, 4, 6, 7],
    tone: 'primary',
  },
};

export const Rising: Story = {
  args: {
    data: [1, 2, 3, 5, 8, 13, 21],
    tone: 'success',
  },
};

export const Falling: Story = {
  args: {
    data: [21, 13, 8, 5, 3, 2, 1],
    tone: 'error',
  },
};

export const AllZero: Story = {
  name: 'All zero (flat at bottom — not empty)',
  args: {
    data: [0, 0, 0, 0, 0, 0, 0],
    tone: 'info',
  },
};

export const Tones: Story = {
  render: () => (
    <div className="space-y-2">
      {(['primary', 'success', 'error', 'info'] as const).map((tone) => (
        <div key={tone} className="flex items-center gap-4">
          <span className="w-16 text-sm">{tone}</span>
          <div className="w-32">
            <Sparkline data={[3, 5, 2, 8, 4, 6, 7]} tone={tone} />
          </div>
        </div>
      ))}
    </div>
  ),
};

export const InStatCard: Story = {
  name: 'Embedded in stat card',
  render: () => (
    <div className="stats bg-base-100 shadow">
      <div className="stat">
        <div className="stat-title">Messages This Week</div>
        <div className="stat-value">847</div>
        <div className="mt-2 h-8">
          <Sparkline
            data={[110, 98, 134, 122, 101, 140, 142]}
            tone="info"
            label="Messages, last 7 days"
          />
        </div>
      </div>
    </div>
  ),
};
