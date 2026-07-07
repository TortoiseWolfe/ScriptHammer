import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  estimateStorage,
  isStorageNearQuota,
  formatStorageUsage,
  STORAGE_WARNING_THRESHOLD,
} from '../storage-quota';

const originalNavigator = globalThis.navigator;

function setEstimate(impl: (() => Promise<unknown>) | undefined) {
  Object.defineProperty(globalThis, 'navigator', {
    value: impl ? { storage: { estimate: impl } } : {},
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  Object.defineProperty(globalThis, 'navigator', {
    value: originalNavigator,
    configurable: true,
    writable: true,
  });
  vi.restoreAllMocks();
});

describe('estimateStorage', () => {
  it('returns unsupported when StorageManager is missing', async () => {
    setEstimate(undefined);
    const r = await estimateStorage();
    expect(r.supported).toBe(false);
    expect(r.warning).toBe(false);
    expect(r.ratio).toBeNull();
  });

  it('computes ratio + no warning below the threshold', async () => {
    setEstimate(async () => ({ usage: 5, quota: 100 }));
    const r = await estimateStorage();
    expect(r.supported).toBe(true);
    expect(r.ratio).toBeCloseTo(0.05);
    expect(r.warning).toBe(false);
  });

  it('flags a warning at/over the 80% threshold', async () => {
    setEstimate(async () => ({ usage: 80, quota: 100 }));
    const r = await estimateStorage();
    expect(r.ratio).toBeCloseTo(STORAGE_WARNING_THRESHOLD);
    expect(r.warning).toBe(true);
  });

  it('treats a zero/invalid quota as unknown (no divide-by-zero warning)', async () => {
    setEstimate(async () => ({ usage: 5, quota: 0 }));
    const r = await estimateStorage();
    expect(r.supported).toBe(true);
    expect(r.ratio).toBeNull();
    expect(r.warning).toBe(false);
  });

  it('fails open when estimate() throws', async () => {
    setEstimate(async () => {
      throw new Error('denied');
    });
    const r = await estimateStorage();
    expect(r.supported).toBe(true);
    expect(r.warning).toBe(false);
  });
});

describe('isStorageNearQuota', () => {
  it('mirrors the warning flag', async () => {
    setEstimate(async () => ({ usage: 90, quota: 100 }));
    expect(await isStorageNearQuota()).toBe(true);
    setEstimate(async () => ({ usage: 10, quota: 100 }));
    expect(await isStorageNearQuota()).toBe(false);
  });
});

describe('formatStorageUsage', () => {
  it('formats MB pairs', () => {
    expect(formatStorageUsage(8.5 * 1024 * 1024, 10 * 1024 * 1024)).toBe(
      '8.5 MB of 10.0 MB'
    );
  });
  it('returns null when either side is unknown', () => {
    expect(formatStorageUsage(null, 100)).toBeNull();
    expect(formatStorageUsage(100, null)).toBeNull();
  });
});
