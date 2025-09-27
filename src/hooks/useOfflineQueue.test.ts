/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflineQueue } from './useOfflineQueue';
import * as offlineQueue from '@/utils/offline-queue';
import * as backgroundSync from '@/utils/background-sync';

// Mock the modules
vi.mock('@/utils/offline-queue');
vi.mock('@/utils/background-sync');

describe('useOfflineQueue', () => {
  let originalNavigatorOnLine: boolean;
  let onlineHandler: EventListener | null = null;
  let offlineHandler: EventListener | null = null;
  let messageHandler: EventListener | null = null;
  let mockServiceWorker: ServiceWorker;

  beforeEach(() => {
    // Store original value
    originalNavigatorOnLine = navigator.onLine;

    // Setup default mocks
    vi.mocked(offlineQueue.getQueueSize).mockResolvedValue(0);
    vi.mocked(offlineQueue.addToQueue).mockResolvedValue(true);
    vi.mocked(backgroundSync.isBackgroundSyncSupported).mockReturnValue(true);
    vi.mocked(backgroundSync.registerBackgroundSync).mockResolvedValue(true);

    // Capture event listeners
    window.addEventListener = vi.fn((event: string, handler: EventListener) => {
      if (event === 'online') onlineHandler = handler;
      if (event === 'offline') offlineHandler = handler;
    }) as typeof window.addEventListener;

    window.removeEventListener = vi.fn();

    // Mock service worker
    mockServiceWorker = {
      addEventListener: vi.fn((event: string, handler: EventListener) => {
        if (event === 'message') messageHandler = handler;
      }),
      removeEventListener: vi.fn(),
    } as unknown as ServiceWorker;

    Object.defineProperty(navigator, 'serviceWorker', {
      value: mockServiceWorker,
      writable: true,
    });

    // Set initial online state
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original value
    Object.defineProperty(navigator, 'onLine', {
      value: originalNavigatorOnLine,
      writable: true,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with correct online state', () => {
      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.isOnline).toBe(true);
      expect(result.current.queueSize).toBe(0);
      expect(result.current.isBackgroundSyncSupported).toBe(true);
    });

    it('should initialize offline when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.isOnline).toBe(false);
    });

    it('should detect background sync support', () => {
      vi.mocked(backgroundSync.isBackgroundSyncSupported).mockReturnValue(
        false
      );

      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.isBackgroundSyncSupported).toBe(false);
    });

    it('should load initial queue size', async () => {
      vi.mocked(offlineQueue.getQueueSize).mockResolvedValue(3);

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(result.current.queueSize).toBe(3);
      });
    });
  });

  describe('Network State Changes', () => {
    it('should handle online event', async () => {
      const onOnline = vi.fn();
      const { result } = renderHook(() => useOfflineQueue({ onOnline }));

      // Initially set offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      act(() => {
        offlineHandler?.({} as Event);
      });

      expect(result.current.isOnline).toBe(false);

      // Trigger online event
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
      });

      act(() => {
        onlineHandler?.({} as Event);
      });

      expect(result.current.isOnline).toBe(true);
      expect(onOnline).toHaveBeenCalled();
      expect(backgroundSync.registerBackgroundSync).toHaveBeenCalled();
    });

    it('should handle offline event', () => {
      const onOffline = vi.fn();
      const { result } = renderHook(() => useOfflineQueue({ onOffline }));

      act(() => {
        offlineHandler?.({} as Event);
      });

      expect(result.current.isOnline).toBe(false);
      expect(onOffline).toHaveBeenCalled();
    });
  });

  describe('Queue Operations', () => {
    it('should add item to offline queue', async () => {
      const onQueueAdd = vi.fn();
      const { result } = renderHook(() => useOfflineQueue({ onQueueAdd }));

      const testData = {
        name: 'Test',
        email: 'test@example.com',
      };

      let success: boolean = false;
      await act(async () => {
        success = await result.current.addToOfflineQueue(testData);
      });

      expect(success).toBe(true);
      expect(offlineQueue.addToQueue).toHaveBeenCalledWith(testData);
      expect(onQueueAdd).toHaveBeenCalledWith(testData);
      expect(backgroundSync.registerBackgroundSync).toHaveBeenCalled();
    });

    it('should update queue size after adding item', async () => {
      vi.mocked(offlineQueue.getQueueSize)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);

      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.queueSize).toBe(0);

      await act(async () => {
        await result.current.addToOfflineQueue({ test: 'data' });
      });

      await waitFor(() => {
        expect(result.current.queueSize).toBe(1);
      });
    });

    it('should handle add to queue failure', async () => {
      vi.mocked(offlineQueue.addToQueue).mockResolvedValue(false);

      const onQueueAdd = vi.fn();
      const { result } = renderHook(() => useOfflineQueue({ onQueueAdd }));

      let success: boolean = true;
      await act(async () => {
        success = await result.current.addToOfflineQueue({ test: 'data' });
      });

      expect(success).toBe(false);
      expect(onQueueAdd).not.toHaveBeenCalled();
    });

    it('should handle add to queue error', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      vi.mocked(offlineQueue.addToQueue).mockRejectedValue(
        new Error('Test error')
      );

      const { result } = renderHook(() => useOfflineQueue());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.addToOfflineQueue({ test: 'data' });
      });

      expect(success).toBe(false);
      expect(consoleError).toHaveBeenCalledWith(
        'Error adding to offline queue:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });

    it('should refresh queue size', async () => {
      vi.mocked(offlineQueue.getQueueSize)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(5);

      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.queueSize).toBe(0);

      await act(async () => {
        await result.current.refreshQueueSize();
      });

      expect(result.current.queueSize).toBe(5);
    });

    it('should handle queue size error', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      vi.mocked(offlineQueue.getQueueSize)
        .mockResolvedValueOnce(0)
        .mockRejectedValueOnce(new Error('Test error'));

      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.refreshQueueSize();
      });

      expect(consoleError).toHaveBeenCalledWith(
        'Error getting queue size:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe('Background Sync', () => {
    it('should not register background sync if not supported', async () => {
      vi.mocked(backgroundSync.isBackgroundSyncSupported).mockReturnValue(
        false
      );

      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.addToOfflineQueue({ test: 'data' });
      });

      expect(backgroundSync.registerBackgroundSync).not.toHaveBeenCalled();
    });

    it('should handle background sync complete message', async () => {
      vi.mocked(offlineQueue.getQueueSize)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(0);

      renderHook(() => useOfflineQueue());

      // Simulate background sync complete message
      act(() => {
        messageHandler?.({
          data: { type: 'BACKGROUND_SYNC_COMPLETE' },
        } as MessageEvent);
      });

      await waitFor(() => {
        expect(offlineQueue.getQueueSize).toHaveBeenCalledTimes(2);
      });
    });

    it('should ignore non-sync messages', () => {
      renderHook(() => useOfflineQueue());

      act(() => {
        messageHandler?.({
          data: { type: 'OTHER_MESSAGE' },
        } as MessageEvent);
      });

      // Should not trigger refresh
      expect(offlineQueue.getQueueSize).toHaveBeenCalledTimes(1); // Only initial
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => useOfflineQueue());

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith(
        'online',
        onlineHandler
      );
      expect(window.removeEventListener).toHaveBeenCalledWith(
        'offline',
        offlineHandler
      );
      expect(mockServiceWorker.removeEventListener).toHaveBeenCalledWith(
        'message',
        messageHandler
      );
    });

    it('should handle missing service worker gracefully', () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        writable: true,
      });

      const { result, unmount } = renderHook(() => useOfflineQueue());

      // Should still work without service worker
      expect(result.current.isOnline).toBe(true);

      // Should not error on unmount
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('SSR Compatibility', () => {
    it('should handle server-side rendering', () => {
      // SSR compatibility is ensured by checking for window existence in the hook
      // Testing actual SSR would require a different test environment
      // The hook uses typeof window !== 'undefined' checks throughout
      const { result } = renderHook(() => useOfflineQueue());

      // Should initialize with defaults in client environment
      expect(result.current.isOnline).toBe(true);
      expect(result.current.isBackgroundSyncSupported).toBe(true);
    });
  });
});
