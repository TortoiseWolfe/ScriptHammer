import React, { useState, useRef, useEffect, memo } from 'react';
import type { DecryptedMessage } from '@/types/messaging';
import ReadReceipt, { type DeliveryStatus } from '../ReadReceipt/ReadReceipt';
import {
  isWithinEditWindow,
  isWithinDeleteWindow,
} from '@/lib/messaging/validation';
import { createLogger } from '@/lib/logger/logger';

const logger = createLogger('components:atomic:MessageBubble');

/**
 * Parse basic markdown: **bold**, *italic*, `code`
 * Feature: 008-feature-008-ux
 * @param text - The text to parse for markdown syntax
 * @returns React nodes with markdown rendered as HTML elements
 */
const parseMarkdown = (text: string): React.ReactNode => {
  // Pattern matches: **bold**, *italic*, `code` (bold must come before italic)
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="bg-base-300 rounded px-1">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
};

export interface MessageBubbleProps {
  /** Message data */
  message: DecryptedMessage;
  /** Additional CSS classes */
  className?: string;
  /** Callback when message is edited */
  onEdit?: (messageId: string, newContent: string) => Promise<void>;
  /** Callback when message is deleted */
  onDelete?: (messageId: string) => Promise<void>;
}

/**
 * MessageBubble component
 * Tasks: T067-T068, T107-T110, T116 (integrated ReadReceipt), T161 (React.memo optimization)
 *
 * Displays an individual message with:
 * - Sender/recipient variants
 * - Timestamp
 * - Decrypted content
 * - Delivery status indicators (via ReadReceipt component)
 * - Edit/Delete functionality (within 15-minute window)
 * - "[Message deleted]" placeholder for deleted messages
 * - "Edited" indicator for edited messages
 * - Performance optimized with React.memo
 *
 * @category atomic
 */
const MessageBubble = memo(
  function MessageBubble({
    message,
    className = '',
    onEdit,
    onDelete,
  }: MessageBubbleProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(message.content);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
      if (isEditing && textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height =
          textareaRef.current.scrollHeight + 'px';
        textareaRef.current.focus();
      }
    }, [isEditing, editContent]);
    const formatTimestamp = (isoString: string): string => {
      const date = new Date(isoString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diff / 60000);
      const diffHours = Math.floor(diff / 3600000);
      const diffDays = Math.floor(diff / 86400000);

      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString();
    };

    const getDeliveryStatus = (): DeliveryStatus => {
      if (message.read_at) return 'read';
      if (message.delivered_at) return 'delivered';
      return 'sent';
    };

    const canEdit =
      message.isOwn &&
      !message.deleted &&
      isWithinEditWindow(message.created_at);
    const canDelete =
      message.isOwn &&
      !message.deleted &&
      isWithinDeleteWindow(message.created_at);

    const handleEditClick = () => {
      setEditContent(message.content);
      setIsEditing(true);
    };

    const handleSaveEdit = async () => {
      if (!onEdit || editContent.trim() === message.content || isSubmitting)
        return;

      setIsSubmitting(true);
      try {
        await onEdit(message.id, editContent.trim());
        setIsEditing(false);
      } catch (error) {
        logger.error('Failed to edit message', {
          messageId: message.id,
          error,
        });
        // Keep edit mode open so user can retry
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleCancelEdit = () => {
      setEditContent(message.content);
      setIsEditing(false);
    };

    const handleDeleteClick = () => {
      setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
      if (!onDelete || isSubmitting) return;

      setIsSubmitting(true);
      try {
        await onDelete(message.id);
        setShowDeleteConfirm(false);
      } catch (error) {
        logger.error('Failed to delete message', {
          messageId: message.id,
          error,
        });
        // Keep modal open so user can retry
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleCancelDelete = () => {
      setShowDeleteConfirm(false);
    };

    const deliveryStatus = getDeliveryStatus();

    // Deleted message placeholder
    if (message.deleted) {
      return (
        <div
          className={`chat ${message.isOwn ? 'chat-end' : 'chat-start'}${className ? ` ${className}` : ''}`}
          data-testid="message-bubble"
          data-message-id={message.id}
        >
          <div className="chat-header mb-1">
            <span className="text-sm opacity-70">{message.senderName}</span>
            <time className="ml-2 text-xs opacity-50">
              {formatTimestamp(message.created_at)}
            </time>
          </div>
          <div
            className={`chat-bubble ${
              message.isOwn ? 'chat-bubble-primary' : 'chat-bubble-secondary'
            } opacity-60`}
          >
            <p className="text-sm italic">[Message deleted]</p>
          </div>
        </div>
      );
    }

    // Decryption error placeholder with lock icon (Feature 006)
    if (message.decryptionError) {
      return (
        <div
          className={`chat ${message.isOwn ? 'chat-end' : 'chat-start'}${className ? ` ${className}` : ''}`}
          data-testid="message-bubble"
          data-message-id={message.id}
        >
          <div className="chat-header mb-1">
            <span className="text-sm opacity-70">{message.senderName}</span>
            <time className="ml-2 text-xs opacity-50">
              {formatTimestamp(message.created_at)}
            </time>
          </div>
          <div
            className="chat-bubble bg-base-300 text-base-content/70"
            role="group"
            aria-label="Encrypted message that cannot be decrypted"
          >
            <div className="flex items-center gap-2">
              <button
                className="btn btn-ghost btn-xs p-0"
                aria-label="This message was encrypted before your current encryption keys were set up"
                title="This message was encrypted before your current encryption keys were set up"
                tabIndex={0}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </button>
              <p className="text-sm italic">Encrypted with previous keys</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`chat ${message.isOwn ? 'chat-end' : 'chat-start'}${className ? ` ${className}` : ''}`}
        data-testid="message-bubble"
        data-message-id={message.id}
      >
        <div className="chat-header mb-1">
          <span className="text-sm opacity-70">{message.senderName}</span>
          <time className="ml-2 text-xs opacity-50">
            {formatTimestamp(message.created_at)}
          </time>
          {message.edited && message.edited_at && (
            <span className="ml-2 text-xs opacity-50">
              (Edited {formatTimestamp(message.edited_at)})
            </span>
          )}
        </div>
        <div
          className={`chat-bubble ${
            message.isOwn ? 'chat-bubble-primary' : 'chat-bubble-secondary'
          }`}
        >
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="textarea textarea-bordered min-h-11 w-full resize-none"
                disabled={isSubmitting}
                aria-label="Edit message content"
                maxLength={10000}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="btn btn-sm btn-ghost min-h-11 min-w-11"
                  disabled={isSubmitting}
                  aria-label="Cancel editing"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="btn btn-sm btn-primary min-h-11 min-w-11"
                  disabled={
                    isSubmitting ||
                    editContent.trim() === '' ||
                    editContent === message.content
                  }
                  aria-label="Save edited message"
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="break-words whitespace-pre-wrap">
                {parseMarkdown(message.content)}
              </p>
              {(canEdit || canDelete) && (
                <div className="mt-2 flex justify-end gap-1">
                  {canEdit && (
                    <button
                      onClick={handleEditClick}
                      className="btn btn-xs btn-ghost min-h-11 min-w-11"
                      aria-label="Edit message"
                    >
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={handleDeleteClick}
                      className="btn btn-xs btn-ghost text-error min-h-11 min-w-11"
                      aria-label="Delete message"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {message.isOwn && (
          <div className="chat-footer mt-1 flex items-center gap-1">
            <ReadReceipt status={deliveryStatus} />
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <dialog
            className="modal modal-open"
            role="dialog"
            aria-labelledby="delete-modal-title"
          >
            <div className="modal-box">
              <h3 id="delete-modal-title" className="text-lg font-bold">
                Delete Message?
              </h3>
              <p className="py-4">
                This will replace your message with &quot;[Message
                deleted]&quot; for both you and the recipient. This action
                cannot be undone.
              </p>
              <div className="modal-action">
                <button
                  onClick={handleCancelDelete}
                  className="btn btn-ghost min-h-11 min-w-11"
                  disabled={isSubmitting}
                  aria-label="Cancel deletion"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="btn btn-error min-h-11 min-w-11"
                  disabled={isSubmitting}
                  aria-label="Confirm deletion"
                >
                  {isSubmitting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
            <div
              className="modal-backdrop bg-black/50"
              onClick={handleCancelDelete}
              aria-hidden="true"
            ></div>
          </dialog>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    // Re-render only if message data or callbacks change
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.edited === nextProps.message.edited &&
      prevProps.message.edited_at === nextProps.message.edited_at &&
      prevProps.message.deleted === nextProps.message.deleted &&
      prevProps.message.read_at === nextProps.message.read_at &&
      prevProps.message.delivered_at === nextProps.message.delivered_at &&
      prevProps.message.decryptionError === nextProps.message.decryptionError &&
      prevProps.className === nextProps.className &&
      prevProps.onEdit === nextProps.onEdit &&
      prevProps.onDelete === nextProps.onDelete
    );
  }
);

export default MessageBubble;
