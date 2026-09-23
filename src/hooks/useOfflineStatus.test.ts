import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOfflineStatus } from './useOfflineStatus';

/**
 * The navigator.connection 'change' listener must be removed on unmount (#1258).
 * It was added with an inline arrow, so nothing could remove it, and every mount
 * leaked one for the life of the page.
 */
function installFakeConnection() {
  const connection = {
    effectiveType: '4g',
    downlink: 10,
    rtt: 50,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(navigator, 'connection', {
    value: connection,
    configurable: true,
    writable: true,
  });
  return connection;
}

afterEach(() => {
  // Leave jsdom's navigator as we found it.
  delete (navigator as unknown as { connection?: unknown }).connection;
});

describe('useOfflineStatus connection listener (#1258)', () => {
  it('removes the same handler it added, on unmount', () => {
    const conn = installFakeConnection();
    const { unmount } = renderHook(() => useOfflineStatus());

    expect(conn.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );
    const added = conn.addEventListener.mock.calls[0][1];

    unmount();

    expect(conn.removeEventListener).toHaveBeenCalledWith('change', added);
  });

  it('does not leak across mounts: N mounts, N removals', () => {
    const conn = installFakeConnection();
    const handles = [
      renderHook(() => useOfflineStatus()),
      renderHook(() => useOfflineStatus()),
      renderHook(() => useOfflineStatus()),
    ];
    handles.forEach((h) => h.unmount());
    expect(conn.addEventListener).toHaveBeenCalledTimes(3);
    expect(conn.removeEventListener).toHaveBeenCalledTimes(3);
  });

  it('CONTROL: a browser with no navigator.connection still mounts and unmounts', () => {
    const { result, unmount } = renderHook(() => useOfflineStatus());
    expect(result.current).toBeDefined();
    expect(() => unmount()).not.toThrow();
  });
});
