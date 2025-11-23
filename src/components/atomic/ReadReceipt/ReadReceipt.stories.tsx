import type { Meta, StoryObj } from '@storybook/nextjs';
import ReadReceipt from './ReadReceipt';

/**
 * Storybook Stories for ReadReceipt
 * Task: T126
 *
 * Displays message delivery/read status indicators.
 */

const meta: Meta<typeof ReadReceipt> = {
  title: 'Messaging/ReadReceipt',
  component: ReadReceipt,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
ReadReceipt displays delivery and read status for messages.

States:
- **Sent**: Single gray checkmark (message sent to server)
- **Delivered**: Double gray checkmarks (message delivered to recipient's device)
- **Read**: Double blue checkmarks (message read by recipient)

All states include proper ARIA labels for screen readers.
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['sent', 'delivered', 'read'],
      description: 'Delivery status of the message',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Message sent (single checkmark)
 */
export const Sent: Story = {
  args: {
    status: 'sent',
  },
};

/**
 * Message delivered (double gray checkmarks)
 */
export const Delivered: Story = {
  args: {
    status: 'delivered',
  },
};

/**
 * Message read (double blue checkmarks)
 */
export const Read: Story = {
  args: {
    status: 'read',
  },
};

/**
 * All states side by side for comparison
 */
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <ReadReceipt status="sent" />
        <span className="text-sm">Sent</span>
      </div>
      <div className="flex items-center gap-2">
        <ReadReceipt status="delivered" />
        <span className="text-sm">Delivered</span>
      </div>
      <div className="flex items-center gap-2">
        <ReadReceipt status="read" />
        <span className="text-sm">Read</span>
      </div>
    </div>
  ),
};

/**
 * With custom styling
 */
export const WithCustomClass: Story = {
  args: {
    status: 'read',
    className: 'p-2 bg-base-200 rounded',
  },
};
