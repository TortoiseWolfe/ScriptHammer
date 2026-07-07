import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CookieConsent } from './CookieConsent';
import { useConsent } from '../../../contexts/ConsentContext';

// Mock the ConsentContext to control state
vi.mock('../../../contexts/ConsentContext', async () => {
  const actual = await vi.importActual('../../../contexts/ConsentContext');
  return {
    ...actual,
    useConsent: vi.fn(),
  };
});

describe('CookieConsent', () => {
  const mockAcceptAll = vi.fn();
  const mockRejectAll = vi.fn();
  const mockOpenModal = vi.fn();
  const mockDismissBanner = vi.fn();

  const defaultMockContext = {
    consent: {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
      version: '1.0.0',
      lastUpdated: Date.now(),
      method: 'default',
    },
    showBanner: true,
    showModal: false,
    isLoading: false,
    acceptAll: mockAcceptAll,
    rejectAll: mockRejectAll,
    openModal: mockOpenModal,
    dismissBanner: mockDismissBanner,
    updateConsent: vi.fn(),
    updateMultiple: vi.fn(),
    savePreferences: vi.fn(),
    setShowBanner: vi.fn(),
    setShowModal: vi.fn(),
    closeModal: vi.fn(),
    hasConsented: vi.fn(() => false),
    canUseCookies: vi.fn(),
    resetConsent: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useConsent as ReturnType<typeof vi.fn>).mockReturnValue(
      defaultMockContext
    );
  });

  describe('Visibility', () => {
    it('should render when showBanner is true', () => {
      render(<CookieConsent />);

      expect(
        screen.getByRole('region', { name: /cookie consent/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/We use cookies to enhance your experience/)
      ).toBeInTheDocument();
    });

    it('should not render when showBanner is false', () => {
      (useConsent as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultMockContext,
        showBanner: false,
      });

      const { container } = render(<CookieConsent />);
      expect(container.firstChild).toBeNull();
    });

    it('should not render when loading', () => {
      (useConsent as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultMockContext,
        isLoading: true,
      });

      const { container } = render(<CookieConsent />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Button Actions', () => {
    it('should call acceptAll when Accept All button is clicked', async () => {
      const user = userEvent.setup();
      render(<CookieConsent />);

      const acceptButton = screen.getByRole('button', { name: /accept/i });
      await user.click(acceptButton);

      expect(mockAcceptAll).toHaveBeenCalledTimes(1);
    });

    it('should call openModal when Customize button is clicked', async () => {
      const user = userEvent.setup();
      render(<CookieConsent />);

      const settingsButton = screen.getByRole('button', {
        name: /customize/i,
      });
      await user.click(settingsButton);

      expect(mockOpenModal).toHaveBeenCalledTimes(1);
    });
  });

  describe('Position', () => {
    it('should render at bottom by default', () => {
      render(<CookieConsent />);

      const banner = screen.getByRole('region', { name: /cookie consent/i });
      expect(banner.className).toContain('bottom-0');
    });

    it('should render at top when position is top', () => {
      render(<CookieConsent position="top" />);

      const banner = screen.getByRole('region', { name: /cookie consent/i });
      expect(banner.className).toContain('top-0');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<CookieConsent />);

      const banner = screen.getByRole('region', { name: /cookie consent/i });
      expect(banner).toHaveAttribute('aria-label', 'Cookie consent banner');
      expect(banner).toHaveAttribute('aria-live', 'polite');
    });

    it('should have accessible buttons', () => {
      render(<CookieConsent />);

      expect(
        screen.getByRole('button', { name: /accept/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /customize/i })
      ).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<CookieConsent />);

      // Tab through buttons
      await user.tab();
      expect(screen.getByRole('button', { name: /accept/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /customize/i })).toHaveFocus();
    });

    it('should handle Enter key on focused buttons', async () => {
      const user = userEvent.setup();
      render(<CookieConsent />);

      await user.tab();
      await user.keyboard('{Enter}');

      expect(mockAcceptAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('Content', () => {
    it('should display privacy policy link', () => {
      render(<CookieConsent privacyPolicyUrl="/privacy" />);

      const link = screen.getByText(/Learn more/);
      expect(link.closest('a')).toHaveAttribute('href', '/privacy');
    });

    it('should display custom content when provided', () => {
      const customContent = (
        <div data-testid="custom">Custom cookie message</div>
      );
      render(<CookieConsent customContent={customContent} />);

      expect(screen.getByTestId('custom')).toBeInTheDocument();
      expect(screen.getByText('Custom cookie message')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive button layout', () => {
      render(<CookieConsent />);

      const buttonContainer = screen.getByRole('group', {
        name: /consent actions/i,
      });
      expect(buttonContainer.className).toContain('flex');
      expect(buttonContainer.className).toContain('gap-2');
    });

    it('should have responsive text size', () => {
      render(<CookieConsent />);

      const message = screen.getByText(
        /We use cookies to enhance your experience/
      );
      expect(message.className).toContain('text-sm');
      expect(message.className).toContain('sm:text-base');
    });
  });

  describe('Animation', () => {
    it('should have proper positioning classes', () => {
      render(<CookieConsent />);

      const banner = screen.getByRole('region', { name: /cookie consent/i });
      expect(banner.className).toContain('fixed');
      expect(banner.className).toContain('bottom-0');
      expect(banner.className).toContain('z-[60]');
    });
  });

  describe('Custom Callbacks', () => {
    it('should call onAcceptAll callback after accepting', async () => {
      const onAcceptAll = vi.fn();
      const user = userEvent.setup();

      render(<CookieConsent onAcceptAll={onAcceptAll} />);

      await user.click(screen.getByRole('button', { name: /accept/i }));

      expect(mockAcceptAll).toHaveBeenCalled();
      expect(onAcceptAll).toHaveBeenCalled();
    });

    it('should call onCustomize callback when opening modal', async () => {
      const onCustomize = vi.fn();
      const user = userEvent.setup();

      render(<CookieConsent onCustomize={onCustomize} />);

      await user.click(screen.getByRole('button', { name: /customize/i }));

      expect(mockOpenModal).toHaveBeenCalled();
      expect(onCustomize).toHaveBeenCalled();
    });
  });
});
