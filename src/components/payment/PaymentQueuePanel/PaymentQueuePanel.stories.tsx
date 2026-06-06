import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import PaymentQueuePanel from './PaymentQueuePanel';

const meta: Meta<typeof PaymentQueuePanel> = {
  title: 'Features/Payment/PaymentQueuePanel',
  component: PaymentQueuePanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'User-facing management surface for the offline payment queue (#4) — status, queued items + retry counts, manual retry, and clear-queue. Reads the live `paymentQueue`; in Storybook (empty IndexedDB) it shows the empty state.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { pollIntervalMs: 999999 },
};
