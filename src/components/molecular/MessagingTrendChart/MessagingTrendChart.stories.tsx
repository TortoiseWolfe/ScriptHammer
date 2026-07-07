import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import MessagingTrendChart from './MessagingTrendChart';
import type { DailyMessagingPoint } from '@/services/admin/admin-messaging-service';

const week: DailyMessagingPoint[] = [
  { day: '2026-02-26', messages: 110, conversations_created: 2 },
  { day: '2026-02-27', messages: 98, conversations_created: 1 },
  { day: '2026-02-28', messages: 134, conversations_created: 3 },
  { day: '2026-03-01', messages: 122, conversations_created: 0 },
  { day: '2026-03-02', messages: 101, conversations_created: 2 },
  { day: '2026-03-03', messages: 140, conversations_created: 1 },
  { day: '2026-03-04', messages: 142, conversations_created: 3 },
];

const month: DailyMessagingPoint[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 1, 4 + i));
  return {
    day: date.toISOString().slice(0, 10),
    messages: 100 + Math.round(30 * Math.sin(i / 4)),
    conversations_created: i % 3 === 0 ? 3 : 1,
  };
});

// A quiet community where the two series are same-scale. Demonstrates
// that the chart CAN show both lines with room to breathe when the data
// supports it — the flattening in Week is the data's choice, not ours.
const smallCommunity: DailyMessagingPoint[] = [
  { day: '2026-02-26', messages: 8, conversations_created: 2 },
  { day: '2026-02-27', messages: 5, conversations_created: 1 },
  { day: '2026-02-28', messages: 11, conversations_created: 4 },
  { day: '2026-03-01', messages: 7, conversations_created: 0 },
  { day: '2026-03-02', messages: 9, conversations_created: 3 },
  { day: '2026-03-03', messages: 12, conversations_created: 2 },
  { day: '2026-03-04', messages: 6, conversations_created: 1 },
];

const meta: Meta<typeof MessagingTrendChart> = {
  title: 'Components/Molecular/MessagingTrendChart',
  component: MessagingTrendChart,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Two-line SVG trend over `admin_messaging_trends.daily_series`. `messages` strokes `var(--color-info)` (matches the overview spark), `conversations_created` strokes `var(--color-primary)`. Shared y-axis — when messages >> conversations the primary line flattens to the floor, and that ratio is the point.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Week: Story = {
  name: 'Week (typical scale — conversations line hugs the floor)',
  args: { data: week },
};

export const Month: Story = {
  args: { data: month },
};

export const SmallCommunity: Story = {
  name: 'Small community (both series readable)',
  args: { data: smallCommunity },
};

export const AllZero: Story = {
  args: {
    data: [
      { day: '2026-03-01', messages: 0, conversations_created: 0 },
      { day: '2026-03-02', messages: 0, conversations_created: 0 },
      { day: '2026-03-03', messages: 0, conversations_created: 0 },
    ],
  },
};

export const Empty: Story = {
  args: { data: [] },
};
