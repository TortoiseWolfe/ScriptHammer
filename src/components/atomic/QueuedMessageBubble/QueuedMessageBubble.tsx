'use client';

import React, { memo, useState } from 'react';
import type { PendingMessage } from '@/types/messaging';

export interface QueuedMessageBubbleProps {
  /** Pending message (plaintext + queue status) */
  message: PendingMessage;
  /** Retry callback for failed messages */
  onRetry?: (id: string) => Promise<void>;
  /** Additional CSS classes */
  className?: string;
}

/**
 * QueuedMessageBubble component
 *
 * Renders an outgoing message that is still in the offline queue.
 * Queued messages are always own (`chat-end`). Visual states:
 * - `pending` / `processing`: dimmed primary bubble, spinner, "Sending..."
 * - `failed`: error bubble, retry button, retry count
 *
 * Uses `role="status"` + `aria-live="polite"` so screen readers announce
 * queue-state transitions without interrupting.
 *
 * @category atomic
 */
const QueuedMessageBubble = memo(function QueuedMessageBubble({
  message,
  onRetry,
  className = '',
}: QueuedMessageBubbleProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const isFailed = message.status === 'failed';

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;
    setIsRetrying(true);
    try {
      await onRetry(message.id);
    } finally {
      setIsRetrying(false);
    }
  };

  const statusLabel = isFailed
    ? `Failed to send${message.retries > 0 ? ` (${message.retries} ${message.retries === 1 ? 'retry' : 'retries'})` : ''}`
    : 'Sending...';

  return (
    <div
      className={`chat chat-end${className ? ` ${className}` : ''}`}
      data-testid="queued-message-bubble"
      data-message-id={message.id}
      data-queue-status={message.status}
    >
      <div
        className={`chat-bubble ${
          isFailed ? 'chat-bubble-error' : 'chat-bubble-primary opacity-70'
        }`}
      >
        <p className="break-words whitespace-pre-wrap">{message.content}</p>
      </div>
      <div
        className="chat-footer mt-1 flex items-center gap-2"
        role="status"
        aria-live="polite"
      >
        {isFailed ? (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-error h-4 w-4"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-error text-xs">{statusLabel}</span>
            {onRetry && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="btn btn-xs btn-outline btn-error min-h-11 min-w-11"
                aria-label={`Retry sending message: ${message.content}`}
              >
                {isRetrying ? 'Retrying...' : 'Retry'}
              </button>
            )}
          </>
        ) : (
          <>
            <span
              className="loading loading-spinner loading-xs"
              aria-hidden="true"
            />
            <span className="text-base-content text-xs">{statusLabel}</span>
          </>
        )}
      </div>
    </div>
  );
});

export default QueuedMessageBubble;
