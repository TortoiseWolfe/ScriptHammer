/**
 * COPPA: on a kid-safe route no tracker renders, starts or sends, even with
 * every consent granted. One file so the four readers of the shared list are
 * pinned side by side; delete a reader's check and its case here goes red.
 */
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import GoogleAnalytics from '@/lib/analytics/GoogleAnalytics/GoogleAnalytics';
import OpenAIPixel from '@/lib/analytics/OpenAIPixel/OpenAIPixel';
import SentryMonitor from '@/lib/monitoring/SentryMonitor/SentryMonitor';
import { useConsent } from '@/contexts/ConsentContext';
import { createMockConsentAllAccepted } from '@/test-utils/consent-mocks';

let mockPath = '/band/';
vi.mock('next/navigation', () => ({ usePathname: () => mockPath }));

vi.mock('next/script', () => ({
  default: ({ id, src }: { id?: string; src?: string }) =>
    React.createElement('script', { 'data-testid': id ?? src }),
}));

vi.mock('@/contexts/ConsentContext', () => ({ useConsent: vi.fn() }));

const initializeGA = vi.fn();
const updateGAConsent = vi.fn();
const trackPageView = vi.fn();
vi.mock('@/utils/analytics', () => ({
  GA_MEASUREMENT_ID: 'G-KIDSAFE001',
  initializeGA: () => initializeGA(),
  updateGAConsent: (g: boolean) => updateGAConsent(g),
  trackPageView: (p: string) => trackPageView(p),
}));
vi.mock('@/utils/performance', () => ({ initWebVitals: vi.fn() }));

const clearOppref = vi.fn();
const captureOppref = vi.fn();
vi.mock('@/lib/analytics/ad-attribution', () => ({
  captureOppref: (v: boolean) => captureOppref(v),
  clearOppref: () => clearOppref(),
}));

const initSentry = vi.fn();
const closeSentry = vi.fn(() => Promise.resolve());
vi.mock('@/lib/monitoring/sentry', () => ({
  SENTRY_DSN: 'https://k@o1.ingest.us.sentry.io/1',
  initSentry: () => initSentry(),
  closeSentry: () => closeSentry(),
}));

describe('trackers on a kid-safe route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_OPENAI_PIXEL_ID', 'pixel-test');
    vi.mocked(useConsent).mockReturnValue(createMockConsentAllAccepted());
    delete (window as unknown as Record<string, unknown>)[
      'ga-disable-G-KIDSAFE001'
    ];
  });

  describe('on /band with every consent granted', () => {
    beforeEach(() => {
      mockPath = '/band/';
    });

    it('GoogleAnalytics renders no script, sends no page_view, and sets ga-disable', async () => {
      const { queryByTestId } = render(<GoogleAnalytics />);
      expect(queryByTestId('google-analytics')).toBeNull();
      expect(queryByTestId(/googletagmanager\.com/)).toBeNull();
      await waitFor(() =>
        expect(
          (window as unknown as Record<string, unknown>)[
            'ga-disable-G-KIDSAFE001'
          ]
        ).toBe(true)
      );
      expect(initializeGA).not.toHaveBeenCalled();
      expect(trackPageView).not.toHaveBeenCalled();
      expect(updateGAConsent).toHaveBeenCalledWith(false);
      expect(updateGAConsent).not.toHaveBeenCalledWith(true);
    });

    it('OpenAIPixel renders no pixel and holds no click id', async () => {
      const { queryByTestId } = render(<OpenAIPixel />);
      expect(queryByTestId('openai-ads-pixel')).toBeNull();
      await waitFor(() => expect(clearOppref).toHaveBeenCalled());
      expect(captureOppref).not.toHaveBeenCalled();
    });

    it('SentryMonitor closes Sentry and never starts it', async () => {
      render(<SentryMonitor />);
      await waitFor(() => expect(closeSentry).toHaveBeenCalled());
      expect(initSentry).not.toHaveBeenCalled();
    });
  });

  describe('control: the same consent on an ordinary route', () => {
    beforeEach(() => {
      mockPath = '/pricing/';
    });

    it('GoogleAnalytics loads and sends a page_view', async () => {
      const { queryByTestId } = render(<GoogleAnalytics />);
      expect(queryByTestId('google-analytics')).not.toBeNull();
      await waitFor(() =>
        expect(trackPageView).toHaveBeenCalledWith('/pricing/')
      );
      expect(initializeGA).toHaveBeenCalled();
    });

    it('OpenAIPixel loads', () => {
      const { queryByTestId } = render(<OpenAIPixel />);
      expect(queryByTestId('openai-ads-pixel')).not.toBeNull();
    });

    it('SentryMonitor starts Sentry', async () => {
      render(<SentryMonitor />);
      await waitFor(() => expect(initSentry).toHaveBeenCalled());
    });
  });

  it('GoogleAnalytics re-enables after navigating away from /band', async () => {
    mockPath = '/band/';
    const { rerender } = render(<GoogleAnalytics />);
    await waitFor(() =>
      expect(
        (window as unknown as Record<string, unknown>)[
          'ga-disable-G-KIDSAFE001'
        ]
      ).toBe(true)
    );
    mockPath = '/pricing/';
    rerender(<GoogleAnalytics />);
    await waitFor(() =>
      expect(
        (window as unknown as Record<string, unknown>)[
          'ga-disable-G-KIDSAFE001'
        ]
      ).toBe(false)
    );
  });
});
