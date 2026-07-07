import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsentModal } from './ConsentModal';
import { useConsent } from '../../../contexts/ConsentContext';
import { CookieCategory } from '../../../utils/consent-types';

// Mock the ConsentContext to control state
vi.mock('../../../contexts/ConsentContext', async () => {
  const actual = await vi.importActual('../../../contexts/ConsentContext');
  return {
    ...actual,
    useConsent: vi.fn(),
  };
});

describe('ConsentModal', () => {
  const mockUpdateConsent = vi.fn();
  const mockSavePreferences = vi.fn();
  const mockCloseModal = vi.fn();
  const mockResetConsent = vi.fn();
  const mockAcceptAll = vi.fn();
  const mockRejectAll = vi.fn();

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
    showBanner: false,
    showModal: true,
    isLoading: false,
    updateConsent: mockUpdateConsent,
    savePreferences: mockSavePreferences,
    acceptAll: mockAcceptAll,
    rejectAll: mockRejectAll,
    closeModal: mockCloseModal,
    resetConsent: mockResetConsent,
    updateMultiple: vi.fn(),
    openModal: vi.fn(),
    dismissBanner: vi.fn(),
    setShowBanner: vi.fn(),
    setShowModal: vi.fn(),
    hasConsented: vi.fn(() => false),
    canUseCookies: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useConsent as ReturnType<typeof vi.fn>).mockReturnValue(
      defaultMockContext
    );
  });

  describe('Visibility', () => {
    it('should render when showModal is true', () => {
      render(<ConsentModal />);

      expect(
        screen.getByRole('dialog', { name: /cookie preferences/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/manage cookie preferences/i)
      ).toBeInTheDocument();
    });

    it('should not render when showModal is false', () => {
      (useConsent as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultMockContext,
        showModal: false,
      });

      const { container } = render(<ConsentModal />);
      expect(container.firstChild).toBeNull();
    });

    it('should not render when loading', () => {
      (useConsent as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultMockContext,
        isLoading: true,
      });

      const { container } = render(<ConsentModal />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Cookie Categories', () => {
    it('should display all cookie categories', () => {
      render(<ConsentModal />);

      expect(screen.getByText(/necessary cookies/i)).toBeInTheDocument();
      expect(screen.getByText(/functional cookies/i)).toBeInTheDocument();
      expect(screen.getByText(/analytics cookies/i)).toBeInTheDocument();
      expect(screen.getByText(/marketing cookies/i)).toBeInTheDocument();
    });

    it('should show necessary cookies as always enabled', () => {
      render(<ConsentModal />);

      const necessaryToggle = screen.getByRole('checkbox', {
        name: /necessary cookies/i,
      });
      expect(necessaryToggle).toBeChecked();
      expect(necessaryToggle).toBeDisabled();
    });

    it('should show current consent state for each category', () => {
      (useConsent as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultMockContext,
        consent: {
          ...defaultMockContext.consent,
          functional: true,
          analytics: false,
          marketing: true,
        },
      });

      render(<ConsentModal />);

      expect(
        screen.getByRole('checkbox', { name: /functional cookies/i })
      ).toBeChecked();
      expect(
        screen.getByRole('checkbox', { name: /analytics cookies/i })
      ).not.toBeChecked();
      expect(
        screen.getByRole('checkbox', { name: /marketing cookies/i })
      ).toBeChecked();
    });

    it('should update consent when toggling a category', async () => {
      const user = userEvent.setup();
      render(<ConsentModal />);

      const functionalToggle = screen.getByRole('checkbox', {
        name: /functional cookies/i,
      });
      await user.click(functionalToggle);

      expect(mockUpdateConsent).toHaveBeenCalledWith(
        CookieCategory.FUNCTIONAL,
        true
      );
    });
  });

  describe('Action Buttons', () => {
    it('should call acceptAll when Accept All button is clicked', async () => {
      const user = userEvent.setup();
      render(<ConsentModal />);

      const acceptButton = screen.getByRole('button', { name: /accept all/i });
      await user.click(acceptButton);

      expect(mockAcceptAll).toHaveBeenCalledTimes(1);
    });

    it('should call rejectAll when Reject All button is clicked', async () => {
      const user = userEvent.setup();
      render(<ConsentModal />);

      const rejectButton = screen.getByRole('button', { name: /reject all/i });
      await user.click(rejectButton);

      expect(mockRejectAll).toHaveBeenCalledTimes(1);
    });

    it('should save preferences when Save Preferences button is clicked', async () => {
      const user = userEvent.setup();
      render(<ConsentModal />);

      const saveButton = screen.getByRole('button', {
        name: 'Save cookie preferences',
      });
      await user.click(saveButton);

      expect(mockSavePreferences).toHaveBeenCalled();
    });

    it('should close modal when Close button is clicked', async () => {
      const user = userEvent.setup();
      render(<ConsentModal />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockCloseModal).toHaveBeenCalledTimes(1);
    });
  });

  describe('Privacy Links', () => {
    it('should display privacy policy link when provided', () => {
      render(<ConsentModal privacyPolicyUrl="/privacy" />);

      const link = screen.getByRole('link', { name: /privacy policy/i });
      expect(link).toHaveAttribute('href', '/privacy');
    });

    it('should display cookie policy link when provided', () => {
      render(<ConsentModal cookiePolicyUrl="/cookies" />);

      const link = screen.getByRole('link', { name: /cookie policy/i });
      expect(link).toHaveAttribute('href', '/cookies');
    });

    it('should not display links when not provided', () => {
      render(<ConsentModal />);

      expect(
        screen.queryByRole('link', { name: /privacy policy/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /cookie policy/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<ConsentModal />);

      const modal = screen.getByRole('dialog', { name: /cookie preferences/i });
      expect(modal).toHaveAttribute('aria-label', 'Cookie preferences modal');
      expect(modal).toHaveAttribute('aria-modal', 'true');
    });

    it('should trap focus within modal', async () => {
      const user = userEvent.setup();
      render(<ConsentModal />);

      // Wait for focus to be set
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Close modal' })
        ).toHaveFocus();
      });

      // Tab through elements
      await user.tab();
      // Should focus on first checkbox (functional since necessary is disabled)
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[1]).toHaveFocus();
    });

    it('should close modal on Escape key', async () => {
      const user = userEvent.setup();
      render(<ConsentModal />);

      await user.keyboard('{Escape}');

      expect(mockCloseModal).toHaveBeenCalledTimes(1);
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ConsentModal />);

      // Wait for focus
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Close modal' })
        ).toHaveFocus();
      });

      await user.tab();
      const firstToggle = screen.getAllByRole('checkbox')[1]; // Skip necessary which is disabled
      expect(firstToggle).toHaveFocus();

      await user.keyboard(' '); // Space to toggle
      expect(mockUpdateConsent).toHaveBeenCalled();
    });
  });

  describe('Category Descriptions', () => {
    it('should display descriptions for each category', () => {
      render(<ConsentModal />);

      expect(
        screen.getByText(/essential for the website to function/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/remember your preferences/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/understand how you use our website/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/show you relevant ads/i)).toBeInTheDocument();
    });

    it('should display expandable details for each category', async () => {
      const user = userEvent.setup();
      render(<ConsentModal showDetails />);

      const detailsButton = screen.getByRole('button', {
        name: /learn more about functional cookies/i,
      });
      await user.click(detailsButton);

      expect(
        screen.getByText(
          /these cookies help us provide enhanced functionality/i
        )
      ).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive layout classes', () => {
      render(<ConsentModal />);

      const modal = screen.getByRole('dialog');
      expect(modal.className).toContain('max-w-2xl');
      expect(modal.className).toContain('w-full');
      expect(modal.className).toContain('mx-4');
    });

    it('should scroll when content overflows', () => {
      render(<ConsentModal />);

      const categoryContainer = screen.getByRole('group', {
        name: /cookie categories/i,
      });
      expect(categoryContainer.className).toContain('overflow-y-auto');
      expect(categoryContainer.className).toContain('max-h-96');
    });
  });

  describe('Custom Callbacks', () => {
    it('should call onSave callback after saving preferences', async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();

      render(<ConsentModal onSave={onSave} />);

      await user.click(
        screen.getByRole('button', { name: 'Save cookie preferences' })
      );

      expect(mockSavePreferences).toHaveBeenCalled();
      expect(onSave).toHaveBeenCalled();
    });

    it('should call onClose callback when closing', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(<ConsentModal onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: /close/i }));

      expect(mockCloseModal).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Last Updated', () => {
    it('should display last updated timestamp when consent exists', () => {
      const lastUpdated = new Date('2024-01-15T10:00:00Z').getTime();
      (useConsent as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultMockContext,
        consent: {
          ...defaultMockContext.consent,
          lastUpdated,
        },
      });

      render(<ConsentModal />);

      expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
      expect(screen.getByText(/1\/15\/2024/)).toBeInTheDocument();
    });

    it('should not display last updated for new users', () => {
      (useConsent as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultMockContext,
        consent: {
          ...defaultMockContext.consent,
          lastUpdated: undefined,
        },
      });

      render(<ConsentModal />);

      expect(screen.queryByText(/last updated:/i)).not.toBeInTheDocument();
    });
  });
});
