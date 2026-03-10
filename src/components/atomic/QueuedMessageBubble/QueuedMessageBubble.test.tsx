/**
 * Unit Tests for QueuedMessageBubble Component
 *
 * Covers:
 * - Pending / processing → spinner + "Sending..." footer
 * - Failed → error bubble + retry count + Retry button
 * - Retry callback wiring + disabled-while-retrying
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import QueuedMessageBubble from './QueuedMessageBubble';
import type { PendingMessage } from '@/types/messaging';

const mkPending = (overrides: Partial<PendingMessage> = {}): PendingMessage => ({
  id: 'qm-1',
  conversation_id: 'conv-1',
  content: 'Hello offline world',
  status: 'pending',
  retries: 0,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('QueuedMessageBubble', () => {
  it('renders message content', () => {
    render(<QueuedMessageBubble message={mkPending()} />);
    expect(screen.getByText('Hello offline world')).toBeInTheDocument();
  });

  it('renders as own message (chat-end)', () => {
    render(<QueuedMessageBubble message={mkPending()} />);
    const bubble = screen.getByTestId('queued-message-bubble');
    expect(bubble).toHaveClass('chat', 'chat-end');
  });

  it('exposes queue status via data attribute', () => {
    render(<QueuedMessageBubble message={mkPending({ status: 'failed' })} />);
    const bubble = screen.getByTestId('queued-message-bubble');
    expect(bubble).toHaveAttribute('data-queue-status', 'failed');
  });

  describe('pending state', () => {
    it('shows "Sending..." label with spinner', () => {
      render(<QueuedMessageBubble message={mkPending({ status: 'pending' })} />);
      expect(screen.getByText('Sending...')).toBeInTheDocument();
      const { container } = render(
        <QueuedMessageBubble message={mkPending({ status: 'pending' })} />
      );
      expect(container.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    it('uses dimmed primary bubble style', () => {
      const { container } = render(
        <QueuedMessageBubble message={mkPending({ status: 'pending' })} />
      );
      const bubble = container.querySelector('.chat-bubble');
      expect(bubble).toHaveClass('chat-bubble-primary', 'opacity-70');
    });

    it('does not render a Retry button', () => {
      render(
        <QueuedMessageBubble
          message={mkPending({ status: 'pending' })}
          onRetry={vi.fn()}
        />
      );
      expect(
        screen.queryByRole('button', { name: /retry/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('processing state', () => {
    it('shows "Sending..." label (same as pending)', () => {
      render(
        <QueuedMessageBubble message={mkPending({ status: 'processing' })} />
      );
      expect(screen.getByText('Sending...')).toBeInTheDocument();
    });
  });

  describe('failed state', () => {
    it('uses error bubble style', () => {
      const { container } = render(
        <QueuedMessageBubble message={mkPending({ status: 'failed' })} />
      );
      const bubble = container.querySelector('.chat-bubble');
      expect(bubble).toHaveClass('chat-bubble-error');
      expect(bubble).not.toHaveClass('opacity-70');
    });

    it('shows failed label without retry count when retries=0', () => {
      render(
        <QueuedMessageBubble
          message={mkPending({ status: 'failed', retries: 0 })}
        />
      );
      expect(screen.getByText('Failed to send')).toBeInTheDocument();
    });

    it('shows singular retry count', () => {
      render(
        <QueuedMessageBubble
          message={mkPending({ status: 'failed', retries: 1 })}
        />
      );
      expect(screen.getByText('Failed to send (1 retry)')).toBeInTheDocument();
    });

    it('shows plural retry count', () => {
      render(
        <QueuedMessageBubble
          message={mkPending({ status: 'failed', retries: 3 })}
        />
      );
      expect(screen.getByText('Failed to send (3 retries)')).toBeInTheDocument();
    });

    it('renders a Retry button when onRetry provided', () => {
      render(
        <QueuedMessageBubble
          message={mkPending({ status: 'failed' })}
          onRetry={vi.fn()}
        />
      );
      expect(
        screen.getByRole('button', { name: /retry sending message/i })
      ).toBeInTheDocument();
    });

    it('does not render Retry button when onRetry omitted', () => {
      render(
        <QueuedMessageBubble message={mkPending({ status: 'failed' })} />
      );
      expect(
        screen.queryByRole('button', { name: /retry/i })
      ).not.toBeInTheDocument();
    });

    it('calls onRetry with message id on click', async () => {
      const onRetry = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(
        <QueuedMessageBubble
          message={mkPending({ id: 'qm-42', status: 'failed' })}
          onRetry={onRetry}
        />
      );
      await user.click(
        screen.getByRole('button', { name: /retry sending message/i })
      );
      expect(onRetry).toHaveBeenCalledWith('qm-42');
    });

    it('disables Retry button while retry is in flight', async () => {
      let resolveRetry: () => void = () => {};
      const onRetry = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveRetry = resolve;
          })
      );
      const user = userEvent.setup();
      render(
        <QueuedMessageBubble
          message={mkPending({ status: 'failed' })}
          onRetry={onRetry}
        />
      );
      const btn = screen.getByRole('button', { name: /retry sending message/i });
      await user.click(btn);
      expect(btn).toBeDisabled();
      expect(screen.getByText('Retrying...')).toBeInTheDocument();
      resolveRetry();
    });
  });

  it('applies custom className', () => {
    render(
      <QueuedMessageBubble
        message={mkPending()}
        className="custom-test-class"
      />
    );
    expect(screen.getByTestId('queued-message-bubble')).toHaveClass(
      'custom-test-class'
    );
  });
});
