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
