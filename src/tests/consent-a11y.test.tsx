import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ConsentProvider } from '@/contexts/ConsentContext';
import { CookieConsent } from '@/components/privacy/CookieConsent';

expect.extend(toHaveNoViolations);

describe('Consent Accessibility Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Cookie Banner Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <ConsentProvider>
          <CookieConsent />
        </ConsentProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA attributes', () => {
      render(
        <ConsentProvider>
          <CookieConsent />
        </ConsentProvider>
      );

      const banner = screen.getByRole('region');
      expect(banner).toHaveAttribute('aria-label', 'Cookie consent banner');
      expect(banner).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Focus Management', () => {
    it('should manage focus correctly when banner appears', () => {
      render(
        <ConsentProvider>
          <CookieConsent />
        </ConsentProvider>
      );

      const banner = screen.getByRole('region');
      expect(document.activeElement).not.toBe(banner);
    });
  });
});
