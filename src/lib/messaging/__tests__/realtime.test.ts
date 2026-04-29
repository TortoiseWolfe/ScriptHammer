/**
 * Unit Tests for RealtimeService
 * Task: T120
 *
 * Tests real-time message delivery, typing indicators, and subscription management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RealtimeService } from '../realtime';
import type { Message, TypingIndicator } from '@/types/messaging';

// Mock Supabase client
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  unsubscribe: vi.fn(),
};

const mockSupabase = {
  channel: vi.fn(() => mockChannel),
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      })
    ),
  },
  from: vi.fn(() => ({
    upsert: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      })),
    })),
  })),
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

describe('RealtimeService', () => {
  let service: RealtimeService;
  const conversationId = 'test-conversation-id';

  beforeEach(() => {
    service = new RealtimeService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('subscribeToMessages', () => {
    it('should subscribe to new messages on INSERT events', () => {
      const callback = vi.fn();

      service.subscribeToMessages(conversationId, callback);

      expect(mockSupabase.channel).toHaveBeenCalledWith(
        `messages:${conversationId}`
      );
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should call callback when new message arrives', () => {
      const callback = vi.fn();
      let insertHandler: (payload: any) => void;

      mockChannel.on.mockImplementation((event, config, handler) => {
        if (config.event === 'INSERT') {
          insertHandler = handler;
        }
        return mockChannel;
      });

      service.subscribeToMessages(conversationId, callback);

      const mockMessage: Message = {
        id: 'msg-1',
        conversation_id: conversationId,
        sender_id: 'user-1',
        encrypted_content: 'encrypted',
        initialization_vector: 'iv',
        sequence_number: 1,
        deleted: false,
        edited: false,
        edited_at: null,
        delivered_at: new Date().toISOString(),
        read_at: null,
        created_at: new Date().toISOString(),
        key_version: 1,
        is_system_message: false,
        system_message_type: null,
      };

      insertHandler!({ new: mockMessage });

      expect(callback).toHaveBeenCalledWith(mockMessage);
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();

      const unsubscribe = service.subscribeToMessages(conversationId, callback);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();

      expect(mockChannel.unsubscribe).toHaveBeenCalled();
    });

    describe('handshake catch-up SELECT (#57)', () => {
      // Simulates Supabase's subscribe(callback) by capturing the status
      // callback and letting the test fire 'SUBSCRIBED' manually so we can
      // assert on what runs after the ack.
      function captureSubscribeCallback() {
        let captured: ((status: string) => Promise<void> | void) | null = null;
        mockChannel.subscribe.mockImplementation(
          (cb: (status: string) => Promise<void> | void) => {
            captured = cb;
            return mockChannel;
          }
        );
        return () => captured!;
      }

      function mockMessagesSelect(rows: Message[], error: Error | null = null) {
        const order = vi.fn(() => Promise.resolve({ data: rows, error }));
        const gte = vi.fn(() => ({ order }));
        const eq = vi.fn(() => ({ gte }));
        const select = vi.fn(() => ({ eq }));
        // Override the .from() mock for this test only. Cast to `any` to
        // bypass the original no-arg signature on mockSupabase.from — the
        // catch-up call passes 'messages' and we need to branch on it.
        (mockSupabase as { from: unknown }).from = vi.fn((table: string) => {
          if (table === 'messages') {
            return { select } as never;
          }
          // Fall back to the default upsert/delete shape for typing_indicators etc.
          return {
            upsert: vi.fn(() => Promise.resolve({ data: {}, error: null })),
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ data: {}, error: null })),
              })),
            })),
          } as never;
        });
        return { select, eq, gte, order };
      }

      it('runs catch-up SELECT after first SUBSCRIBED and passes results to onSubscribed', async () => {
        const onSubscribed = vi.fn();
        const callback = vi.fn();
        const getSubscribeCb = captureSubscribeCallback();

        const retroactive: Message[] = [
          {
            id: 'missed-1',
            conversation_id: conversationId,
            sender_id: 'user-1',
            encrypted_content: 'enc',
            initialization_vector: 'iv',
            sequence_number: 1,
            deleted: false,
            edited: false,
            edited_at: null,
            delivered_at: new Date().toISOString(),
            read_at: null,
            created_at: new Date().toISOString(),
            key_version: 1,
            is_system_message: false,
            system_message_type: null,
          },
        ];
        const { select, eq, gte } = mockMessagesSelect(retroactive);

        service.subscribeToMessages(
          conversationId,
          callback,
          undefined,
          onSubscribed
        );

        // Fire the subscribed callback as Supabase would once the channel acks.
        await getSubscribeCb()('SUBSCRIBED');

        expect(select).toHaveBeenCalledWith('*');
        expect(eq).toHaveBeenCalledWith('conversation_id', conversationId);
        // gte called with `created_at` and an ISO timestamp
        expect(gte).toHaveBeenCalledWith('created_at', expect.any(String));
        expect(onSubscribed).toHaveBeenCalledWith(retroactive);
      });

      it('does not re-run catch-up on reconnect (only first SUBSCRIBED)', async () => {
        const onSubscribed = vi.fn();
        const onReconnect = vi.fn();
        const callback = vi.fn();
        const getSubscribeCb = captureSubscribeCallback();

        const { select } = mockMessagesSelect([]);

        service.subscribeToMessages(
          conversationId,
          callback,
          onReconnect,
          onSubscribed
        );

        // First SUBSCRIBED — catch-up runs
        await getSubscribeCb()('SUBSCRIBED');
        // Second SUBSCRIBED — reconnect path, NOT catch-up
        await getSubscribeCb()('SUBSCRIBED');

        // Catch-up SELECT only ran once
        expect(select).toHaveBeenCalledTimes(1);
        // onSubscribed only fired once; onReconnect fired the second time
        expect(onSubscribed).toHaveBeenCalledTimes(1);
        expect(onReconnect).toHaveBeenCalledTimes(1);
      });

      it('passes empty array to onSubscribed when catch-up errors (best-effort)', async () => {
        const onSubscribed = vi.fn();
        const callback = vi.fn();
        const getSubscribeCb = captureSubscribeCallback();

        mockMessagesSelect([], new Error('select failed'));

        service.subscribeToMessages(
          conversationId,
          callback,
          undefined,
          onSubscribed
        );

        await getSubscribeCb()('SUBSCRIBED');

        // onSubscribed still fires; with empty array on error so consumer can
        // proceed (signal subscription readiness, mark E2E flag, etc.).
        expect(onSubscribed).toHaveBeenCalledWith([]);
      });

      it('passes empty array when no messages match the catch-up window', async () => {
        const onSubscribed = vi.fn();
        const callback = vi.fn();
        const getSubscribeCb = captureSubscribeCallback();

        mockMessagesSelect([]);

        service.subscribeToMessages(
          conversationId,
          callback,
          undefined,
          onSubscribed
        );

        await getSubscribeCb()('SUBSCRIBED');

        expect(onSubscribed).toHaveBeenCalledWith([]);
      });

      it('does not call onSubscribed when not provided (back-compat)', async () => {
        const callback = vi.fn();
        const getSubscribeCb = captureSubscribeCallback();

        const { select } = mockMessagesSelect([]);

        // No onSubscribed callback — catch-up SELECT skipped (saves a query)
        service.subscribeToMessages(conversationId, callback);

        await getSubscribeCb()('SUBSCRIBED');

        expect(select).not.toHaveBeenCalled();
      });
    });
  });

  describe('subscribeToMessageUpdates', () => {
    it('should subscribe to message updates on UPDATE events', () => {
      const callback = vi.fn();

      service.subscribeToMessageUpdates(conversationId, callback);

      expect(mockSupabase.channel).toHaveBeenCalledWith(
        `message-updates:${conversationId}`
      );
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        expect.any(Function)
      );
    });

    it('should call callback with new and old message on update', () => {
      const callback = vi.fn();
      let updateHandler: (payload: any) => void;

      mockChannel.on.mockImplementation((event, config, handler) => {
        if (config.event === 'UPDATE') {
          updateHandler = handler;
        }
        return mockChannel;
      });

      service.subscribeToMessageUpdates(conversationId, callback);

      const oldMessage: Message = {
        id: 'msg-1',
        conversation_id: conversationId,
        sender_id: 'user-1',
        encrypted_content: 'old-encrypted',
        initialization_vector: 'iv',
        sequence_number: 1,
        deleted: false,
        edited: false,
        edited_at: null,
        delivered_at: new Date().toISOString(),
        read_at: null,
        created_at: new Date().toISOString(),
        key_version: 1,
        is_system_message: false,
        system_message_type: null,
      };

      const newMessage: Message = {
        ...oldMessage,
        encrypted_content: 'new-encrypted',
        edited: true,
        edited_at: new Date().toISOString(),
      };

      updateHandler!({ new: newMessage, old: oldMessage });

      expect(callback).toHaveBeenCalledWith(newMessage, oldMessage);
    });
  });

  describe('subscribeToTypingIndicators', () => {
    it('should subscribe to all typing indicator events', () => {
      const callback = vi.fn();

      service.subscribeToTypingIndicators(conversationId, callback);

      expect(mockSupabase.channel).toHaveBeenCalledWith(
        `typing:${conversationId}`
      );
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        expect.any(Function)
      );
    });

    it('should call callback when user starts typing', () => {
      const callback = vi.fn();
      let typingHandler: (payload: any) => void;

      mockChannel.on.mockImplementation((event, config, handler) => {
        if (config.table === 'typing_indicators') {
          typingHandler = handler;
        }
        return mockChannel;
      });

      service.subscribeToTypingIndicators(conversationId, callback);

      const indicator: TypingIndicator = {
        id: 'indicator-1',
        conversation_id: conversationId,
        user_id: 'user-2',
        is_typing: true,
        updated_at: new Date().toISOString(),
      };

      typingHandler!({ new: indicator, eventType: 'INSERT' });

      expect(callback).toHaveBeenCalledWith('user-2', true);
    });

    it('should call callback when user stops typing (DELETE event)', () => {
      const callback = vi.fn();
      let typingHandler: (payload: any) => void;

      mockChannel.on.mockImplementation((event, config, handler) => {
        if (config.table === 'typing_indicators') {
          typingHandler = handler;
        }
        return mockChannel;
      });

      service.subscribeToTypingIndicators(conversationId, callback);

      const indicator: TypingIndicator = {
        id: 'indicator-1',
        conversation_id: conversationId,
        user_id: 'user-2',
        is_typing: false,
        updated_at: new Date().toISOString(),
      };

      typingHandler!({ old: indicator, eventType: 'DELETE' });

      expect(callback).toHaveBeenCalledWith('user-2', false);
    });
  });

  describe('setTypingStatus', () => {
    it('should debounce typing status updates by 1 second', async () => {
      vi.useFakeTimers();

      await service.setTypingStatus(conversationId, true);

      // Should not call database immediately
      expect(mockSupabase.from).not.toHaveBeenCalled();

      // Fast-forward 1 second
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockSupabase.from).toHaveBeenCalledWith('typing_indicators');

      vi.useRealTimers();
    });

    it('should immediately clear typing status when isTyping=false', async () => {
      await service.setTypingStatus(conversationId, false);

      expect(mockSupabase.from).toHaveBeenCalledWith('typing_indicators');
    });

    it('should handle authentication errors silently', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null } as any,
        error: null as any, // Type override for test
      });

      // Should not throw
      await expect(
        service.setTypingStatus(conversationId, true)
      ).resolves.toBeUndefined();
    });
  });

  describe('unsubscribeFromConversation', () => {
    it('should unsubscribe from all conversation channels', () => {
      const callback = vi.fn();

      service.subscribeToMessages(conversationId, callback);
      service.subscribeToMessageUpdates(conversationId, callback);
      service.subscribeToTypingIndicators(conversationId, callback);

      service.unsubscribeFromConversation(conversationId);

      // Should unsubscribe 3 times (messages, updates, typing)
      expect(mockChannel.unsubscribe).toHaveBeenCalledTimes(3);
    });

    it('should clear pending typing timers', async () => {
      vi.useFakeTimers();

      await service.setTypingStatus(conversationId, true);

      service.unsubscribeFromConversation(conversationId);

      // Fast-forward past debounce
      vi.advanceTimersByTime(1000);

      // Database should not be called (timer was cleared)
      expect(mockSupabase.from).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('cleanup', () => {
    it('should unsubscribe all channels and clear all timers', async () => {
      vi.useFakeTimers();

      const callback = vi.fn();
      service.subscribeToMessages('conv-1', callback);
      service.subscribeToMessages('conv-2', callback);
      await service.setTypingStatus('conv-1', true);

      service.cleanup();

      expect(mockChannel.unsubscribe).toHaveBeenCalledTimes(2);

      // Fast-forward past debounce
      vi.advanceTimersByTime(1000);

      // Database should not be called (timers cleared)
      expect(mockSupabase.from).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
