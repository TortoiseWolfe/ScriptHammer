import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrivacyControls } from './PrivacyControls';
import { useConsent } from '../../../contexts/ConsentContext';
import { clearUserData } from '../../../utils/privacy';

// clearUserData wipes real browser storage. Mocking it is what lets these tests assert
// that it is NOT called — the whole point of #955.
vi.mock('../../../utils/privacy', async () => {
  const actual = await vi.importActual('../../../utils/privacy');
  return {
    ...actual,
    clearUserData: vi.fn().mockResolvedValue({ success: true }),
    exportUserData: vi.fn().mockResolvedValue({}),
  };
});

// Mock the ConsentContext to control state
vi.mock('../../../contexts/ConsentContext', async () => {
  const actual = await vi.importActual('../../../contexts/ConsentContext');
  return {
    ...actual,
    useConsent: vi.fn(),
  };
});

describe('PrivacyControls', () => {
  const mockOpenModal = vi.fn();
  const mockResetConsent = vi.fn();
  const mockHasConsented = vi.fn();

  const defaultMockContext = {
    consent: {
      necessary: true,
      functional: true,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
      version: '1.0.0',
      lastUpdated: Date.now(),
      method: 'banner_accept_all',
    },
    showBanner: false,
    showModal: false,
    isLoading: false,
    openModal: mockOpenModal,
    resetConsent: mockResetConsent,
    hasConsented: mockHasConsented,
    updateConsent: vi.fn(),
    updateMultiple: vi.fn(),
    acceptAll: vi.fn(),
    rejectAll: vi.fn(),
    savePreferences: vi.fn(),
    closeModal: vi.fn(),
    dismissBanner: vi.fn(),
    setShowBanner: vi.fn(),
    setShowModal: vi.fn(),
    canUseCookies: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useConsent as ReturnType<typeof vi.fn>).mockReturnValue(
      defaultMockContext
    );
  });

  describe('Basic Rendering', () => {
    it('should render the privacy controls component', () => {
      render(<PrivacyControls />);

      expect(screen.getByText('Privacy Settings')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Manage cookie preferences' })
      ).toBeInTheDocument();
    });

    it('should display current consent status', () => {
      mockHasConsented.mockReturnValue(true);
      render(<PrivacyControls />);

      expect(screen.getByText(/consent status:/i)).toBeInTheDocument();
      expect(screen.getByText(/active/i)).toBeInTheDocument();
    });

    it('should show no consent for new users', () => {
      mockHasConsented.mockReturnValue(false);
      render(<PrivacyControls />);

      expect(screen.getByText(/no consent given/i)).toBeInTheDocument();
    });
  });

  describe('Consent Summary', () => {
    it('should display summary of enabled cookies', () => {
      render(<PrivacyControls />);

      expect(screen.getByText('Necessary:')).toBeInTheDocument();
      expect(screen.getByText('Functional:')).toBeInTheDocument();
      expect(screen.getByText('Analytics:')).toBeInTheDocument();
      expect(screen.getByText('Marketing:')).toBeInTheDocument();
      // Check for checkmarks/crosses separately
      const statuses = screen.getAllByText(/[✓✗]/);
      expect(statuses).toHaveLength(4);
    });

    it('should update when consent changes', () => {
      const { rerender } = render(<PrivacyControls />);

      // Update consent
      (useConsent as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultMockContext,
        consent: {
          ...defaultMockContext.consent,
          analytics: true,
          marketing: true,
        },
      });

      rerender(<PrivacyControls />);

      const statuses = screen.getAllByText('✓');
      expect(statuses).toHaveLength(4); // All enabled now
    });
  });

  describe('Actions', () => {
    it('should open modal when Manage Cookies button is clicked', async () => {
      const user = userEvent.setup();
      render(<PrivacyControls />);

      const manageButton = screen.getByRole('button', {
        name: 'Manage cookie preferences',
      });
      await user.click(manageButton);

      expect(mockOpenModal).toHaveBeenCalledTimes(1);
    });

    it('should allow revoking consent', async () => {
      const user = userEvent.setup();
      mockHasConsented.mockReturnValue(true);
      // showConfirmation={false} explicitly (#955): this asserts the revoke ACTION, not the
      render(<PrivacyControls showConfirmation={false} />);

      const revokeButton = screen.getByRole('button', {
        name: /revoke consent/i,
      });
      await user.click(revokeButton);

      expect(mockResetConsent).toHaveBeenCalledTimes(1);
    });

    it('should show confirmation before revoking', async () => {
      const user = userEvent.setup();
      mockHasConsented.mockReturnValue(true);
      render(<PrivacyControls showConfirmation />);

      const revokeButton = screen.getByRole('button', {
        name: /revoke consent/i,
      });
      await user.click(revokeButton);

      // Should show confirmation dialog
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      expect(mockResetConsent).toHaveBeenCalledTimes(1);
    });
  });

  describe('Expanded View', () => {
    it('should show detailed information when expanded', async () => {
      const user = userEvent.setup();
      render(<PrivacyControls expandable />);

      const expandButton = screen.getByRole('button', {
        name: /show details/i,
      });
      await user.click(expandButton);

      expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
      expect(screen.getByText(/consent method:/i)).toBeInTheDocument();
    });

    it('should display last updated date', () => {
      const lastUpdated = new Date('2024-01-15T10:00:00Z').getTime();
      (useConsent as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultMockContext,
        consent: {
          ...defaultMockContext.consent,
          lastUpdated,
        },
      });

      render(<PrivacyControls expanded />);

      expect(screen.getByText(/1\/15\/2024/)).toBeInTheDocument();
    });

    it('should display consent method', () => {
      render(<PrivacyControls expanded />);

      expect(screen.getByText(/consent method:/i)).toBeInTheDocument();
      expect(screen.getByText(/banner accept all/i)).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('should render in compact mode', () => {
      render(<PrivacyControls compact />);

      const container = screen.getByRole('region', {
        name: /privacy controls/i,
      });
      expect(container.className).toContain('compact');
    });

    it('should show only essential info in compact mode', () => {
      render(<PrivacyControls compact />);

      expect(
        screen.getByRole('button', { name: /manage/i })
      ).toBeInTheDocument();
      expect(screen.queryByText(/consent status:/i)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<PrivacyControls />);

      const container = screen.getByRole('region', {
        name: /privacy controls/i,
      });
      expect(container).toHaveAttribute('aria-label', 'Privacy controls');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<PrivacyControls />);

      await user.tab();
      expect(
        screen.getByRole('button', { name: 'Manage cookie preferences' })
      ).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(mockOpenModal).toHaveBeenCalled();
    });

    it('should announce status changes', async () => {
      const { rerender } = render(<PrivacyControls />);

      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');

      // Change consent
      (useConsent as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultMockContext,
        consent: {
          ...defaultMockContext.consent,
          analytics: true,
        },
      });

      rerender(<PrivacyControls />);

      expect(statusRegion).toHaveTextContent('Analytics:');
      expect(statusRegion).toHaveTextContent('✓');
    });
  });

  describe('Custom Styling', () => {
    it('should accept custom className', () => {
      render(<PrivacyControls className="custom-class" />);

      const container = screen.getByRole('region', {
        name: /privacy controls/i,
      });
      expect(container.className).toContain('custom-class');
    });

    it('should apply theme classes', () => {
      render(<PrivacyControls theme="dark" />);

      const container = screen.getByRole('region', {
        name: /privacy controls/i,
      });
      expect(container.className).toContain('bg-base-200');
    });
  });

  describe('Loading State', () => {
    it('should show loading state when data is loading', () => {
      (useConsent as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultMockContext,
        isLoading: true,
      });

      render(<PrivacyControls />);

      expect(screen.getByText(/loading privacy settings/i)).toBeInTheDocument();
    });

    it('should not show actions while loading', () => {
      (useConsent as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultMockContext,
        isLoading: true,
      });

      render(<PrivacyControls />);

      expect(
        screen.queryByRole('button', { name: 'Manage cookie preferences' })
      ).not.toBeInTheDocument();
    });
  });

  describe('Custom Callbacks', () => {
    it('should call onManage callback when opening modal', async () => {
      const onManage = vi.fn();
      const user = userEvent.setup();

      render(<PrivacyControls onManage={onManage} />);

      await user.click(
        screen.getByRole('button', { name: 'Manage cookie preferences' })
      );

      expect(mockOpenModal).toHaveBeenCalled();
      expect(onManage).toHaveBeenCalled();
    });

    it('should call onRevoke callback when revoking consent', async () => {
      const onRevoke = vi.fn();
      const user = userEvent.setup();
      mockHasConsented.mockReturnValue(true);

      // Explicit opt-out (#955): this asserts the callback fires, not that a guard exists.
      render(<PrivacyControls onRevoke={onRevoke} showConfirmation={false} />);

      await user.click(screen.getByRole('button', { name: /revoke consent/i }));

      expect(mockResetConsent).toHaveBeenCalled();
      expect(onRevoke).toHaveBeenCalled();
    });
  });

  /**
   * #955: /privacy-controls deleted ALL browser storage on the FIRST click.
   *
   * The confirmation dialog existed and was correct — it just was not switched on. The
   * prop defaulted to false, and src/app/privacy-controls/page.tsx passes no props, so the
   * only route that ships this component ran the destructive path immediately. The dialog
   * saying "This action cannot be undone" never rendered on the page it was written for.
   *
   * There was NO test over the delete path at all, which is how it shipped. A component
   * whose safety is opt-in ships unsafe, because the safe path requires the consumer to
   * know the prop exists.
   */
  describe('Destructive actions confirm by default (#955)', () => {
    beforeEach(() => {
      vi.mocked(clearUserData).mockClear();
    });

    it('does NOT delete anything on the first click, with no props', () => {
      // Rendered exactly as the route does — propless. This is the regression.
      return (async () => {
        const user = userEvent.setup();
        render(<PrivacyControls />);

        await user.click(
          screen.getByRole('button', { name: /delete my data/i })
        );

        expect(clearUserData).not.toHaveBeenCalled();
      })();
    });

    it('warns that the action cannot be undone before doing it', async () => {
      const user = userEvent.setup();
      render(<PrivacyControls />);

      await user.click(screen.getByRole('button', { name: /delete my data/i }));

      expect(screen.getByText(/delete all data\?/i)).toBeInTheDocument();
      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    });

    it('deletes only after the second, explicit confirmation', async () => {
      const user = userEvent.setup();
      render(<PrivacyControls />);

      await user.click(screen.getByRole('button', { name: /delete my data/i }));
      await user.click(screen.getByRole('button', { name: /confirm delete/i }));

      expect(clearUserData).toHaveBeenCalledTimes(1);
    });

    it('cancelling deletes nothing and dismisses the dialog', async () => {
      // Without this, "confirms" would be satisfied by a dialog with no working way out.
      const user = userEvent.setup();
      render(<PrivacyControls />);

      await user.click(screen.getByRole('button', { name: /delete my data/i }));
      await user.click(screen.getByRole('button', { name: /^cancel$/i }));

      expect(clearUserData).not.toHaveBeenCalled();
      expect(screen.queryByText(/delete all data\?/i)).not.toBeInTheDocument();
    });

    it('revoking consent confirms by default too — the same prop gates both', async () => {
      const user = userEvent.setup();
      mockHasConsented.mockReturnValue(true);
      render(<PrivacyControls />);

      await user.click(screen.getByRole('button', { name: /revoke consent/i }));
      expect(mockResetConsent).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /confirm/i }));
      expect(mockResetConsent).toHaveBeenCalledTimes(1);
    });

    it('still allows an explicit opt-out, so the escape hatch is real', async () => {
      // ANTI-VACUITY: without this, "confirms by default" would be satisfied by a
      // component that had lost the ability to act at all.
      const user = userEvent.setup();
      render(<PrivacyControls showConfirmation={false} />);

      await user.click(screen.getByRole('button', { name: /delete my data/i }));

      expect(clearUserData).toHaveBeenCalledTimes(1);
    });

    it('gives the confirm and cancel buttons a 44px touch target', async () => {
      // This dialog has never been reachable on the route that ships it, so no gate has
      // ever measured it. Making it reachable without this would ship a 32px `btn-sm`
      // DESTRUCTIVE control on mobile — below the AAA floor this project targets.
      const user = userEvent.setup();
      render(<PrivacyControls />);

      await user.click(screen.getByRole('button', { name: /delete my data/i }));

      for (const name of [/confirm delete/i, /^cancel$/i]) {
        const button = screen.getByRole('button', { name });
        expect(button.className).toMatch(/min-h-11/);
        expect(button.className).toMatch(/min-w-11/);
      }
    });
  });
});
