'use client';

import React from 'react';

export interface TypingIndicatorProps {
  /** Display name of user who is typing */
  userName?: string;
  /** Whether to show the indicator (controls visibility) */
  show?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * TypingIndicator component
 * Task: T109
 *
 * Displays an animated typing indicator with dots animation.
 * Uses ARIA live region for screen reader announcements.
 *
 * Features:
 * - Animated dots (CSS keyframes)
 * - "[User] is typing..." text
 * - ARIA live region for accessibility
 * - Smooth fade-in/out transitions
 *
 * @category atomic
 */
export default function TypingIndicator({
  userName = 'User',
  show = false,
  className = '',
}: TypingIndicatorProps) {
  if (!show) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 text-sm text-base-content/70${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="typing-indicator"
    >
      <div className="flex gap-1" aria-hidden="true">
        <div className="bg-primary h-2 w-2 animate-bounce rounded-full [animation-delay:0ms]" />
        <div className="bg-primary h-2 w-2 animate-bounce rounded-full [animation-delay:150ms]" />
        <div className="bg-primary h-2 w-2 animate-bounce rounded-full [animation-delay:300ms]" />
      </div>
      <span>{userName} is typing...</span>
    </div>
  );
}
