/**
 * Unit Tests for useTypingIndicator Hook
 * Task: T122
 *
 * Tests typing indicator hook with mocked Supabase client and realtime service.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTypingIndicator } from '../useTypingIndicator';
import { realtimeService } from '@/lib/messaging/realtime';
import { createClient } from '@/lib/supabase/client';

// Mock dependencies
vi.mock('@/lib/supabase/client');
vi.mock('@/lib/messaging/realtime');

describe('useTypingIndicator', () => {
  const mockConversationId = 'test-conversation-id';
  const mockCurrentUserId = 'current-user-id';
  const mockOtherUserId = 'other-user-id';

  let mockSupabase: any;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockCurrentUserId } },
          error: null,
        }),
      },
    };

    (createClient as any).mockReturnValue(mockSupabase);

    // Mock realtime service
    mockUnsubscribe = vi.fn();
    (realtimeService.subscribeToTypingIndicators as any).mockReturnValue(
      mockUnsubscribe
    );
    (realtimeService.setTypingStatus as any) = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with isTyping=false', () => {
    const { result } = renderHook(() => useTypingIndicator(mockConversationId));

    expect(result.current.isTyping).toBe(false);
    expect(result.current.setTyping).toBeInstanceOf(Function);
  });

  it('should subscribe to typing indicators on mount', async () => {
    renderHook(() => useTypingIndicator(mockConversationId));

    await waitFor(() => {
      expect(realtimeService.subscribeToTypingIndicators).toHaveBeenCalledWith(
        mockConversationId,
        expect.any(Function)
      );
    });
  });

  it('should unsubscribe on unmount', async () => {
    const { unmount } = renderHook(() =>
      useTypingIndicator(mockConversationId)
    );

    await waitFor(() => {
      expect(realtimeService.subscribeToTypingIndicators).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should update isTyping when other user types', async () => {
    let typingCallback:
      | ((userId: string, isTyping: boolean) => void)
      | undefined;

    (realtimeService.subscribeToTypingIndicators as any).mockImplementation(
      (_id: string, callback: (userId: string, isTyping: boolean) => void) => {
        typingCallback = callback;
        return mockUnsubscribe;
      }
    );

    const { result } = renderHook(() => useTypingIndicator(mockConversationId));

    await waitFor(() => {
      expect(typingCallback).toBeDefined();
    });

    // Other user starts typing
    act(() => {
      if (typingCallback) {
        typingCallback(mockOtherUserId, true);
      }
    });

    expect(result.current.isTyping).toBe(true);

    // Other user stops typing
    act(() => {
      if (typingCallback) {
        typingCallback(mockOtherUserId, false);
      }
    });

    expect(result.current.isTyping).toBe(false);
  });

  it('should ignore own typing status', async () => {
    let typingCallback:
      | ((userId: string, isTyping: boolean) => void)
      | undefined;

    (realtimeService.subscribeToTypingIndicators as any).mockImplementation(
      (_id: string, callback: (userId: string, isTyping: boolean) => void) => {
        typingCallback = callback;
        return mockUnsubscribe;
      }
    );

    const { result } = renderHook(() => useTypingIndicator(mockConversationId));

    await waitFor(() => {
      expect(typingCallback).toBeDefined();
    });

    // Current user typing (should be ignored)
    act(() => {
      if (typingCallback) {
        typingCallback(mockCurrentUserId, true);
      }
    });

    expect(result.current.isTyping).toBe(false);
  });

  it('should call setTypingStatus when setTyping is called', () => {
    const { result } = renderHook(() => useTypingIndicator(mockConversationId));

    act(() => {
      result.current.setTyping(true);
    });

    expect(realtimeService.setTypingStatus).toHaveBeenCalledWith(
      mockConversationId,
      true
    );

    act(() => {
      result.current.setTyping(false);
    });

    expect(realtimeService.setTypingStatus).toHaveBeenCalledWith(
      mockConversationId,
      false
    );
  });

  it('should auto-expire typing indicator after 5 seconds', async () => {
    let typingCallback:
      | ((userId: string, isTyping: boolean) => void)
      | undefined;

    (realtimeService.subscribeToTypingIndicators as any).mockImplementation(
      (_id: string, callback: (userId: string, isTyping: boolean) => void) => {
        typingCallback = callback;
        return mockUnsubscribe;
      }
    );

    const { result } = renderHook(() => useTypingIndicator(mockConversationId));

    await waitFor(() => {
      expect(typingCallback).toBeDefined();
    });

    // Enable fake timers AFTER waitFor completes
    vi.useFakeTimers();

    // Other user starts typing
    act(() => {
      if (typingCallback) {
        typingCallback(mockOtherUserId, true);
      }
    });

    expect(result.current.isTyping).toBe(true);

    // Fast-forward 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.isTyping).toBe(false);

    vi.useRealTimers();
  });

  it('should clear timeout when typing updates before expiry', async () => {
    let typingCallback:
      | ((userId: string, isTyping: boolean) => void)
      | undefined;

    (realtimeService.subscribeToTypingIndicators as any).mockImplementation(
      (_id: string, callback: (userId: string, isTyping: boolean) => void) => {
        typingCallback = callback;
        return mockUnsubscribe;
      }
    );

    const { result } = renderHook(() => useTypingIndicator(mockConversationId));

    await waitFor(() => {
      expect(typingCallback).toBeDefined();
    });

    // Enable fake timers AFTER waitFor completes
    vi.useFakeTimers();

    // Other user starts typing
    act(() => {
      if (typingCallback) {
        typingCallback(mockOtherUserId, true);
      }
    });

    expect(result.current.isTyping).toBe(true);

    // Fast-forward 3 seconds (before expiry)
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Another typing update (resets timer)
    act(() => {
      if (typingCallback) {
        typingCallback(mockOtherUserId, true);
      }
    });

    expect(result.current.isTyping).toBe(true);

    // Fast-forward another 3 seconds (total 6s, but timer was reset at 3s)
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Should still be typing (timer reset)
    expect(result.current.isTyping).toBe(true);

    // Fast-forward final 2 seconds (5s from last update)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Now should expire
    expect(result.current.isTyping).toBe(false);

    vi.useRealTimers();
  });

  it('should handle rapid typing/not typing changes', async () => {
    let typingCallback:
      | ((userId: string, isTyping: boolean) => void)
      | undefined;

    (realtimeService.subscribeToTypingIndicators as any).mockImplementation(
      (_id: string, callback: (userId: string, isTyping: boolean) => void) => {
        typingCallback = callback;
        return mockUnsubscribe;
      }
    );

    const { result } = renderHook(() => useTypingIndicator(mockConversationId));

    await waitFor(() => {
      expect(typingCallback).toBeDefined();
    });

    // Rapid changes
    act(() => {
      if (typingCallback) {
        typingCallback(mockOtherUserId, true);
      }
    });
    expect(result.current.isTyping).toBe(true);

    act(() => {
      if (typingCallback) {
        typingCallback(mockOtherUserId, false);
      }
    });
    expect(result.current.isTyping).toBe(false);

    act(() => {
      if (typingCallback) {
        typingCallback(mockOtherUserId, true);
      }
    });
    expect(result.current.isTyping).toBe(true);

    act(() => {
      if (typingCallback) {
        typingCallback(mockOtherUserId, false);
      }
    });
    expect(result.current.isTyping).toBe(false);
  });

  it('should clear timeout on unmount', async () => {
    let typingCallback:
      | ((userId: string, isTyping: boolean) => void)
      | undefined;

    (realtimeService.subscribeToTypingIndicators as any).mockImplementation(
      (_id: string, callback: (userId: string, isTyping: boolean) => void) => {
        typingCallback = callback;
        return mockUnsubscribe;
      }
    );

    const { result, unmount } = renderHook(() =>
      useTypingIndicator(mockConversationId)
    );

    await waitFor(() => {
      expect(typingCallback).toBeDefined();
    });

    // Enable fake timers AFTER waitFor completes
    vi.useFakeTimers();

    // Start typing
    act(() => {
      if (typingCallback) {
        typingCallback(mockOtherUserId, true);
      }
    });

    expect(result.current.isTyping).toBe(true);

    // Unmount before timeout expires
    unmount();

    // Fast-forward time (should not throw error)
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    vi.useRealTimers();
  });
});
