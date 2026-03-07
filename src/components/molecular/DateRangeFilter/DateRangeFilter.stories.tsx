import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import DateRangeFilter, { type DateRange } from './DateRangeFilter';

const meta: Meta<typeof DateRangeFilter> = {
  title: 'Components/Molecular/DateRangeFilter',
  component: DateRangeFilter,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Two native date inputs plus 7d/30d/90d presets. Controlled via `value` + `onChange`. Start ≤ end enforced by input min/max.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: { start: '2026-02-26', end: '2026-03-05' },
    onChange: () => {},
  },
};

export const Empty: Story = {
  args: {
    onChange: () => {},
  },
};

export const Interactive: Story = {
  render: function Render() {
    const [range, setRange] = useState<DateRange>({
      start: '2026-02-26',
      end: '2026-03-05',
    });
    return (
      <div className="space-y-4">
        <DateRangeFilter value={range} onChange={setRange} />
        <pre className="bg-base-200 rounded p-4 text-sm">
          {JSON.stringify(range, null, 2)}
        </pre>
      </div>
    );
  },
};
