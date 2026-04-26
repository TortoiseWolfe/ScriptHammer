'use client';

/**
 * useConversationRealtime Hook
 * Task: T112
 *
 * Manages real-time message subscriptions and state for a conversation.
 * Subscribes to new messages, message updates, and handles pagination.
 *
 * Features:
 * - Real-time message delivery (<500ms)
 * - Automatic decryption of new messages
 * - Message update handling (edits/deletes)
 * - Pagination support
 * - Automatic cleanup on unmount
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createLogger } from '@/lib/logger';
import { realtimeService } from '@/lib/messaging/realtime';
import { messageService } from '@/services/messaging/message-service';
import { encryptionService } from '@/lib/messaging/encryption';
import { keyManagementService } from '@/services/messaging/key-service';
import type {
  DecryptedMessage,
  Message,
  UseConversationRealtimeReturn,
} from '@/types/messaging';
import { createClient } from '@/lib/supabase/client';
import { createMessagingClient } from '@/lib/supabase/messaging-client';

const logger = createLogger('hooks:conversationRealtime');

export function useConversationRealtime(
  conversationId: string
): UseConversationRealtimeReturn {
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  // Stable Supabase client for the hook's lifetime — calling createClient()
  // on every render produces a new identity, invalidates dep arrays, and
  // forces realtime subscription teardown/recreate cycles. Root cause of
  // the ConversationView regression chain (revert adae629).
  const supabase = useMemo(() => createClient(), []);

  // Use ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Use ref to prevent race condition in loadMore
  const loadingRef = useRef(false);

  /**
   * Decrypt a single message
   */
  const decryptSingleMessage = useCallback(
    async (msg: Message): Promise<DecryptedMessage | null> => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return null;

        // Get conversation details
        const msgClient = createMessagingClient(supabase);
        const result = await msgClient
          .from('conversations')
          .select('participant_1_id, participant_2_id')
          .eq('id', conversationId)
          .maybeSingle();

        const conversation = result.data as {
          participant_1_id: string;
          participant_2_id: string;
        } | null;

        if (!conversation) return null;

        // Determine other participant
        const otherParticipantId =
          conversation.participant_1_id === user.id
            ? conversation.participant_2_id
            : conversation.participant_1_id;

        // Get private key (non-extractable CryptoKey, no JWK import needed)
        const privateKey = await encryptionService.getPrivateKey(user.id);
        if (!privateKey) return null;

        // Get other participant's public key
        const otherPublicKey =
          await keyManagementService.getUserPublicKey(otherParticipantId);
        if (!otherPublicKey) return null;

        const otherPublicKeyCrypto = await crypto.subtle.importKey(
          'jwk',
          otherPublicKey,
          { name: 'ECDH', namedCurve: 'P-256' },
          false,
          []
        );

        // Derive shared secret
        const sharedSecret = await encryptionService.deriveSharedSecret(
          privateKey,
          otherPublicKeyCrypto
        );

        // Decrypt message
        const content = await encryptionService.decryptMessage(
          msg.encrypted_content,
          msg.initialization_vector,
          sharedSecret
        );

        // Get sender profile
        const { data: senderProfile } = await supabase
          .from('user_profiles')
          .select('username, display_name')
          .eq('id', msg.sender_id)
          .maybeSingle();

        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_id: msg.sender_id,
          content,
          sequence_number: msg.sequence_number,
          deleted: msg.deleted,
          edited: msg.edited,
          edited_at: msg.edited_at,
          delivered_at: msg.delivered_at,
          read_at: msg.read_at,
          created_at: msg.created_at,
          isOwn: msg.sender_id === user.id,
          senderName:
            senderProfile?.display_name || senderProfile?.username || 'Unknown',
        };
      } catch (err) {
        logger.error('Failed to decrypt message', { error: err });
        return null;
      }
    },
    [conversationId, supabase]
  );

  /**
   * Load initial messages
   */
  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const result = await messageService.getMessageHistory(conversationId);

      if (isMountedRef.current) {
        setMessages(result.messages);
        setHasMore(result.has_more);
        setCursor(result.cursor);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err as Error);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [conversationId]);

  /**
   * Load more messages (pagination)
   */
  const loadMore = useCallback(async () => {
    // Check both state and ref to prevent race condition
    if (!hasMore || loading || loadingRef.current) return;

    loadingRef.current = true;
    try {
      setLoading(true);
      const result = await messageService.getMessageHistory(
        conversationId,
        cursor,
        50
      );

      if (isMountedRef.current) {
        // Prepend older messages
        setMessages((prev) => [...result.messages, ...prev]);
        setHasMore(result.has_more);
        setCursor(result.cursor);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err as Error);
      }
    } finally {
      loadingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [conversationId, cursor, hasMore, loading]);

  /**
   * Send a new message
   */
  const sendMessage = useCallback(
    async (content: string) => {
      try {
        await messageService.sendMessage({
          conversation_id: conversationId,
          content,
        });
        // Message will be added via real-time subscription
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [conversationId]
  );

  /**
   * Edit a message within 15-minute window
   * Task: T105 (integration)
   */
  const editMessage = useCallback(
    async (message_id: string, new_content: string) => {
      try {
        await messageService.editMessage({
          message_id,
          new_content,
        });
        // Message will be updated via real-time subscription
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    []
  );

  /**
   * Delete a message within 15-minute window
   * Task: T106 (integration)
   */
  const deleteMessage = useCallback(async (message_id: string) => {
    try {
      await messageService.deleteMessage(message_id);
      // Message will be updated via real-time subscription
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  // Track last Realtime event time for polling fallback
  const lastRealtimeEventRef = useRef(0);

  /**
   * Subscribe to real-time messages and updates
   */
  useEffect(() => {
    isMountedRef.current = true;

    // Load initial messages
    loadMessages();

    // Subscribe to new messages
    const unsubscribeMessages = realtimeService.subscribeToMessages(
      conversationId,
      async (message) => {
        lastRealtimeEventRef.current = Date.now();
        const decrypted = await decryptSingleMessage(message);
        if (decrypted && isMountedRef.current) {
          setMessages((prev) => [...prev, decrypted]);
        }
      },
      undefined, // onReconnect
      () => {
        // Signal message subscription readiness via DOM attribute (used by E2E tests)
        if (typeof document !== 'undefined' && conversationId) {
          document.body.setAttribute(
            'data-messages-subscribed',
            conversationId
          );
        }
      }
    );

    // Subscribe to message updates (edits/deletes)
    const unsubscribeUpdates = realtimeService.subscribeToMessageUpdates(
      conversationId,
      async (newMessage, oldMessage) => {
        lastRealtimeEventRef.current = Date.now();
        const decrypted = await decryptSingleMessage(newMessage);
        if (decrypted && isMountedRef.current) {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === decrypted.id ? decrypted : msg))
          );
        }
      }
    );

    // Polling fallback: Supabase Realtime on free tier can silently drop
    // messages under connection contention. Re-fetch every 10s when
    // Realtime hasn't delivered anything recently.
    const POLL_INTERVAL_MS = 10_000;
    const pollTimer = setInterval(() => {
      if (!isMountedRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      if (Date.now() - lastRealtimeEventRef.current < POLL_INTERVAL_MS) return;

      logger.debug('Polling fallback — refetching messages');
      loadMessages();
    }, POLL_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      unsubscribeMessages();
      unsubscribeUpdates();
      clearInterval(pollTimer);
      realtimeService.unsubscribeFromConversation(conversationId);
      if (typeof document !== 'undefined') {
        document.body.removeAttribute('data-messages-subscribed');
      }
    };
  }, [conversationId, loadMessages, decryptSingleMessage]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    editMessage,
    deleteMessage,
    loadMore,
    hasMore,
  };
}
