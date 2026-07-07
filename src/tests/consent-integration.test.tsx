import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsentProvider } from '@/contexts/ConsentContext';
import { CookieConsent } from '@/components/privacy/CookieConsent';
import { ConsentModal } from '@/components/privacy/ConsentModal';

// Mock analytics module
vi.mock('@/utils/analytics', () => ({
  initializeAnalytics: vi.fn(),
  trackEvent: vi.fn(),
  isAnalyticsLoaded: vi.fn(() => false),
  updateAnalyticsConsent: vi.fn(),
  handleConsentChange: vi.fn(),
}));

describe('Consent Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('should handle first-time visitor consent flow', async () => {
    render(
      <ConsentProvider>
        <CookieConsent />
        <ConsentModal />
      </ConsentProvider>
    );

    expect(screen.getAllByText(/We use cookies/i).length).toBeGreaterThan(0);
  });
});
