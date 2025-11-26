'use client';

import React from 'react';
import AvatarDisplay from '@/components/atomic/AvatarDisplay';
import type { UserProfile } from '@/types/messaging';

export interface ConversationListItemProps {
  /** Conversation ID */
  conversationId: string;
  /** Other participant's profile */
  participant: UserProfile;
  /** Last message preview (truncated) */
  lastMessage?: string | null;
  /** Timestamp of last message */
  lastMessageAt?: string | null;
  /** Number of unread messages */
  unreadCount?: number;
  /** Whether this conversation is archived by current user */
  isArchived?: boolean;
  /** Whether this conversation is selected */
  isSelected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Archive handler */
  onArchive?: () => void;
  /** Unarchive handler */
  onUnarchive?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ConversationListItem component
 *
 * Displays a single conversation in the conversation list with:
 * - Participant avatar (using AvatarDisplay from Feature 022)
 * - Participant name
 * - Last message preview (truncated, max 50 chars)
 * - Timestamp (relative: "2m ago", "1h ago", "Yesterday")
 * - Unread count badge (if > 0)
 * - Highlight if unread
 *
 * @category molecular
 */
export default function ConversationListItem({
  conversationId,
  participant,
  lastMessage,
  lastMessageAt,
  unreadCount = 0,
  isArchived = false,
  isSelected = false,
  onClick,
  onArchive,
  onUnarchive,
  className = '',
}: ConversationListItemProps) {
  // Format timestamp as relative time
  const formatTimestamp = (timestamp: string | null): string => {
    if (!timestamp) return '';

    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffMs = now.getTime() - messageTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    // Older than a week: show date
    return messageTime.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  // Truncate message preview to max 50 characters
  const truncateMessage = (message: string | null | undefined): string => {
    if (!message) return 'No messages yet';
    if (message.length <= 50) return message;
    return `${message.substring(0, 50)}...`;
  };

  const hasUnread = unreadCount > 0;

  // Handle archive menu action (stop propagation to prevent triggering onClick)
  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isArchived) {
      onUnarchive?.();
    } else {
      onArchive?.();
    }
  };

  return (
    <div
      className={`hover:bg-base-200 group relative flex min-h-11 w-full items-center gap-3 rounded-lg p-3 transition-colors ${
        isSelected ? 'bg-base-300' : ''
      } ${hasUnread ? 'bg-base-200' : ''} ${className}`}
      data-conversation-id={conversationId}
    >
      {/* Main clickable area */}
      <button
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        aria-label={`Conversation with ${participant.display_name || 'User'}${hasUnread ? `, ${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : ''}`}
      >
        {/* Avatar */}
        <div className="shrink-0">
          <AvatarDisplay
            avatarUrl={participant.avatar_url}
            displayName={participant.display_name}
            size="md"
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Name and timestamp */}
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h3
              className={`truncate text-sm font-semibold ${hasUnread ? 'text-base-content' : 'text-base-content/90'}`}
            >
              {participant.display_name || 'Unknown User'}
            </h3>
            {lastMessageAt && (
              <span className="text-base-content/60 shrink-0 text-xs">
                {formatTimestamp(lastMessageAt)}
              </span>
            )}
          </div>

          {/* Last message preview */}
          <div className="flex items-center justify-between gap-2">
            <p
              className={`truncate text-sm ${hasUnread ? 'text-base-content font-medium' : 'text-base-content/70'}`}
            >
              {truncateMessage(lastMessage)}
            </p>

            {/* Unread badge */}
            {hasUnread && (
              <span
                className="badge badge-primary badge-sm shrink-0"
                aria-label={`${unreadCount} unread`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Three-dot menu - show on hover or focus */}
      {(onArchive || onUnarchive) && (
        <div className="dropdown dropdown-end opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <button
            tabIndex={0}
            className="btn btn-ghost btn-sm btn-square min-h-11 min-w-11"
            aria-label="Conversation options"
            onClick={(e) => e.stopPropagation()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
              />
            </svg>
          </button>
          <ul
            tabIndex={0}
            className="menu dropdown-content bg-base-100 rounded-box z-10 w-40 p-2 shadow"
          >
            <li>
              <button onClick={handleArchiveClick} className="min-h-11">
                {isArchived ? 'Unarchive' : 'Archive'}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
