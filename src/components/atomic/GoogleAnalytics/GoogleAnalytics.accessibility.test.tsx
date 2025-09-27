import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import GoogleAnalytics from './GoogleAnalytics';
import { useConsent } from '@/contexts/ConsentContext';
import {
  createMockConsentAllRejected,
  createMockConsentWithAnalytics,
} from '@/test-utils/consent-mocks';

// Mock Next.js Script component
vi.mock('next/script', () => ({
  default: vi.fn(() => null), // Scripts render nothing visible
}));

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}));

// Mock analytics utilities
vi.mock('@/utils/analytics', () => ({
  GA_MEASUREMENT_ID: 'G-TEST123456',
  initializeGA: vi.fn(),
  updateGAConsent: vi.fn(),
  trackPageView: vi.fn(),
}));

// Mock ConsentContext
vi.mock('@/contexts/ConsentContext', () => ({
  useConsent: vi.fn(),
}));

expect.extend(toHaveNoViolations);

describe('GoogleAnalytics Accessibility', () => {
  it('should have no accessibility violations when consent is granted', async () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());
    const { container } = render(<GoogleAnalytics />);

    // GoogleAnalytics renders Script components which don't produce visible DOM
    // The container should be empty or contain only script tags
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations when consent is denied', async () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentAllRejected());

    const { container } = render(<GoogleAnalytics />);

    // When consent is denied, nothing is rendered
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should not interfere with page accessibility', () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());
    const { container } = render(<GoogleAnalytics />);

    // GoogleAnalytics should not add any focusable elements
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    expect(focusableElements).toHaveLength(0);
  });

  it('should not add visible content to the page', () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());
    const { container } = render(<GoogleAnalytics />);

    // The component should not render any visible text
    expect(container.textContent).toBe('');
  });

  it('should not affect screen reader experience', () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());
    const { container } = render(<GoogleAnalytics />);

    // Should not have any ARIA live regions that could interrupt screen readers
    const liveRegions = container.querySelectorAll('[aria-live]');
    expect(liveRegions).toHaveLength(0);

    // Should not have any role attributes
    const elementsWithRoles = container.querySelectorAll('[role]');
    expect(elementsWithRoles).toHaveLength(0);
  });

  it('should not create layout shifts', () => {
    vi.mocked(useConsent).mockReturnValue(createMockConsentWithAnalytics());
    const { container } = render(<GoogleAnalytics />);

    // Component should not have any elements with explicit dimensions
    // that could cause layout shifts
    const allElements = container.querySelectorAll('*');
    allElements.forEach((element) => {
      const styles = window.getComputedStyle(element);
      // Scripts are injected in head/body and shouldn't affect layout
      if (element.tagName !== 'SCRIPT') {
        expect(styles.display).not.toBe('block');
        expect(styles.display).not.toBe('flex');
      }
    });
  });
});
