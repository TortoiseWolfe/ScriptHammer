'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MESSAGE_CONSTRAINTS } from '@/types/messaging';
import { cn } from '@/lib/utils';

export interface MessageInputProps {
  /** Callback when message is sent */
  onSend: (content: string) => void;
  /** Optional placeholder text */
  placeholder?: string;
  /** Disable input (e.g., when blocked) */
  disabled?: boolean;
  /** Whether a message is currently being sent */
  sending?: boolean;
  /** Callback when typing status changes */
  onTypingChange?: (isTyping: boolean) => void;
  /** Additional CSS classes */
  className?: string;
  /** Forward ref for textarea element */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

/**
 * MessageInput component
 * Tasks: T070-T072, T117 (integrated typing status)
 *
 * Features:
 * - Auto-expanding textarea
 * - Send button with 44px touch target
 * - Character count
 * - Message validation (max 10,000 chars, non-empty after trim)
 * - Enter to send, Cmd/Ctrl+Enter for newline
 * - Loading indicator when sending
 * - Typing status triggers (calls onTypingChange callback)
 *
 * @category atomic
 */
export default function MessageInput({
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
  sending = false,
  onTypingChange,
  className = '',
  inputRef,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef || internalRef; // Use forwarded ref if provided
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const charCount = message.length;
  const charLimit = MESSAGE_CONSTRAINTS.MAX_LENGTH;
  const remaining = charLimit - charCount;

  // Handle typing status changes
  const handleMessageChange = (value: string) => {
    setMessage(value);

    if (onTypingChange) {
      // User is typing if there's content
      if (value.length > 0) {
        onTypingChange(true);

        // Clear existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Set timeout to stop typing after 3 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
          onTypingChange(false);
        }, 3000);
      } else {
        // Clear typing status if input is empty
        onTypingChange(false);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      }
    }
  };

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Auto-expand textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [message, textareaRef]);

  const handleSend = () => {
    setError(null);

    const trimmed = message.trim();

    if (trimmed.length < MESSAGE_CONSTRAINTS.MIN_LENGTH) {
      setError('Message cannot be empty');
      return;
    }

    if (trimmed.length > MESSAGE_CONSTRAINTS.MAX_LENGTH) {
      setError(
        `Message cannot exceed ${MESSAGE_CONSTRAINTS.MAX_LENGTH} characters`
      );
      return;
    }

    onSend(trimmed);
    setMessage('');
    setError(null);

    // Clear typing status after sending
    if (onTypingChange) {
      onTypingChange(false);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Cmd/Ctrl+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDisabled = disabled || sending || charCount > charLimit;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {error && (
        <div className="alert alert-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => handleMessageChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || sending}
            className="textarea textarea-bordered w-full resize-none"
            rows={1}
            aria-label="Message input"
            aria-describedby="char-count"
          />
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={isDisabled}
          className="btn btn-primary min-h-11 min-w-11"
          aria-label="Send message"
        >
          {sending ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              <span className="hidden sm:inline">Sending...</span>
            </>
          ) : (
            'Send'
          )}
        </button>
      </div>

      <div
        id="char-count"
        className={`text-xs ${
          remaining < 100 ? 'text-warning' : 'text-base-content opacity-60'
        }`}
        aria-live="polite"
      >
        {charCount || 0} / {charLimit} characters
        {remaining < 100 && ` (${remaining} remaining)`}
      </div>
    </div>
  );
}
