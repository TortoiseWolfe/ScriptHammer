import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ContactQueueSender from './ContactQueueSender';

/**
 * ContactQueueSender renders nothing until a contact message saved offline is waiting
 * (#1321). Then it shows a small card while it sends, "sent" when done, or a not-sent card
 * with Try again and Discard. In Storybook the IndexedDB queue is normally empty, so this
 * story documents the invisible default rather than pretending there is a visual.
 */
const meta: Meta<typeof ContactQueueSender> = {
  title: 'Features/Forms/ContactQueueSender',
  component: ContactQueueSender,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Mounted once in the root layout. When the visitor is online and a ' +
          'contact message saved offline is waiting, it gets a Turnstile token ' +
          '(interaction-only, so usually invisible) and sends the message through ' +
          'the contact function. A message that will not send stays saved until ' +
          'the visitor tries again or discards it.',
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
      <ContactQueueSender />
      <p className="text-base-content max-w-prose text-sm">
        Nothing is saved, so this renders nothing. With a saved message and a
        connection, a small card appears at the bottom right while it sends.
      </p>
    </>
  ),
};
