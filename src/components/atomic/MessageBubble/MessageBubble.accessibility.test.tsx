/**
 * Accessibility Tests for MessageBubble
 *
 * Verifies:
 * - No axe violations across the component's distinct render states
 *   (default, deleted, decryption error, edited, own-message-with-actions)
 * - The bubble exposes its content as plain text for screen readers
 * - Decorative SVGs are hidden from assistive tech in the deleted state
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import MessageBubble from './MessageBubble';
import type { DecryptedMessage } from '@/types/messaging';

expect.extend(toHaveNoViolations);

const mkMessage = (
  overrides: Partial<DecryptedMessage> = {}
): DecryptedMessage => ({
  id: 'm-a11y-1',
  conversation_id: 'conv-1',
  sender_id: 'user-1',
  content: 'Hello, world',
  sequence_number: 1,
  deleted: false,
  edited: false,
  edited_at: null,
  delivered_at: null,
  read_at: null,
  created_at: new Date().toISOString(),
  isOwn: false,
  senderName: 'Alice',
  ...overrides,
});

describe('MessageBubble Accessibility', () => {
  it('has no axe violations in the default state', async () => {
    const { container } = render(<MessageBubble message={mkMessage()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations in the deleted state', async () => {
    const { container } = render(
      <MessageBubble message={mkMessage({ deleted: true })} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations when decryption fails', async () => {
    const { container } = render(
      <MessageBubble message={mkMessage({ decryptionError: true })} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations on an edited message', async () => {
    const { container } = render(
      <MessageBubble
        message={mkMessage({
          edited: true,
          edited_at: new Date().toISOString(),
        })}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations when own-message edit/delete are wired', async () => {
    const { container } = render(
      <MessageBubble
        message={mkMessage({ isOwn: true })}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders the message content as plain text for screen readers', () => {
    render(<MessageBubble message={mkMessage({ content: 'plain content' })} />);
    expect(screen.getByText('plain content')).toBeInTheDocument();
  });

  it('hides decorative SVGs from assistive tech in the deleted state', () => {
    const { container } = render(
      <MessageBubble message={mkMessage({ deleted: true })} />
    );
    const svgs = container.querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
