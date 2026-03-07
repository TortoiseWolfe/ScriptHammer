import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { DateRangePicker, type DateRange } from './DateRangePicker';

const meta: Meta<typeof DateRangePicker> = {
  title: 'Components/Molecular/DateRangePicker',
  component: DateRangePicker,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Controlled date-range input with quick presets. Use the theme switcher in the Storybook toolbar to verify the inputs and join buttons pick up the active DaisyUI theme.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled({ initial }: { initial: DateRange }) {
  const [range, setRange] = useState<DateRange>(initial);
  return (
    <div className="space-y-4">
      <DateRangePicker value={range} onChange={setRange} />
      <pre className="text-xs opacity-60">
        from: {range.from?.toISOString() ?? 'null'}
        {'\n'}
        to: {range.to?.toISOString() ?? 'null'}
      </pre>
    </div>
  );
}

export const Empty: Story = {
  render: () => <Controlled initial={{ from: null, to: null }} />,
};

export const ThirtyDayWindow: Story = {
  render: () => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 86_400_000);
    return <Controlled initial={{ from, to }} />;
  },
};

export const SevenDayActive: Story = {
  render: () => {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 86_400_000);
    return <Controlled initial={{ from, to }} />;
  },
  parameters: {
    docs: {
      description: {
        story: 'The 7d preset button shows btn-active because the range width matches.',
      },
    },
  },
};
