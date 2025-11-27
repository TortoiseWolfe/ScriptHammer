/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflineQueue } from './useOfflineQueue';
import { offlineQueueService } from '@/services/messaging/offline-queue-service';
import type { QueuedMessage } from '@/types/messaging';

// Mock the logger - use vi.hoisted to ensure it's available before mock hoisting
const mockLoggerFns = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

// Mock the offline queue service
vi.mock('@/services/messaging/offline-queue-service', () => ({
  offlineQueueService: {
    getQueue: vi.fn(),
    getFailedMessages: vi.fn(),
    syncQueue: vi.fn(),
    retryFailed: vi.fn(),
    clearSyncedMessages: vi.fn(),
  },
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => mockLoggerFns),
}));

describe('useOfflineQueue', () => {
  const mockQueuedMessage: QueuedMessage = {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'user-1',
    encrypted_content: 'encrypted',
    initialization_vector: 'iv',
    status: 'pending',
    synced: false,
    retries: 0,
    created_at: Date.now(),
  };

  const mockFailedMessage: QueuedMessage = {
    ...mockQueuedMessage,
    id: 'msg-2',
    status: 'failed',
    retries: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(offlineQueueService.getQueue).mockResolvedValue([]);
    vi.mocked(offlineQueueService.getFailedMessages).mockResolvedValue([]);
    vi.mocked(offlineQueueService.syncQueue).mockResolvedValue({
      success: 0,
      failed: 0,
    });
    vi.mocked(offlineQueueService.retryFailed).mockResolvedValue(0);
    vi.mocked(offlineQueueService.clearSyncedMessages).mockResolvedValue(0);

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
      configurable: true,
    });

    // Clear logger mocks
    mockLoggerFns.debug.mockClear();
    mockLoggerFns.info.mockClear();
    mockLoggerFns.warn.mockClear();
    mockLoggerFns.error.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with correct default values', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      // Wait for initial load
      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      expect(result.current.queue).toEqual([]);
      expect(result.current.queueCount).toBe(0);
      expect(result.current.failedCount).toBe(0);
      expect(result.current.isSyncing).toBe(false);
      expect(result.current.isOnline).toBe(true);
    });

    it('should provide all required functions', () => {
      const { result } = renderHook(() => useOfflineQueue());

      expect(typeof result.current.syncQueue).toBe('function');
      expect(typeof result.current.retryFailed).toBe('function');
      expect(typeof result.current.clearSynced).toBe('function');
      expect(typeof result.current.getFailedMessages).toBe('function');
    });
  });

  describe('Queue Loading', () => {
    it('should load queue on mount', async () => {
      vi.mocked(offlineQueueService.getQueue).mockResolvedValue([
        mockQueuedMessage,
      ]);
      vi.mocked(offlineQueueService.getFailedMessages).mockResolvedValue([]);

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(result.current.queueCount).toBe(1);
      });

      expect(result.current.queue).toEqual([mockQueuedMessage]);
      expect(result.current.failedCount).toBe(0);
    });

    it('should track failed messages separately', async () => {
      vi.mocked(offlineQueueService.getQueue).mockResolvedValue([
        mockQueuedMessage,
      ]);
      vi.mocked(offlineQueueService.getFailedMessages).mockResolvedValue([
        mockFailedMessage,
      ]);

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(result.current.failedCount).toBe(1);
      });

      expect(result.current.queueCount).toBe(1);
    });

    it('should handle loading errors gracefully', async () => {
      vi.mocked(offlineQueueService.getQueue).mockRejectedValue(
        new Error('Database error')
      );

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(mockLoggerFns.error).toHaveBeenCalledWith(
          'Failed to load offline queue',
          expect.objectContaining({ error: expect.any(Error) })
        );
      });

      // Should maintain default values on error
      expect(result.current.queueCount).toBe(0);
      expect(result.current.failedCount).toBe(0);
    });
  });

  describe('Queue Sync', () => {
    it('should sync queue successfully', async () => {
      // Empty queue to prevent auto-sync
      vi.mocked(offlineQueueService.getQueue).mockResolvedValue([]);
      vi.mocked(offlineQueueService.syncQueue).mockResolvedValue({
        success: 1,
        failed: 0,
      });

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      await act(async () => {
        await result.current.syncQueue();
      });

      expect(offlineQueueService.syncQueue).toHaveBeenCalled();
    });

    it('should set isSyncing flag during sync', async () => {
      vi.mocked(offlineQueueService.getQueue).mockResolvedValue([]);

      let resolveSyncQueue: (value: any) => void;
      const syncPromise = new Promise((resolve) => {
        resolveSyncQueue = resolve;
      });

      vi.mocked(offlineQueueService.syncQueue).mockReturnValue(
        syncPromise as Promise<{ success: number; failed: number }>
      );

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      // Start sync
      act(() => {
        result.current.syncQueue();
      });

      // Should be syncing
      await waitFor(() => {
        expect(result.current.isSyncing).toBe(true);
      });

      // Resolve sync
      await act(async () => {
        resolveSyncQueue!({ success: 1, failed: 0 });
      });

      await waitFor(() => {
        expect(result.current.isSyncing).toBe(false);
      });
    });

    it('should not sync when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
        configurable: true,
      });

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      await act(async () => {
        await result.current.syncQueue();
      });

      expect(offlineQueueService.syncQueue).not.toHaveBeenCalled();
    });

    it('should not sync when already syncing', async () => {
      vi.mocked(offlineQueueService.getQueue).mockResolvedValue([]);

      let resolveSyncQueue: (value: any) => void;
      const syncPromise = new Promise((resolve) => {
        resolveSyncQueue = resolve;
      });

      vi.mocked(offlineQueueService.syncQueue).mockReturnValue(
        syncPromise as Promise<{ success: number; failed: number }>
      );

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      // Start first sync
      act(() => {
        result.current.syncQueue();
      });

      await waitFor(() => {
        expect(result.current.isSyncing).toBe(true);
      });

      // Try to start second sync
      await act(async () => {
        await result.current.syncQueue();
      });

      // Should only be called once
      expect(offlineQueueService.syncQueue).toHaveBeenCalledTimes(1);

      // Cleanup
      await act(async () => {
        resolveSyncQueue!({ success: 0, failed: 0 });
      });
    });

    it('should handle sync errors', async () => {
      vi.mocked(offlineQueueService.syncQueue).mockRejectedValue(
        new Error('Sync failed')
      );

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      await act(async () => {
        await result.current.syncQueue();
      });

      expect(mockLoggerFns.error).toHaveBeenCalledWith(
        'Failed to sync queue',
        expect.objectContaining({ error: expect.any(Error) })
      );
      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('Retry Failed Messages', () => {
    it('should reset failed messages and trigger sync', async () => {
      vi.mocked(offlineQueueService.retryFailed).mockResolvedValue(2);

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      await act(async () => {
        await result.current.retryFailed();
      });

      expect(offlineQueueService.retryFailed).toHaveBeenCalled();
      expect(offlineQueueService.syncQueue).toHaveBeenCalled();
    });

    it('should reload queue after retry', async () => {
      vi.mocked(offlineQueueService.retryFailed).mockResolvedValue(2);
      vi.mocked(offlineQueueService.getQueue).mockResolvedValue([
        mockQueuedMessage,
      ]);

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      const initialCallCount = vi.mocked(offlineQueueService.getQueue).mock
        .calls.length;

      await act(async () => {
        await result.current.retryFailed();
      });

      // getQueue should have been called again after retry
      expect(
        vi.mocked(offlineQueueService.getQueue).mock.calls.length
      ).toBeGreaterThan(initialCallCount);
    });

    it('should handle retry errors', async () => {
      vi.mocked(offlineQueueService.retryFailed).mockRejectedValue(
        new Error('Retry failed')
      );

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      await act(async () => {
        await result.current.retryFailed();
      });

      expect(mockLoggerFns.error).toHaveBeenCalledWith(
        'Failed to retry messages',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('Clear Synced Messages', () => {
    it('should clear synced messages', async () => {
      vi.mocked(offlineQueueService.clearSyncedMessages).mockResolvedValue(3);

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      await act(async () => {
        await result.current.clearSynced();
      });

      expect(offlineQueueService.clearSyncedMessages).toHaveBeenCalled();
    });

    it('should reload queue after clearing', async () => {
      vi.mocked(offlineQueueService.clearSyncedMessages).mockResolvedValue(3);

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      const initialCallCount = vi.mocked(offlineQueueService.getQueue).mock
        .calls.length;

      await act(async () => {
        await result.current.clearSynced();
      });

      // getQueue should have been called again
      expect(
        vi.mocked(offlineQueueService.getQueue).mock.calls.length
      ).toBeGreaterThan(initialCallCount);
    });

    it('should handle clear errors', async () => {
      vi.mocked(offlineQueueService.clearSyncedMessages).mockRejectedValue(
        new Error('Clear failed')
      );

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      await act(async () => {
        await result.current.clearSynced();
      });

      expect(mockLoggerFns.error).toHaveBeenCalledWith(
        'Failed to clear synced messages',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('Get Failed Messages', () => {
    it('should return failed messages', async () => {
      vi.mocked(offlineQueueService.getFailedMessages).mockResolvedValue([
        mockFailedMessage,
      ]);

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      const failed = await result.current.getFailedMessages();
      expect(failed).toEqual([mockFailedMessage]);
    });
  });

  describe('Online/Offline Events', () => {
    it('should trigger sync when going online', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      // Simulate going online
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(offlineQueueService.syncQueue).toHaveBeenCalled();
      });

      expect(result.current.isOnline).toBe(true);
    });

    it('should update isOnline when going offline', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current.isOnline).toBe(false);
    });

    it('should cleanup event listeners on unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'online',
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'offline',
        expect.any(Function)
      );
    });
  });

  describe('Queue Polling', () => {
    it('should setup polling interval on mount', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      // Should have set up interval
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    it('should cleanup polling interval on unmount', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { unmount } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(offlineQueueService.getQueue).toHaveBeenCalled();
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
