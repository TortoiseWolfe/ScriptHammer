'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ChatWindow from '@/components/organisms/ChatWindow';
import ErrorBoundary from '@/components/ErrorBoundary';
import { messageService } from '@/services/messaging/message-service';
import { usePendingMessages } from '@/hooks/usePendingMessages';
import { createLogger } from '@/lib/logger/logger';
import type { DecryptedMessage } from '@/types/messaging';

const logger = createLogger('organisms:ConversationView');

export interface ConversationViewProps {
  /** Conversation to display. The component owns all message state internally;
   *  changing this prop resets and reloads. */
  conversationId: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ConversationView — self-contained conversation surface.
 *
 * Extracted from app/messages/page.tsx to keep the page under the repo's
 * 150-line budget. Owns the full conversation lifecycle: participant
 * resolution, paginated history load, send/edit/delete handlers, optimistic
 * queued-message bubbles, and the error banner. The page supplies only a
 * conversationId; everything below that boundary lives here.
 *
 * The send path and offline queue wiring are unchanged from the page — this
 * is a relocation, not a rewrite. `usePendingMessages` still drives the
 * optimistic UI, `messageService.sendMessage` still queues on failure.
 *
 * @category organisms
 */
export default function ConversationView({
  conversationId,
  className = '',
}: ConversationViewProps) {
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState('Unknown User');

  // ── Participant resolution ─────────────────────────────────────────
  // Two-hop query: conversations → user_profiles. Dynamic import keeps
  // the Supabase client out of the initial bundle.
  const loadConversationInfo = useCallback(async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { createMessagingClient } = await import(
        '@/lib/supabase/messaging-client'
      );
      const supabase = createClient();
      const msgClient = createMessagingClient(supabase);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const result = await msgClient
        .from('conversations')
        .select('participant_1_id, participant_2_id')
        .eq('id', conversationId)
        .single();

      const conversation = result.data as {
        participant_1_id: string;
        participant_2_id: string;
      } | null;

      if (!conversation) {
        logger.warn('Conversation not found', { conversationId });
        return;
      }

      const otherParticipantId =
        conversation.participant_1_id === user.id
          ? conversation.participant_2_id
          : conversation.participant_1_id;

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('username, display_name')
        .eq('id', otherParticipantId)
        .maybeSingle();

      if (profileError) {
        logger.warn('Profile query error', { error: profileError.message });
        setParticipantName('Unknown User');
        return;
      }

      setParticipantName(
        profile?.display_name || profile?.username || 'Unknown User'
      );
    } catch (err) {
      logger.warn('Error loading participant info', { error: err });
      setParticipantName('Unknown User');
    }
  }, [conversationId]);

  // ── Message history with cursor pagination ─────────────────────────
  const loadMessages = useCallback(
    async (loadMore = false) => {
      try {
        setLoading(true);
        setError(null);

        const result = await messageService.getMessageHistory(
          conversationId,
          loadMore ? cursor : null,
          50
        );

        if (loadMore) {
          setMessages((prev) => [...result.messages, ...prev]);
        } else {
          setMessages(result.messages);
          // Opportunistic: if we have messages, use the first non-own
          // sender name as participant fallback (covers the race where
          // loadConversationInfo hasn't resolved yet).
          const firstOtherMessage = result.messages.find((m) => !m.isOwn);
          if (firstOtherMessage) {
            setParticipantName(firstOtherMessage.senderName);
          }
        }

        // Delivery receipt: fires the moment the recipient's client has the
        // row in hand. The sender's INSERT left delivered_at NULL — this is
        // the first write to it. Deleted rows are included: a tombstone still
        // reached the recipient, so it was delivered. Fire-and-forget; the
        // .is('delivered_at', null) guard in markAsDelivered makes a retry
        // on next load a no-op.
        const undelivered = result.messages.filter(
          (m) => !m.isOwn && !m.delivered_at
        );
        if (undelivered.length > 0) {
          messageService
            .markAsDelivered(undelivered.map((m) => m.id))
            .catch(() => {});
        }

        // Read receipt: fires on open, separately from delivery. Excludes
        // deleted rows — a [Message deleted] placeholder isn't something you
        // "read", and stamping read_at on it would tell the sender their
        // deleted content was seen, which is misleading. On initial open
        // the two stamps land within milliseconds of each other; the
        // distinction emerges when useReadReceipts fires read_at later for
        // rows that loaded off-screen and only scrolled into view afterward.
        const unreadMessages = result.messages.filter(
          (m) => !m.isOwn && !m.deleted && !m.read_at
        );
        if (unreadMessages.length > 0) {
          messageService
            .markAsRead(unreadMessages.map((m) => m.id))
            .catch(() => {});
        }

        setHasMore(result.has_more);
        setCursor(result.cursor);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : 'Failed to load messages'
        );
      } finally {
        setLoading(false);
      }
    },
    // cursor is read fresh via closure for the loadMore=true path but we
    // deliberately don't depend on it — a cursor change alone shouldn't
    // trigger a reload, only a conversationId change should.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId]
  );

  // Optimistic UI for queued outgoing messages. Plaintext is cached
  // session-only (the IndexedDB queue stores ciphertext). When the queue
  // poll detects a pending entry has synced, reload real messages so the
  // synced bubble replaces the pending one.
  const { pendingMessages, addPending, retryMessage } = usePendingMessages(
    conversationId,
    () => void loadMessages()
  );

  // ── Load on conversationId change ──────────────────────────────────
  // Chain info→messages so participant name is set before first render
  // of the message list (FR-019 from the original page).
  useEffect(() => {
    loadConversationInfo().then(() => loadMessages());
  }, [conversationId, loadConversationInfo, loadMessages]);

  // ── Handlers ───────────────────────────────────────────────────────
  const handleSendMessage = async (content: string) => {
    try {
      setSending(true);
      setError(null);

      const result = await messageService.sendMessage({
        conversation_id: conversationId,
        content,
      });

      if (result.queued) {
        // Offline OR send-failed-and-queued. Show the optimistic bubble.
        // The queue's auto-sync (on 'online' event / poll) will eventually
        // deliver it; onSynced → loadMessages() swaps in the real one.
        addPending(result.message.id, content);
      } else {
        // Optimistically append the sent message so it appears immediately.
        // Supabase free tier can have read-after-write latency — an immediate
        // loadMessages() query may return stale results (empty if first message).
        // The background loadMessages() will eventually replace the optimistic
        // entry with the real decrypted version.
        const optimistic: DecryptedMessage = {
          id: result.message.id,
          conversation_id: result.message.conversation_id,
          sender_id: result.message.sender_id,
          content,
          sequence_number: result.message.sequence_number,
          deleted: false,
          edited: false,
          edited_at: null,
          delivered_at: null,
          read_at: null,
          created_at: result.message.created_at,
          isOwn: true,
          senderName: participantName,
        };
        setMessages((prev) => [...prev, optimistic]);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to send message. Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadMessages(true);
    }
  };

  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string): Promise<void> => {
      try {
        setError(null);
        await messageService.editMessage({
          message_id: messageId,
          new_content: newContent,
        });
        await loadMessages();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to edit message';
        logger.error('Edit message failed', { messageId, error: err });
        setError(message);
        throw err; // Re-throw so MessageBubble knows the operation failed
      }
    },
    [loadMessages]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string): Promise<void> => {
      try {
        setError(null);
        await messageService.deleteMessage(messageId);
        await loadMessages();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete message';
        logger.error('Delete message failed', { messageId, error: err });
        setError(message);
        throw err;
      }
    },
    [loadMessages]
  );

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden ${className}`}
      data-testid="conversation-view"
    >
      {error && (
        <div className="alert alert-info m-4 shrink-0" role="alert">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="h-6 w-6 shrink-0 stroke-current"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="btn btn-ghost btn-sm min-h-11"
          >
            Dismiss
          </button>
        </div>
      )}
      <ErrorBoundary level="component">
        <ChatWindow
          conversationId={conversationId}
          messages={messages}
          pendingMessages={pendingMessages}
          onRetryPending={retryMessage}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          loading={loading}
          sending={sending}
          participantName={participantName}
          className="min-h-0 flex-1"
        />
      </ErrorBoundary>
    </div>
  );
}
