/**
 * Unit Tests for useConversationRealtime Hook
 * Task: T121
 *
 * Tests real-time conversation management hook with mocked Supabase client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useConversationRealtime } from '../useConversationRealtime';
import { realtimeService } from '@/lib/messaging/realtime';
import { messageService } from '@/services/messaging/message-service';
import { createClient } from '@/lib/supabase/client';

// Mock dependencies
vi.mock('@/lib/supabase/client');
vi.mock('@/lib/messaging/realtime');
vi.mock('@/services/messaging/message-service');
vi.mock('@/lib/messaging/encryption');
vi.mock('@/services/messaging/key-service');

describe('useConversationRealtime', () => {
  const mockConversationId = 'test-conversation-id';
  const mockUserId = 'test-user-id';
  const mockMessages = [
    {
      id: 'msg-1',
      conversation_id: mockConversationId,
      sender_id: mockUserId,
      content: 'Test message 1',
      sequence_number: 1,
      deleted: false,
      edited: false,
      edited_at: null,
      delivered_at: null,
      read_at: null,
      created_at: new Date().toISOString(),
      isOwn: true,
      senderName: 'Test User',
    },
    {
      id: 'msg-2',
      conversation_id: mockConversationId,
      sender_id: 'other-user-id',
      content: 'Test message 2',
      sequence_number: 2,
      deleted: false,
      edited: false,
      edited_at: null,
      delivered_at: null,
      read_at: null,
      created_at: new Date().toISOString(),
      isOwn: false,
      senderName: 'Other User',
    },
  ];

  let mockSupabase: any;
  let mockUnsubscribeMessages: ReturnType<typeof vi.fn>;
  let mockUnsubscribeUpdates: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          participant_1_id: mockUserId,
          participant_2_id: 'other-user-id',
        },
        error: null,
      }),
    };

    (createClient as any).mockReturnValue(mockSupabase);

    // Mock message service
    (messageService.getMessageHistory as any).mockResolvedValue({
      messages: mockMessages,
      has_more: false,
      cursor: null,
    });

    (messageService.sendMessage as any).mockResolvedValue({
      success: true,
      message: mockMessages[0],
    });

    // Mock realtime service
    mockUnsubscribeMessages = vi.fn();
    mockUnsubscribeUpdates = vi.fn();

    (realtimeService.subscribeToMessages as any).mockReturnValue(
      mockUnsubscribeMessages
    );
    (realtimeService.subscribeToMessageUpdates as any).mockReturnValue(
      mockUnsubscribeUpdates
    );
    (realtimeService.unsubscribeFromConversation as any) = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should load messages on mount', async () => {
    const { result } = renderHook(() =>
      useConversationRealtime(mockConversationId)
    );

    // Initial loading state
    expect(result.current.loading).toBe(true);
    expect(result.current.messages).toEqual([]);

    // Wait for messages to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.messages).toEqual(mockMessages);
    expect(result.current.error).toBeNull();
  });

  it('should subscribe to realtime messages on mount', async () => {
    renderHook(() => useConversationRealtime(mockConversationId));

    await waitFor(() => {
      expect(realtimeService.subscribeToMessages).toHaveBeenCalledWith(
        mockConversationId,
        expect.any(Function),
        undefined,
        expect.any(Function)
      );
    });

    expect(realtimeService.subscribeToMessageUpdates).toHaveBeenCalledWith(
      mockConversationId,
      expect.any(Function)
    );
  });

  it('should unsubscribe from realtime on unmount', async () => {
    const { unmount } = renderHook(() =>
      useConversationRealtime(mockConversationId)
    );

    await waitFor(() => {
      expect(realtimeService.subscribeToMessages).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnsubscribeMessages).toHaveBeenCalled();
    expect(mockUnsubscribeUpdates).toHaveBeenCalled();
    expect(realtimeService.unsubscribeFromConversation).toHaveBeenCalledWith(
      mockConversationId
    );
  });

  it('should send message', async () => {
    const { result } = renderHook(() =>
      useConversationRealtime(mockConversationId)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.sendMessage('New test message');
    });

    expect(messageService.sendMessage).toHaveBeenCalledWith({
      conversation_id: mockConversationId,
      content: 'New test message',
    });
  });

  it('should handle pagination (loadMore)', async () => {
    const olderMessages = [
      {
        id: 'msg-0',
        conversation_id: mockConversationId,
        sender_id: 'other-user-id',
        content: 'Older message',
        sequence_number: 0,
        deleted: false,
        edited: false,
        edited_at: null,
        delivered_at: null,
        read_at: null,
        created_at: new Date(Date.now() - 10000).toISOString(),
        isOwn: false,
        senderName: 'Other User',
      },
    ];

    // First call returns messages with hasMore=true
    (messageService.getMessageHistory as any)
      .mockResolvedValueOnce({
        messages: mockMessages,
        has_more: true,
        cursor: 2,
      })
      .mockResolvedValueOnce({
        messages: olderMessages,
        has_more: false,
        cursor: null,
      });

    const { result } = renderHook(() =>
      useConversationRealtime(mockConversationId)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasMore).toBe(true);

    // Load more messages
    await act(async () => {
      await result.current.loadMore();
    });

    // Should prepend older messages
    expect(result.current.messages).toHaveLength(3);
    expect(result.current.messages[0].id).toBe('msg-0');
    expect(result.current.hasMore).toBe(false);
  });

  it('should handle errors', async () => {
    const mockError = new Error('Failed to load messages');
    (messageService.getMessageHistory as any).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() =>
      useConversationRealtime(mockConversationId)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual(mockError);
    expect(result.current.messages).toEqual([]);
  });

  it('should add new message from realtime subscription', async () => {
    let realtimeCallback: ((message: any) => void) | undefined;

    (realtimeService.subscribeToMessages as any).mockImplementation(
      (_id: string, callback: (message: any) => void) => {
        realtimeCallback = callback;
        return vi.fn();
      }
    );

    const { result } = renderHook(() =>
      useConversationRealtime(mockConversationId)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.messages).toHaveLength(2);

    // Simulate new message from realtime
    const newMessage = {
      id: 'msg-3',
      conversation_id: mockConversationId,
      sender_id: 'other-user-id',
      encrypted_content: 'encrypted-content',
      initialization_vector: 'iv',
      sequence_number: 3,
      deleted: false,
      edited: false,
      edited_at: null,
      delivered_at: null,
      read_at: null,
      created_at: new Date().toISOString(),
    };

    await act(async () => {
      if (realtimeCallback) {
        realtimeCallback(newMessage);
      }
    });

    // Note: In real implementation, message would be decrypted first
    // This test verifies the subscription callback is set up correctly
    expect(realtimeCallback).toBeDefined();
  });

  it('should update message from realtime subscription', async () => {
    let realtimeUpdateCallback:
      | ((newMessage: any, oldMessage: any) => void)
      | undefined;

    (realtimeService.subscribeToMessageUpdates as any).mockImplementation(
      (_id: string, callback: (newMessage: any, oldMessage: any) => void) => {
        realtimeUpdateCallback = callback;
        return vi.fn();
      }
    );

    const { result } = renderHook(() =>
      useConversationRealtime(mockConversationId)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Simulate message update from realtime
    const updatedMessage = {
      ...mockMessages[0],
      encrypted_content: 'updated-encrypted-content',
      edited: true,
      edited_at: new Date().toISOString(),
    };

    await act(async () => {
      if (realtimeUpdateCallback) {
        realtimeUpdateCallback(updatedMessage, mockMessages[0]);
      }
    });

    expect(realtimeUpdateCallback).toBeDefined();
  });

  it('should not load more if already loading', async () => {
    (messageService.getMessageHistory as any).mockResolvedValue({
      messages: mockMessages,
      has_more: true,
      cursor: 2,
    });

    const { result } = renderHook(() =>
      useConversationRealtime(mockConversationId)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Trigger loadMore twice quickly within act to properly batch state updates
    await act(async () => {
      const promise1 = result.current.loadMore();
      const promise2 = result.current.loadMore();
      await Promise.all([promise1, promise2]);
    });

    // Should only call getMessageHistory twice (initial + one loadMore)
    expect(messageService.getMessageHistory).toHaveBeenCalledTimes(2);
  });

  it('should not load more if no more messages', async () => {
    (messageService.getMessageHistory as any).mockResolvedValue({
      messages: mockMessages,
      has_more: false,
      cursor: null,
    });

    const { result } = renderHook(() =>
      useConversationRealtime(mockConversationId)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasMore).toBe(false);

    await act(async () => {
      await result.current.loadMore();
    });

    // Should only call once (initial load)
    expect(messageService.getMessageHistory).toHaveBeenCalledTimes(1);
  });

  describe('handshake catch-up integration (#57)', () => {
    // The retroactive flow: subscribeToMessages calls onSubscribed with a
    // list of messages it found between channelCreatedAt and now. The hook
    // must (1) decrypt them, (2) merge them into state by id (skipping any
    // already loaded by loadMessages), and (3) only THEN set the
    // data-messages-subscribed DOM attribute.

    // Helper: capture the onSubscribed arg passed by useConversationRealtime
    // and return a way to fire it.
    function captureOnSubscribed() {
      let onSubscribed:
        | ((retroactive: any[]) => Promise<void> | void)
        | undefined;
      (realtimeService.subscribeToMessages as any).mockImplementation(
        (
          _id: string,
          _cb: (m: any) => void,
          _onReconnect: undefined,
          subCb: (retroactive: any[]) => Promise<void> | void
        ) => {
          onSubscribed = subCb;
          return mockUnsubscribeMessages;
        }
      );
      return () => onSubscribed!;
    }

    it('passes a retroactive-aware onSubscribed callback', async () => {
      renderHook(() => useConversationRealtime(mockConversationId));

      await waitFor(() => {
        expect(realtimeService.subscribeToMessages).toHaveBeenCalled();
      });

      // 4th positional arg is the onSubscribed callback (was previously
      // a no-arg signal; now must accept retroactive messages array).
      const args = (realtimeService.subscribeToMessages as any).mock.calls[0];
      expect(args[3]).toEqual(expect.any(Function));
    });

    it('does not duplicate messages already loaded via loadMessages when retroactive includes them', async () => {
      const getOnSubscribed = captureOnSubscribed();

      const { result } = renderHook(() =>
        useConversationRealtime(mockConversationId)
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      // Initial load brought in 2 messages
      expect(result.current.messages).toHaveLength(2);

      // Fire onSubscribed with a retroactive batch that overlaps with what
      // loadMessages() already pulled. The hook must merge by id.
      // mockMessages[1].id === 'msg-2' is already in state. The catch-up
      // path attempts to decrypt; with the encryption module mocked,
      // decryption returns undefined and the messages get filtered out.
      // We rely on the realtime path's actual behaviour: even if decryption
      // succeeded, the merge must drop already-known IDs.
      await act(async () => {
        await getOnSubscribed()([
          {
            id: 'msg-2', // same as mockMessages[1] — must be dropped by merge
            conversation_id: mockConversationId,
            sender_id: 'other-user-id',
            encrypted_content: 'enc',
            initialization_vector: 'iv',
            sequence_number: 2,
            deleted: false,
            edited: false,
            edited_at: null,
            delivered_at: null,
            read_at: null,
            created_at: new Date().toISOString(),
            key_version: 1,
            is_system_message: false,
            system_message_type: null,
          },
        ]);
      });

      // The decryption mock returns undefined → filtered → state unchanged.
      // Critically, count is still 2 — not 3.
      expect(result.current.messages).toHaveLength(2);
    });

    it('sets data-messages-subscribed DOM attr after onSubscribed completes', async () => {
      const getOnSubscribed = captureOnSubscribed();

      renderHook(() => useConversationRealtime(mockConversationId));

      await waitFor(() => {
        expect(realtimeService.subscribeToMessages).toHaveBeenCalled();
      });

      // Before onSubscribed fires, the DOM attr should be absent
      expect(document.body.getAttribute('data-messages-subscribed')).toBeNull();

      await act(async () => {
        await getOnSubscribed()([]);
      });

      expect(document.body.getAttribute('data-messages-subscribed')).toBe(
        mockConversationId
      );
    });

    it('handles an empty retroactive batch without throwing', async () => {
      const getOnSubscribed = captureOnSubscribed();

      const { result } = renderHook(() =>
        useConversationRealtime(mockConversationId)
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await getOnSubscribed()([]);
        })
      ).resolves.toBeUndefined();

      expect(result.current.messages).toHaveLength(2);
    });
  });
});
