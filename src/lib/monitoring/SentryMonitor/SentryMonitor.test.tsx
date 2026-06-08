import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SentryMonitor from './SentryMonitor';
import { useConsent } from '@/contexts/ConsentContext';
import {
  createMockConsentAllRejected,
  createMockConsentWithAnalytics,
} from '@/test-utils/consent-mocks';

const initSentry = vi.fn();
const closeSentry = vi.fn(() => Promise.resolve());

// Mutable DSN so we can test the unset case.
let mockDsn: string | undefined = 'https://k@o1.ingest.us.sentry.io/1';
vi.mock('@/lib/monitoring/sentry', () => ({
  get SENTRY_DSN() {
    return mockDsn;
  },
  initSentry: () => initSentry(),
  closeSentry: () => closeSentry(),
}));

vi.mock('@/contexts/ConsentContext', () => ({
  useConsent: vi.fn(),
}));

describe('SentryMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDsn = 'https://k@o1.ingest.us.sentry.io/1';
  });

  it('initializes Sentry when analytics consent is granted', async () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());
    render(<SentryMonitor />);
    await waitFor(() => expect(initSentry).toHaveBeenCalledTimes(1));
    expect(closeSentry).not.toHaveBeenCalled();
  });

  it('closes Sentry when analytics consent is denied', async () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentAllRejected());
    render(<SentryMonitor />);
    await waitFor(() => expect(closeSentry).toHaveBeenCalledTimes(1));
    expect(initSentry).not.toHaveBeenCalled();
  });

  it('re-initializes when consent transitions denied → granted', async () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentAllRejected());
    const { rerender } = render(<SentryMonitor />);
    await waitFor(() => expect(closeSentry).toHaveBeenCalled());

    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());
    rerender(<SentryMonitor />);
    await waitFor(() => expect(initSentry).toHaveBeenCalledTimes(1));
  });

  it('does nothing when no DSN is configured, even with consent', async () => {
    mockDsn = undefined;
    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());
    render(<SentryMonitor />);
    await waitFor(() => {
      expect(initSentry).not.toHaveBeenCalled();
      expect(closeSentry).not.toHaveBeenCalled();
    });
  });

  it('renders nothing', () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());
    const { container } = render(<SentryMonitor />);
    expect(container.textContent).toBe('');
  });
});
