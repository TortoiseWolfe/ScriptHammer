/**
 * Accessibility Tests for QueuedMessageBubble
 *
 * Verifies:
 * - No axe violations in pending and failed states
 * - Status footer is an ARIA live region (polite)
 * - Retry button is keyboard-focusable with a descriptive accessible name
 * - Decorative spinner/icon are hidden from assistive tech
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import QueuedMessageBubble from './QueuedMessageBubble';
import type { PendingMessage } from '@/types/messaging';

expect.extend(toHaveNoViolations);

const mkPending = (overrides: Partial<PendingMessage> = {}): PendingMessage => ({
  id: 'qm-a11y-1',
  conversation_id: 'conv-1',
  content: 'Accessibility test message',
  status: 'pending',
  retries: 0,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('QueuedMessageBubble Accessibility', () => {
  it('has no axe violations in pending state', async () => {
    const { container } = render(
      <QueuedMessageBubble message={mkPending({ status: 'pending' })} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations in failed state with retry', async () => {
    const { container } = render(
      <QueuedMessageBubble
        message={mkPending({ status: 'failed', retries: 3 })}
        onRetry={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('uses a polite live region for the status footer', () => {
    render(<QueuedMessageBubble message={mkPending()} />);
    const footer = screen.getByRole('status');
    expect(footer).toHaveAttribute('aria-live', 'polite');
    expect(footer).toHaveTextContent('Sending...');
  });

  it('announces failure text via the live region', () => {
    render(
      <QueuedMessageBubble
        message={mkPending({ status: 'failed', retries: 2 })}
      />
    );
    const footer = screen.getByRole('status');
    expect(footer).toHaveTextContent('Failed to send (2 retries)');
  });

  it('hides spinner from assistive technology', () => {
    const { container } = render(
      <QueuedMessageBubble message={mkPending({ status: 'pending' })} />
    );
    const spinner = container.querySelector('.loading-spinner');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
  });

  it('hides error icon from assistive technology', () => {
    const { container } = render(
      <QueuedMessageBubble message={mkPending({ status: 'failed' })} />
    );
    const icon = container.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('retry button is keyboard focusable', () => {
    render(
      <QueuedMessageBubble
        message={mkPending({ status: 'failed' })}
        onRetry={vi.fn()}
      />
    );
    const btn = screen.getByRole('button', { name: /retry sending message/i });
    btn.focus();
    expect(btn).toHaveFocus();
  });

  it('retry button has descriptive accessible name including message content', () => {
    render(
      <QueuedMessageBubble
        message={mkPending({
          status: 'failed',
          content: 'Meet me at 5pm',
        })}
        onRetry={vi.fn()}
      />
    );
    expect(
      screen.getByRole('button', {
        name: /retry sending message: meet me at 5pm/i,
      })
    ).toBeInTheDocument();
  });

  it('retry button meets 44px minimum touch target', () => {
    render(
      <QueuedMessageBubble
        message={mkPending({ status: 'failed' })}
        onRetry={vi.fn()}
      />
    );
    const btn = screen.getByRole('button', { name: /retry sending message/i });
    expect(btn).toHaveClass('min-h-11', 'min-w-11');
  });
});
