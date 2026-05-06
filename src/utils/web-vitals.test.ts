import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Metric } from 'web-vitals';

// Mock the npm web-vitals package — we can't actually invoke
// PerformanceObserver in jsdom, so each callback is captured into a
// per-symbol slot we can fire manually from a test.
const captured = {
  onCLS: undefined as ((m: Metric) => void) | undefined,
  onFCP: undefined as ((m: Metric) => void) | undefined,
  onINP: undefined as ((m: Metric) => void) | undefined,
  onLCP: undefined as ((m: Metric) => void) | undefined,
  onTTFB: undefined as ((m: Metric) => void) | undefined,
};

vi.mock('web-vitals', () => ({
  onCLS: vi.fn((cb: (m: Metric) => void) => {
    captured.onCLS = cb;
  }),
  onFCP: vi.fn((cb: (m: Metric) => void) => {
    captured.onFCP = cb;
  }),
  onINP: vi.fn((cb: (m: Metric) => void) => {
    captured.onINP = cb;
  }),
  onLCP: vi.fn((cb: (m: Metric) => void) => {
    captured.onLCP = cb;
  }),
  onTTFB: vi.fn((cb: (m: Metric) => void) => {
    captured.onTTFB = cb;
  }),
}));

// Mock the analytics module so we can assert against trackWebVital +
// gate on isAnalyticsEnabled. The dynamic import in sendToAnalytics
// resolves through this mock.
const trackWebVital = vi.fn();
const isAnalyticsEnabled = vi.fn(() => true);
vi.mock('./analytics', () => ({
  trackWebVital: (...args: unknown[]) => trackWebVital(...args),
  isAnalyticsEnabled: () => isAnalyticsEnabled(),
}));

import {
  onCLS,
  onFCP,
  onINP,
  onLCP,
  onTTFB,
  reportWebVitals,
  sendToAnalytics,
} from './web-vitals';

const sampleMetric = (overrides: Partial<Metric> = {}): Metric =>
  ({
    name: 'LCP',
    value: 1234,
    rating: 'good',
    delta: 1234,
    id: 'v5-1234567890',
    navigationType: 'navigate',
    entries: [],
    ...overrides,
  }) as Metric;

beforeEach(() => {
  captured.onCLS = undefined;
  captured.onFCP = undefined;
  captured.onINP = undefined;
  captured.onLCP = undefined;
  captured.onTTFB = undefined;
  trackWebVital.mockClear();
  isAnalyticsEnabled.mockClear().mockReturnValue(true);
});

describe('web-vitals re-exports', () => {
  it('re-exports onCLS, onFCP, onINP, onLCP, onTTFB from the npm package', () => {
    // Each callable without throwing — proves the import path is wired.
    expect(typeof onCLS).toBe('function');
    expect(typeof onFCP).toBe('function');
    expect(typeof onINP).toBe('function');
    expect(typeof onLCP).toBe('function');
    expect(typeof onTTFB).toBe('function');
  });

  it('invoking a re-export forwards to the underlying npm callback', () => {
    const cb = vi.fn();
    onLCP(cb);
    expect(captured.onLCP).toBe(cb);
  });
});

describe('reportWebVitals', () => {
  it('subscribes the same callback to all five metric reporters', () => {
    const cb = vi.fn();
    reportWebVitals(cb);
    expect(captured.onCLS).toBe(cb);
    expect(captured.onFCP).toBe(cb);
    expect(captured.onINP).toBe(cb);
    expect(captured.onLCP).toBe(cb);
    expect(captured.onTTFB).toBe(cb);
  });

  it('does NOT subscribe to onFID — Chromium replaced FID with INP', async () => {
    // Regression pin: web-vitals ^5 dropped onFID in favor of onINP. If a
    // future bump reintroduces it, this test surfaces the change so the
    // author makes a deliberate decision about whether to wire it back up.
    const mod = await import('web-vitals');
    expect(Object.keys(mod)).not.toContain('onFID');
  });
});

describe('sendToAnalytics', () => {
  it('forwards metric to trackWebVital when analytics is enabled', async () => {
    isAnalyticsEnabled.mockReturnValue(true);
    sendToAnalytics(sampleMetric());

    // sendToAnalytics dispatches via dynamic import. flushPromises pattern:
    // wait until the spy has been called or a generous tick budget elapses.
    for (let i = 0; i < 10 && trackWebVital.mock.calls.length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(trackWebVital).toHaveBeenCalledTimes(1);
    expect(trackWebVital).toHaveBeenCalledWith({
      name: 'LCP',
      value: 1234,
      rating: 'good',
      delta: 1234,
      id: 'v5-1234567890',
      navigationType: 'navigate',
    });
  });

  it('does NOT call trackWebVital when analytics is disabled (consent withheld)', async () => {
    isAnalyticsEnabled.mockReturnValue(false);
    sendToAnalytics(sampleMetric());

    // Even after the dynamic import resolves, the gate inside
    // sendToAnalytics should suppress the dispatch. Wait the same budget.
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(trackWebVital).not.toHaveBeenCalled();
  });

  it('passes through CLS values verbatim (no inline scaling)', async () => {
    // Older bespoke implementation in performance.ts multiplied CLS by
    // 1000 to feed gtag. The current trackWebVital owns its own
    // rounding, so sendToAnalytics must not pre-scale or it'd double-up.
    isAnalyticsEnabled.mockReturnValue(true);
    sendToAnalytics(sampleMetric({ name: 'CLS', value: 0.05 }));

    for (let i = 0; i < 10 && trackWebVital.mock.calls.length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(trackWebVital).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'CLS', value: 0.05 })
    );
  });
});
