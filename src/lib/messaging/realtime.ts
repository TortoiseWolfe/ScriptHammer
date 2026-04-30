/**
 * Realtime Service for Messaging System
 * Tasks: T100-T107
 *
 * Implements real-time message delivery, typing indicators, and presence via Supabase Realtime.
 * Uses WebSocket subscriptions for <500ms message delivery guarantee.
 *
 * Key Features:
 * - Subscribe to new messages (INSERT events)
 * - Subscribe to message updates (UPDATE events for edits/deletes)
 * - Subscribe to typing indicators (INSERT/UPDATE/DELETE events)
 * - Debounced typing status updates (1s typing, 5s auto-expire)
 * - Automatic cleanup on unmount
 */

import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Message, TypingIndicator } from '@/types/messaging';
import { AuthenticationError } from '@/types/messaging';
import { createLogger } from '@/lib/logger';
import { createMessagingClient } from '@/lib/supabase/messaging-client';

const logger = createLogger('messaging:realtime');

export class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private typingTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Subscribe to new messages in a conversation
   * Task: T101
   *
   * Listens for INSERT events on the messages table filtered by conversation_id.
   * Delivers new messages to the callback within <500ms (Supabase Realtime guarantee).
   *
   * Handshake catch-up (#57): Supabase's `.subscribe()` callback fires with
   * status='SUBSCRIBED' only after the server acks the channel. Between
   * channel creation and ack there's a ~50-200ms window during which a
   * postgres INSERT event can broadcast and be silently dropped — page2's
   * handler isn't registered yet. To plug that gap we run a catch-up SELECT
   * once the subscription is confirmed: any messages with
   * `created_at >= channelCreatedAt` that the realtime stream might have
   * missed are surfaced through `onSubscribed(retroactive)`. The caller is
   * responsible for de-duplicating against any messages already loaded via
   * the initial fetch (merge by id).
   *
   * @param conversation_id - Conversation UUID to subscribe to
   * @param callback - Function called when new message arrives
   * @param onReconnect - Optional callback when channel reconnects after disconnect
   * @param onSubscribed - Optional callback fired once when the initial subscription
   *   acks. Receives retroactive messages found by the catch-up SELECT.
   * @returns Unsubscribe function to clean up subscription
   */
  subscribeToMessages(
    conversation_id: string,
    callback: (message: Message) => void,
    onReconnect?: () => void,
    onSubscribed?: (retroactive: Message[]) => void
  ): () => void {
    const supabase = createClient();
    const channelName = `messages:${conversation_id}`;
    // ISO timestamp captured BEFORE channel creation. Any message INSERT'd
    // at or after this moment is a candidate for catch-up — it could have
    // broadcast during the subscribe handshake.
    const channelCreatedAt = new Date().toISOString();

    // Remove existing channel if present
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
      this.channels.delete(channelName);
    }

    let wasSubscribed = false;

    // DIAGNOSTIC (#57): log channel creation + every status from subscribe()
    // until we know why E2E messaging shards never see SUBSCRIBED. Remove
    // once the root cause is identified and a fix is verified.
    logger.warn('[#57 DIAG] Creating realtime channel', {
      conversation_id,
      channelName,
      channelCreatedAt,
    });

    // Create new channel
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation_id}`,
        },
        (payload) => {
          callback(payload.new as Message);
        }
      )
      .subscribe(async (status, err) => {
        // DIAGNOSTIC (#57): log every status, not just SUBSCRIBED. Supabase
        // can also fire CHANNEL_ERROR, TIMED_OUT, CLOSED — the existing code
        // silently dropped those so we had no visibility into why E2E
        // shards never see SUBSCRIBED.
        logger.warn('[#57 DIAG] subscribe status', {
          conversation_id,
          channelName,
          status,
          errMessage: err instanceof Error ? err.message : err,
          msSinceCreate: Date.now() - new Date(channelCreatedAt).getTime(),
        });

        if (status === 'SUBSCRIBED') {
          if (wasSubscribed && onReconnect) {
            logger.debug('Channel reconnected, triggering catch-up', {
              conversation_id,
            });
            onReconnect();
            wasSubscribed = true;
            return;
          }

          if (!wasSubscribed) {
            wasSubscribed = true;

            if (onSubscribed) {
              // Catch-up SELECT: pull any messages INSERT'd between
              // channelCreatedAt and now that the realtime handshake might
              // have raced. The caller (useConversationRealtime) merges
              // these by id, so duplicates from the initial loadMessages()
              // or from realtime events that DID arrive are harmless.
              try {
                const { data: missed, error } = await supabase
                  .from('messages')
                  .select('*')
                  .eq('conversation_id', conversation_id)
                  .gte('created_at', channelCreatedAt)
                  .order('created_at', { ascending: true });

                if (error) {
                  logger.warn('Catch-up SELECT failed; skipping', {
                    conversation_id,
                    error: error.message,
                  });
                  onSubscribed([]);
                  return;
                }

                onSubscribed((missed ?? []) as Message[]);
              } catch (err) {
                // Catch-up is best-effort. The polling fallback in
                // useConversationRealtime will still fire if the message
                // truly never arrives.
                logger.warn('Catch-up SELECT threw; skipping', {
                  conversation_id,
                  err,
                });
                onSubscribed([]);
              }
            }
          }
        }
      });

    this.channels.set(channelName, channel);

    // Return unsubscribe function
    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  /**
   * Subscribe to message updates (edits/deletes) in a conversation
   * Task: T102
   *
   * Listens for UPDATE events on the messages table.
   * Used for real-time display of edited messages and deletions.
   *
   * @param conversation_id - Conversation UUID to subscribe to
   * @param callback - Function called when message is updated (receives new and old message)
   * @returns Unsubscribe function to clean up subscription
   */
  subscribeToMessageUpdates(
    conversation_id: string,
    callback: (message: Message, oldMessage: Message) => void
  ): () => void {
    const supabase = createClient();
    const channelName = `message-updates:${conversation_id}`;

    // Remove existing channel if present
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
      this.channels.delete(channelName);
    }

    // Create new channel
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation_id}`,
        },
        (payload) => {
          callback(payload.new as Message, payload.old as Message);
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);

    // Return unsubscribe function
    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  /**
   * Subscribe to typing indicators in a conversation
   * Task: T103
   *
   * Listens for INSERT, UPDATE, and DELETE events on typing_indicators table.
   * Indicators auto-expire after 5 seconds if not updated.
   *
   * @param conversation_id - Conversation UUID to subscribe to
   * @param callback - Function called when typing status changes (userId, isTyping)
   * @returns Unsubscribe function to clean up subscription
   */
  subscribeToTypingIndicators(
    conversation_id: string,
    callback: (userId: string, isTyping: boolean) => void
  ): () => void {
    const supabase = createClient();
    const channelName = `typing:${conversation_id}`;

    // Remove existing channel if present
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
      this.channels.delete(channelName);
    }

    // Create new channel for all typing indicator events
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversation_id}`,
        },
        (payload) => {
          const indicator = payload.new as TypingIndicator;

          if (payload.eventType === 'DELETE') {
            // User stopped typing (expired or explicit stop)
            const oldIndicator = payload.old as TypingIndicator;
            callback(oldIndicator.user_id, false);
          } else {
            // INSERT or UPDATE - typing status changed
            callback(indicator.user_id, indicator.is_typing);
          }
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);

    // Return unsubscribe function
    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  /**
   * Update own typing status
   * Tasks: T104, T106, T107
   *
   * UPSERTs typing indicator with debounce logic:
   * - Only sends update after 1 second of typing activity (debounce)
   * - Automatically expires if no update for 5 seconds (database trigger)
   * - Silent failures (errors logged but not thrown to avoid disrupting UX)
   *
   * @param conversation_id - Conversation UUID
   * @param isTyping - Whether currently typing
   */
  async setTypingStatus(
    conversation_id: string,
    isTyping: boolean
  ): Promise<void> {
    const supabase = createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      // Silent failure - don't disrupt typing UX
      logger.warn('Cannot set typing status: not authenticated');
      return;
    }

    const timerKey = `${conversation_id}:${user.id}`;

    // Clear existing timer
    const existingTimer = this.typingTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.typingTimers.delete(timerKey);
    }

    if (isTyping) {
      // Debounce: Wait 1 second before sending typing indicator
      const timer = setTimeout(async () => {
        try {
          const msgClient = createMessagingClient(supabase);
          // UPSERT typing indicator
          const typingIndicator = {
            conversation_id,
            user_id: user.id,
            is_typing: true,
            updated_at: new Date().toISOString(),
          };
          await msgClient
            .from('typing_indicators')
            .upsert(typingIndicator as any, {
              onConflict: 'conversation_id,user_id',
            });
        } catch (error) {
          // Silent failure - log but don't throw
          logger.error('Failed to set typing status', { error });
        } finally {
          this.typingTimers.delete(timerKey);
        }
      }, 1000); // 1 second debounce

      this.typingTimers.set(timerKey, timer);
    } else {
      // User stopped typing - immediately remove indicator
      try {
        const msgClient = createMessagingClient(supabase);
        await msgClient
          .from('typing_indicators')
          .delete()
          .eq('conversation_id', conversation_id)
          .eq('user_id', user.id);
      } catch (error) {
        // Silent failure - log but don't throw
        logger.error('Failed to clear typing status', { error });
      }
    }
  }

  /**
   * Unsubscribe from all subscriptions for a conversation
   * Task: T105
   *
   * Cleans up all active channels for a conversation:
   * - Messages subscription
   * - Message updates subscription
   * - Typing indicators subscription
   *
   * Call this on component unmount to prevent memory leaks.
   *
   * @param conversation_id - Conversation UUID
   */
  unsubscribeFromConversation(conversation_id: string): void {
    const channelPrefixes = [
      `messages:${conversation_id}`,
      `message-updates:${conversation_id}`,
      `typing:${conversation_id}`,
    ];

    channelPrefixes.forEach((channelName) => {
      const channel = this.channels.get(channelName);
      if (channel) {
        channel.unsubscribe();
        this.channels.delete(channelName);
      }
    });

    // Clear any pending typing timers for this conversation
    const timerKeys = Array.from(this.typingTimers.keys()).filter((key) =>
      key.startsWith(`${conversation_id}:`)
    );
    timerKeys.forEach((key) => {
      const timer = this.typingTimers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.typingTimers.delete(key);
      }
    });
  }

  /**
   * Cleanup all subscriptions and timers
   * Call this on app unmount or user sign-out
   */
  cleanup(): void {
    // Unsubscribe all channels
    this.channels.forEach((channel) => {
      channel.unsubscribe();
    });
    this.channels.clear();

    // Clear all typing timers
    this.typingTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.typingTimers.clear();
  }
}

// Export singleton instance
export const realtimeService = new RealtimeService();
