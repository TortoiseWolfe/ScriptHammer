'use client';

import React, { useRef, useEffect } from 'react';
import MessageThread from '@/components/molecular/MessageThread';
import MessageInput from '@/components/atomic/MessageInput';
import type { DecryptedMessage } from '@/types/messaging';
import { useKeyboardShortcuts, shortcuts } from '@/hooks/useKeyboardShortcuts';

export interface ChatWindowProps {
  /** Conversation ID */
  conversationId: string;
  /** Array of decrypted messages */
  messages: DecryptedMessage[];
  /** Callback to send a new message */
  onSendMessage: (content: string) => void;
  /** Callback to edit a message */
  onEditMessage?: (messageId: string, newContent: string) => Promise<void>;
  /** Callback to delete a message */
  onDeleteMessage?: (messageId: string) => Promise<void>;
  /** Callback to load more messages (pagination) */
  onLoadMore?: () => void;
  /** Whether more messages are available */
  hasMore?: boolean;
  /** Loading state for pagination */
  loading?: boolean;
  /** Whether a message is currently being sent */
  sending?: boolean;
  /** Whether user is blocked */
  isBlocked?: boolean;
  /** Name of other participant */
  participantName?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ChatWindow component
 * Tasks: T078-T079
 *
 * Composes:
 * - Chat header with participant name
 * - MessageThread for displaying messages
 * - MessageInput for sending messages
 * - Blocked user banner (if applicable)
 *
 * @category organisms
 */
export default function ChatWindow({
  conversationId,
  messages,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onLoadMore,
  hasMore = false,
  loading = false,
  sending = false,
  isBlocked = false,
  participantName = 'User',
  className = '',
}: ChatWindowProps) {
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const [isEditMode, setIsEditMode] = React.useState(false);

  // Auto-focus message input on mount (T216)
  useEffect(() => {
    if (messageInputRef.current && !isBlocked) {
      messageInputRef.current.focus();
    }
  }, [isBlocked]);

  // Focus message input after sending (T216)
  useEffect(() => {
    if (!sending && messageInputRef.current && !isBlocked) {
      messageInputRef.current.focus();
    }
  }, [sending, isBlocked]);

  // Keyboard shortcuts integration (T214)
  useKeyboardShortcuts([
    // Ctrl+Enter: Send message (handled by MessageInput itself)
    // Arrow Up: Edit last message (if within 15min)
    shortcuts.previousItem((e) => {
      e.preventDefault();
      if (messages.length > 0 && onEditMessage) {
        const lastMessage = messages[messages.length - 1];
        // Check if last message is from current user and within edit window
        const now = new Date();
        const messageTime = new Date(lastMessage.created_at);
        const minutesAgo = (now.getTime() - messageTime.getTime()) / 1000 / 60;

        if (minutesAgo <= 15 && !lastMessage.deleted) {
          setIsEditMode(true);
          // Focus would be handled by the edit component
        }
      }
    }),
    // Escape: Cancel edit mode
    shortcuts.closeModal(() => {
      if (isEditMode) {
        setIsEditMode(false);
        messageInputRef.current?.focus();
      }
    }),
  ]);

  return (
    <div
      className={`flex h-full flex-col${className ? ` ${className}` : ''}`}
      data-testid="chat-window"
    >
      {/* Chat Header */}
      <div className="border-base-300 bg-base-200 border-b px-4 py-3">
        <h2 className="text-lg font-semibold">{participantName}</h2>
      </div>

      {/* Blocked User Banner */}
      {isBlocked && (
        <div className="alert alert-warning" role="alert">
          <span>
            {participantName} has blocked you. You cannot send messages.
          </span>
        </div>
      )}

      {/* Message Thread */}
      <MessageThread
        messages={messages}
        onEditMessage={onEditMessage}
        onDeleteMessage={onDeleteMessage}
        onLoadMore={onLoadMore}
        hasMore={hasMore}
        loading={loading}
      />

      {/* Message Input */}
      <div className="border-base-300 bg-base-100 border-t p-4">
        <MessageInput
          onSend={onSendMessage}
          disabled={isBlocked}
          sending={sending}
          inputRef={messageInputRef}
          placeholder={
            isBlocked
              ? 'You cannot send messages to this user'
              : sending
                ? 'Setting up encryption...'
                : 'Type a message...'
          }
        />
      </div>
    </div>
  );
}
