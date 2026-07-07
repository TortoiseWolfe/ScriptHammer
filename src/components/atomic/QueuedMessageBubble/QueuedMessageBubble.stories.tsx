import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import QueuedMessageBubble from './QueuedMessageBubble';
import type { PendingMessage } from '@/types/messaging';

/**
 * Storybook Stories for QueuedMessageBubble
 *
 * Displays an outgoing message still in the offline queue.
 */

const base: PendingMessage = {
  id: 'qm-story-1',
  conversation_id: 'conv-1',
  content: 'This message was sent while offline and is waiting to sync.',
  status: 'pending',
  retries: 0,
  created_at: new Date().toISOString(),
};

const meta: Meta<typeof QueuedMessageBubble> = {
  title: 'Components/Atomic/QueuedMessageBubble',
  component: QueuedMessageBubble,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
QueuedMessageBubble renders an outgoing message that is still in the
offline queue. It shows a sending spinner for \`pending\`/\`processing\`
and an error state with a Retry button for \`failed\`.

Plaintext is session-only (the underlying IndexedDB queue holds ciphertext).
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    message: {
      control: 'object',
      description: 'Pending message (plaintext + queue status)',
    },
    onRetry: {
      action: 'retry',
      description: 'Retry callback for failed messages',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Freshly queued — spinner + "Sending..." */
export const Pending: Story = {
  args: {
    message: { ...base, status: 'pending' },
  },
};

/** Currently being sent by the sync worker */
export const Processing: Story = {
  args: {
    message: { ...base, status: 'processing' },
  },
};

/** Send failed after max retries — error bubble + Retry button */
export const Failed: Story = {
  args: {
    message: { ...base, status: 'failed', retries: 5 },
    onRetry: async (id) => {
      await new Promise((r) => setTimeout(r, 800));
      console.log('Retry clicked for', id);
    },
  },
};

/** Single retry attempt — singular label */
export const FailedSingleRetry: Story = {
  args: {
    message: { ...base, status: 'failed', retries: 1 },
    onRetry: async () => {},
  },
};

/** Long content wraps correctly */
export const LongContent: Story = {
  args: {
    message: {
      ...base,
      content:
        'This is a much longer queued message to verify that word-wrap and whitespace-pre-wrap behave correctly inside the dimmed primary bubble even before the message has synced.',
    },
  },
};
