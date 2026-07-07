import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import SentryMonitor from './SentryMonitor';
import { useConsent } from '@/contexts/ConsentContext';
import {
  createMockConsentAllRejected,
  createMockConsentWithAnalytics,
} from '@/test-utils/consent-mocks';

vi.mock('@/lib/monitoring/sentry', () => ({
  SENTRY_DSN: 'https://k@o1.ingest.us.sentry.io/1',
  initSentry: vi.fn(),
  closeSentry: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/contexts/ConsentContext', () => ({
  useConsent: vi.fn(),
}));

expect.extend(toHaveNoViolations);

describe('SentryMonitor Accessibility', () => {
  it('has no accessibility violations when consent is granted', async () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());
    const { container } = render(<SentryMonitor />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations when consent is denied', async () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentAllRejected());
    const { container } = render(<SentryMonitor />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('adds no focusable elements', () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());
    const { container } = render(<SentryMonitor />);
    const focusable = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    expect(focusable).toHaveLength(0);
  });

  it('adds no visible content', () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());
    const { container } = render(<SentryMonitor />);
    expect(container.textContent).toBe('');
  });

  it('adds no ARIA live regions or roles', () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());
    const { container } = render(<SentryMonitor />);
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(0);
    expect(container.querySelectorAll('[role]')).toHaveLength(0);
  });
});
