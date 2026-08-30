import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import ChatWindow from './ChatWindow';
import type { DecryptedMessage } from '@/types/messaging';

expect.extend(toHaveNoViolations);

/**
 * This file was `expect(true).toBe(true)` — a placeholder that satisfied the
 * structure validator because its content check only ran under `--strict`, and
 * nothing passed that flag. Enabling it is what surfaced this.
 *
 * ChatWindow is the whole messaging surface, and its accessibility is mostly about
 * things a screen reader must be TOLD rather than shown: that you have been
 * blocked, that nothing here can be decrypted, and where the cursor went.
 */
const message = (over: Partial<DecryptedMessage> = {}): DecryptedMessage => ({
  id: 'm1',
  conversation_id: 'conv-1',
  sender_id: 'u1',
  content: 'Hello there',
  sequence_number: 1,
  deleted: false,
  edited: false,
  edited_at: null,
  delivered_at: null,
  read_at: null,
  created_at: new Date(0).toISOString(),
  isOwn: false,
  senderName: 'Ada',
  ...over,
});

const renderWindow = (
  props: Partial<React.ComponentProps<typeof ChatWindow>> = {}
) =>
  render(
    <ChatWindow
      conversationId="conv-1"
      messages={[]}
      onSendMessage={vi.fn()}
      {...props}
    />
  );

describe('ChatWindow Accessibility', () => {
  it('has no violations when empty', async () => {
    const { container } = renderWindow();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with messages', async () => {
    const { container } = renderWindow({ messages: [message()] });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations when blocked', async () => {
    const { container } = renderWindow({ isBlocked: true });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations when nothing can be decrypted', async () => {
    const { container } = renderWindow({
      messages: [message({ decryptionError: true })],
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names the conversation with a heading', () => {
    renderWindow({ participantName: 'Ada Lovelace' });
    // A heading, not a styled div: the participant name is how someone navigating
    // by heading knows which conversation they landed in.
    expect(
      screen.getByRole('heading', { name: 'Ada Lovelace' })
    ).toBeInTheDocument();
  });

  it('ANNOUNCES being blocked rather than only disabling the input', () => {
    renderWindow({ isBlocked: true, participantName: 'Ada' });
    // Without role="alert" the input silently stops working and nothing says why.
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ada has blocked you. You cannot send messages.'
    );
  });

  it('explains the blocked state in the input itself, not just the banner', () => {
    renderWindow({ isBlocked: true });
    // The banner is announced once on render; someone who tabs to the input later
    // needs the reason to still be there.
    const input = screen.getByPlaceholderText(
      'You cannot send messages to this user'
    );
    expect(input).toBeDisabled();
  });

  it('ANNOUNCES that the history is unreadable', () => {
    renderWindow({ messages: [message({ decryptionError: true })] });
    expect(screen.getByRole('alert')).toHaveTextContent(
      /encrypted with previous keys and cannot be read/
    );
  });

  it('does not claim the history is unreadable when only SOME messages are', () => {
    // `every()`, not `some()` — one stale message must not tell the reader the
    // whole conversation is lost.
    renderWindow({
      messages: [message({ decryptionError: true }), message({ id: 'm2' })],
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('moves focus to the message input on mount', () => {
    renderWindow();
    // Opening a conversation should put the cursor where you type, without a
    // keyboard user having to tab past the whole thread to reach it.
    expect(screen.getByPlaceholderText('Type a message...')).toHaveFocus();
  });

  it('does NOT steal focus when the input is unusable', () => {
    renderWindow({ isBlocked: true });
    // Focusing a disabled control strands a keyboard user on something inert.
    expect(
      screen.getByPlaceholderText('You cannot send messages to this user')
    ).not.toHaveFocus();
  });

  it('marks the banner icon decorative so it is not announced', () => {
    const { container } = renderWindow({
      messages: [message({ decryptionError: true })],
    });
    // The padlock repeats what the text already says.
    const svg = container.querySelector('[role="alert"] svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
