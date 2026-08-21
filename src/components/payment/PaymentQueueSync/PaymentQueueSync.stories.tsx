import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import PaymentQueueSync from './PaymentQueueSync';

/**
 * PaymentQueueSync renders nothing — it exists to start the offline-payment
 * queue drain when connectivity returns (#895). The story documents that
 * deliberately invisible contract rather than pretending there is a visual.
 */
const meta: Meta<typeof PaymentQueueSync> = {
  title: 'Features/Payment/PaymentQueueSync',
  component: PaymentQueueSync,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Mount-only. Starts the offline payment-queue drain on mount and stops ' +
          'it on unmount, and renders no DOM. Mounted once in the root layout — ' +
          'the listener is a module-level singleton, so a second mount would ' +
          'disarm the first.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <>
      <PaymentQueueSync />
      <p className="text-base-content/100 max-w-prose text-sm">
        This component renders nothing. It is mounted once in the root layout so
        that a payment queued while offline drains when the connection returns.
      </p>
    </>
  ),
};
