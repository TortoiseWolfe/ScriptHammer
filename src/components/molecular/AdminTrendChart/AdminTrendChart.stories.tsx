import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AdminTrendChart } from './AdminTrendChart';

const meta: Meta<typeof AdminTrendChart> = {
  title: 'Components/Molecular/AdminTrendChart',
  component: AdminTrendChart,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Inline-SVG line chart coloured with Tailwind `stroke-*`/`fill-*` utilities bound to DaisyUI tokens. Flip the theme in the Storybook toolbar — the chart repaints with no re-render because colour comes from CSS custom properties, not props.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    colorToken: {
      control: 'select',
      options: [
        'primary',
        'secondary',
        'accent',
        'info',
        'success',
        'warning',
        'error',
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const sample = [
  { label: 'Mar 1', value: 12 },
  { label: 'Mar 2', value: 28 },
  { label: 'Mar 3', value: 19 },
  { label: 'Mar 4', value: 45 },
  { label: 'Mar 5', value: 33 },
  { label: 'Mar 6', value: 52 },
  { label: 'Mar 7', value: 41 },
];

export const Default: Story = {
  args: {
    data: sample,
    title: 'Daily transactions',
    colorToken: 'primary',
  },
};

export const RefundRate: Story = {
  args: {
    data: [
      { label: 'Mon', value: 2.1 },
      { label: 'Tue', value: 3.4 },
      { label: 'Wed', value: 1.8 },
      { label: 'Thu', value: 4.2 },
      { label: 'Fri', value: 2.9 },
    ],
    title: 'Refund rate',
    colorToken: 'error',
    yFormat: (v) => `${v.toFixed(1)}%`,
  },
};

export const Revenue: Story = {
  args: {
    data: sample.map((d) => ({ ...d, value: d.value * 137 })),
    title: 'Revenue',
    colorToken: 'success',
    yFormat: (v) => `$${Math.round(v)}`,
  },
};

export const Empty: Story = {
  args: {
    data: [],
    title: 'Nothing yet',
  },
};

export const SinglePoint: Story = {
  args: {
    data: [{ label: 'Only', value: 42 }],
    title: 'Single datum',
  },
  parameters: {
    docs: {
      description: {
        story: 'Renders the point marker but no line (a line needs ≥2 points).',
      },
    },
  },
};

export const FlatSeries: Story = {
  args: {
    data: [
      { label: 'A', value: 5 },
      { label: 'B', value: 5 },
      { label: 'C', value: 5 },
      { label: 'D', value: 5 },
    ],
    title: 'Flat series',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Domain is padded by ±1 so the flat line sits mid-plot instead of dividing by zero.',
      },
    },
  },
};

export const DualLine: Story = {
  args: {
    title: 'Message volume',
    series: [
      {
        name: 'Messages',
        colorToken: 'primary',
        data: sample,
      },
      {
        name: 'New conversations',
        colorToken: 'secondary',
        // Deliberately an order of magnitude smaller — shared y-axis, so
        // this line hugs the floor. Flip themes to see both lines re-colour.
        data: sample.map((d, i) => ({ ...d, value: (i % 3) + 1 })),
      },
    ],
    yFormat: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two series on a shared y-domain. Area fill is suppressed (overlapping opacities get muddy); a legend appears instead. Both lines use `stroke-{token}` utilities, so a theme switch repaints them together.',
      },
    },
  },
};

export const AllTokens: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {(
        [
          'primary',
          'secondary',
          'accent',
          'info',
          'success',
          'warning',
          'error',
        ] as const
      ).map((token) => (
        <AdminTrendChart
          key={token}
          data={sample}
          title={token}
          colorToken={token}
        />
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'All seven DaisyUI semantic tokens side-by-side. Switch themes in the toolbar to see them all re-colour at once.',
      },
    },
  },
};
