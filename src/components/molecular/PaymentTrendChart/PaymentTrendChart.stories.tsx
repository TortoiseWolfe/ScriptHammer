import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import PaymentTrendChart from './PaymentTrendChart';
import type { DailyPaymentPoint } from '@/services/admin/admin-payment-service';

const week: DailyPaymentPoint[] = [
  { day: '2026-02-26', succeeded: 6, failed: 0, revenue_cents: 18_000 },
  { day: '2026-02-27', succeeded: 5, failed: 1, revenue_cents: 15_000 },
  { day: '2026-02-28', succeeded: 8, failed: 0, revenue_cents: 22_000 },
  { day: '2026-03-01', succeeded: 3, failed: 2, revenue_cents: 9_000 },
  { day: '2026-03-02', succeeded: 9, failed: 0, revenue_cents: 27_000 },
  { day: '2026-03-03', succeeded: 7, failed: 1, revenue_cents: 19_000 },
  { day: '2026-03-04', succeeded: 4, failed: 0, revenue_cents: 12_000 },
];

// 30 days — enough to see the line smooth out without the fixture getting noisy
const month: DailyPaymentPoint[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 1, 4 + i));
  return {
    day: date.toISOString().slice(0, 10),
    succeeded: 5 + Math.round(4 * Math.sin(i / 3)),
    failed: i % 5 === 0 ? 2 : 0,
    revenue_cents: 0,
  };
});

const failureSpike: DailyPaymentPoint[] = week.map((d, i) =>
  i === 4 ? { ...d, succeeded: 1, failed: 12 } : d
);

const meta: Meta<typeof PaymentTrendChart> = {
  title: 'Components/Molecular/PaymentTrendChart',
  component: PaymentTrendChart,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Two-line SVG trend over daily_series. Stroke colors are raw `var(--color-success)` / `var(--color-error)` — switch the theme in the toolbar and the lines recolor with zero JS. Gridlines use `var(--color-base-300)`. Axis labels use `currentColor` so they inherit `text-base-content`.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Week: Story = {
  args: { data: week },
};

export const Month: Story = {
  args: { data: month },
};

export const FailureSpike: Story = {
  name: 'Failure spike (the Monday-morning view)',
  args: { data: failureSpike },
};

export const AllZero: Story = {
  args: {
    data: [
      { day: '2026-03-01', succeeded: 0, failed: 0, revenue_cents: 0 },
      { day: '2026-03-02', succeeded: 0, failed: 0, revenue_cents: 0 },
      { day: '2026-03-03', succeeded: 0, failed: 0, revenue_cents: 0 },
    ],
  },
};

export const Empty: Story = {
  args: { data: [] },
};
