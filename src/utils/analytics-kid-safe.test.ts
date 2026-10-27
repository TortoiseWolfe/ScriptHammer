/**
 * COPPA: gtag may already be running from the page a visitor came from. After
 * a client-side navigation to a kid-safe route the helpers must send nothing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./analytics-debug', () => ({
  default: { logEvent: vi.fn() },
}));

describe('analytics helpers on a kid-safe location', () => {
  const gtag = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-KIDSAFE002');
    gtag.mockClear();
    (window as unknown as { gtag: typeof gtag }).gtag = gtag;
  });

  afterEach(() => {
    delete (window as unknown as { gtag?: unknown }).gtag;
    window.history.replaceState({}, '', '/');
    vi.unstubAllEnvs();
  });

  it('control: sends on an ordinary route', async () => {
    window.history.replaceState({}, '', '/pricing/');
    const a = await import('./analytics');
    a.trackPageView('/pricing/');
    a.trackEvent('click', 'cta');
    a.trackError('boom');
    a.trackWebVital({ name: 'LCP', value: 1, rating: 'good' });
    expect(a.isAnalyticsEnabled()).toBe(true);
    expect(gtag).toHaveBeenCalled();
  });

  it('sends nothing on /band', async () => {
    window.history.replaceState({}, '', '/band/');
    const a = await import('./analytics');
    a.trackPageView('/band/');
    a.trackEvent('click', 'cta');
    a.trackError('boom');
    a.trackWebVital({ name: 'LCP', value: 1, rating: 'good' });
    expect(a.isAnalyticsEnabled()).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });
});
