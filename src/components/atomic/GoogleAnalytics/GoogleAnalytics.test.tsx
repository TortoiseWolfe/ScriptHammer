import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GoogleAnalytics from './GoogleAnalytics';
import React from 'react';
import { useConsent } from '@/contexts/ConsentContext';
import {
  createMockConsentAllRejected,
  createMockConsentWithAnalytics,
} from '@/test-utils/consent-mocks';

// Type for Next.js Script props
interface ScriptProps {
  src?: string;
  strategy?: string;
  children?: string;
  id?: string;
}

// Mock Next.js Script component
vi.mock('next/script', () => ({
  default: vi.fn(({ src, strategy, children, id }: ScriptProps) => {
    if (src) {
      return React.createElement('script', {
        'data-testid': 'ga-script',
        src,
        'data-strategy': strategy,
      });
    }
    if (children && id) {
      return React.createElement('script', {
        'data-testid': `ga-script-${id}`,
        dangerouslySetInnerHTML: { __html: children },
      });
    }
    return null;
  }),
}));

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/test-path'),
}));

// Mock analytics utilities
vi.mock('@/utils/analytics', () => ({
  GA_MEASUREMENT_ID: 'G-TEST123456',
  initializeGA: vi.fn(),
  updateGAConsent: vi.fn(),
  trackPageView: vi.fn(),
}));

// Mock useConsent hook
vi.mock('@/contexts/ConsentContext', () => ({
  useConsent: vi.fn(() => ({
    consent: {
      necessary: true,
      functional: false,
      analytics: true,
      marketing: false,
    },
    updateConsent: vi.fn(),
    acceptAll: vi.fn(),
    rejectAll: vi.fn(),
    openModal: vi.fn(),
    closeModal: vi.fn(),
    showBanner: false,
    showModal: false,
    isLoading: false,
  })),
  ConsentProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('GoogleAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variable
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TEST123456';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  });

  it('should not render scripts when consent is denied', () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentAllRejected());

    const { queryByTestId } = render(<GoogleAnalytics />);

    expect(queryByTestId('ga-script')).not.toBeInTheDocument();
    expect(queryByTestId('ga-script-google-analytics')).not.toBeInTheDocument();
  });

  it('should render scripts when consent is granted', () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());

    const { getByTestId } = render(<GoogleAnalytics />);

    const script = getByTestId('ga-script');
    expect(script).toBeInTheDocument();
    expect(script).toHaveAttribute(
      'src',
      'https://www.googletagmanager.com/gtag/js?id=G-TEST123456'
    );
    expect(script).toHaveAttribute('data-strategy', 'afterInteractive');
  });

  it('should not render when measurement ID is missing', async () => {
    // Get the mocked analytics module
    const analyticsMock = await import('@/utils/analytics');
    const originalId = analyticsMock.GA_MEASUREMENT_ID;

    // Override just GA_MEASUREMENT_ID to undefined
    Object.defineProperty(analyticsMock, 'GA_MEASUREMENT_ID', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());

    const { queryByTestId } = render(<GoogleAnalytics />);

    expect(queryByTestId('ga-script')).not.toBeInTheDocument();
    expect(queryByTestId('ga-script-google-analytics')).not.toBeInTheDocument();

    // Restore the original mock
    Object.defineProperty(analyticsMock, 'GA_MEASUREMENT_ID', {
      value: originalId,
      writable: true,
      configurable: true,
    });
  });

  it('should initialize GA and track page views on mount', async () => {
    const { initializeGA, trackPageView } = await import('@/utils/analytics');

    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());

    render(<GoogleAnalytics />);

    await waitFor(() => {
      expect(initializeGA).toHaveBeenCalled();
      expect(trackPageView).toHaveBeenCalledWith('/test-path');
    });
  });

  it('should update consent when analytics consent changes', async () => {
    const { updateGAConsent } = await import('@/utils/analytics');

    // Start with analytics disabled
    vi.mocked(useConsent).mockReturnValue(createMockConsentAllRejected());

    const { rerender } = render(<GoogleAnalytics />);

    // Change consent to granted
    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());

    rerender(<GoogleAnalytics />);

    await waitFor(() => {
      expect(updateGAConsent).toHaveBeenCalledWith(true);
    });
  });

  it('should track page views when pathname changes', async () => {
    const { trackPageView } = await import('@/utils/analytics');
    const { usePathname } = await import('next/navigation');

    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());

    // First render with /page1
    vi.mocked(usePathname).mockReturnValue('/page1');
    const { rerender } = render(<GoogleAnalytics />);

    // Simulate pathname change to /page2
    vi.mocked(usePathname).mockReturnValue('/page2');
    rerender(<GoogleAnalytics />);

    await waitFor(() => {
      expect(trackPageView).toHaveBeenCalledWith('/page1');
    });
  });

  it('should render inline script with correct GA4 configuration', () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());

    const { getByTestId } = render(<GoogleAnalytics />);

    const inlineScript = getByTestId('ga-script-google-analytics');
    expect(inlineScript).toBeInTheDocument();
    expect(inlineScript.innerHTML).toContain('G-TEST123456');
    expect(inlineScript.innerHTML).toContain('gtag');
    expect(inlineScript.innerHTML).toContain('dataLayer');
  });
});
