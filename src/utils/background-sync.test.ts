/**
 * Tests for the #32 foreground form-queue fallback (browsers without the
 * Background Sync API). processQueue is exercised via its offline-queue deps,
 * which we mock so no IndexedDB is touched.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const getQueuedItems = vi.fn();
vi.mock('./offline-queue', () => ({
  getQueuedItems: (...a: unknown[]) => getQueuedItems(...a),
  removeFromQueue: vi.fn(),
  updateRetryCount: vi.fn(),
}));
vi.mock('./web3forms', () => ({ submitWithRetry: vi.fn() }));

import { startFormQueueFallback } from './background-sync';

function setSyncManager(present: boolean) {
  if (present) {
    (window as unknown as { SyncManager: unknown }).SyncManager =
      function () {};
  } else {
    delete (window as unknown as { SyncManager?: unknown }).SyncManager;
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {},
    configurable: true,
  });
}

describe('startFormQueueFallback (#32)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getQueuedItems.mockResolvedValue([]);
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
  });

  afterEach(() => {
    delete (window as unknown as { SyncManager?: unknown }).SyncManager;
  });

  it('is a no-op when the Background Sync API is supported', () => {
    setSyncManager(true);
    const addSpy = vi.spyOn(window, 'addEventListener');
    const stop = startFormQueueFallback();
    expect(addSpy).not.toHaveBeenCalledWith('online', expect.any(Function));
    stop();
    addSpy.mockRestore();
  });

  it('installs online + visibility listeners when unsupported, and cleans up', () => {
    setSyncManager(false);
    const addSpy = vi.spyOn(window, 'addEventListener');
    const docAddSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const stop = startFormQueueFallback();
    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(docAddSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    );

    stop();
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));

    addSpy.mockRestore();
    docAddSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('flushes the queue on an online event', async () => {
    setSyncManager(false);
    const stop = startFormQueueFallback();
    getQueuedItems.mockClear(); // ignore the initial drain on start

    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(getQueuedItems).toHaveBeenCalled());
    stop();
  });
});
