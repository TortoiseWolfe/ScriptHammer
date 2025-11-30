'use client';

import React, { useRef, useEffect } from 'react';
import MessageThread from '@/components/molecular/MessageThread';
import MessageInput from '@/components/atomic/MessageInput';
import type { DecryptedMessage } from '@/types/messaging';
import { cn } from '@/lib/utils';
import { useKeyboardShortcuts, shortcuts } from '@/hooks/useKeyboardShortcuts';
import { useReadReceipts } from '@/hooks/useReadReceipts';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();

  // Mark messages as read when they enter viewport
  useReadReceipts({
    messages,
    userId: user?.id || '',
    conversationId,
    isVisible: true,
  });

  // Check if ALL messages have decryption errors (Feature 006)
  const allMessagesUndecryptable =
    messages.length > 0 && messages.every((m) => m.decryptionError === true);

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
      className={cn('grid h-full grid-rows-[auto_1fr_auto]', className)}
      data-testid="chat-window"
    >
      {/* Row 1: Header + Banners (auto height) */}
      <div>
        {/* Chat Header */}
        <header className="border-base-300 bg-base-200 border-b px-4 py-3">
          <h2 className="text-lg font-semibold">{participantName}</h2>
        </header>

        {/* Blocked User Banner */}
        {isBlocked && (
          <div className="alert alert-warning" role="alert">
            <span>
              {participantName} has blocked you. You cannot send messages.
            </span>
          </div>
        )}

        {/* All Messages Undecryptable Banner (Feature 006) */}
        {allMessagesUndecryptable && (
          <div className="alert m-2" role="alert">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>
              All messages in this conversation were encrypted with previous
              keys and cannot be read.
            </span>
          </div>
        )}
      </div>

      {/* Row 2: Message Thread (1fr - fills remaining space) */}
      <div className="h-full min-h-0">
        <MessageThread
          messages={messages}
          onEditMessage={onEditMessage}
          onDeleteMessage={onDeleteMessage}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
          loading={loading}
          className="h-full"
        />
      </div>

      {/* Row 3: Message Input (auto height) */}
      <div className="border-base-300 bg-base-100 border-t px-4 pt-4 pb-6">
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
