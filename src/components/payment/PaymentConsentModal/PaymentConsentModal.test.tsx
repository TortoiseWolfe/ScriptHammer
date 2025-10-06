/**
 * PaymentConsentModal Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentConsentModal } from './PaymentConsentModal';

// Mock the consent hook
const mockGrantConsent = vi.fn();
const mockDeclineConsent = vi.fn();
const mockResetConsent = vi.fn();

vi.mock('@/hooks/usePaymentConsent', () => ({
  usePaymentConsent: vi.fn(),
}));

// Import after mocking
import { usePaymentConsent } from '@/hooks/usePaymentConsent';

describe('PaymentConsentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementation to default state for each test
    vi.mocked(usePaymentConsent).mockReturnValue({
      showModal: true,
      hasConsent: false,
      consentDate: null,
      grantConsent: mockGrantConsent,
      declineConsent: mockDeclineConsent,
      resetConsent: mockResetConsent,
    });
  });

  it('renders modal with title and description', () => {
    render(<PaymentConsentModal />);

    expect(
      screen.getByRole('heading', { name: /Payment Consent Required/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/To process payments/i)).toBeInTheDocument();
  });

  it('displays logo by default', () => {
    const { container } = render(<PaymentConsentModal />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('hides logo when showLogo is false', () => {
    const { container } = render(<PaymentConsentModal showLogo={false} />);
    const svgs = container.querySelectorAll('svg');
    // Should only have info icon, not lock icon
    expect(svgs.length).toBeLessThan(3);
  });

  it('displays custom message when provided', () => {
    const customMessage = 'This is a custom consent message';
    render(<PaymentConsentModal customMessage={customMessage} />);

    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('renders accept and decline buttons', () => {
    render(<PaymentConsentModal />);

    expect(
      screen.getByRole('button', {
        name: /Accept payment consent and continue/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Decline payment consent/i })
    ).toBeInTheDocument();
  });

  it('calls grantConsent when accept button clicked', async () => {
    const user = userEvent.setup();
    render(<PaymentConsentModal />);

    const acceptButton = screen.getByRole('button', {
      name: /Accept payment consent and continue/i,
    });
    await user.click(acceptButton);

    expect(mockGrantConsent).toHaveBeenCalledTimes(1);
  });

  it('calls declineConsent when decline button clicked', async () => {
    const user = userEvent.setup();
    render(<PaymentConsentModal />);

    const declineButton = screen.getByRole('button', {
      name: /Decline payment consent/i,
    });
    await user.click(declineButton);

    expect(mockDeclineConsent).toHaveBeenCalledTimes(1);
  });

  it('calls onConsentGranted callback when provided', async () => {
    const user = userEvent.setup();
    const onConsentGranted = vi.fn();
    render(<PaymentConsentModal onConsentGranted={onConsentGranted} />);

    const acceptButton = screen.getByRole('button', {
      name: /Accept payment consent and continue/i,
    });
    await user.click(acceptButton);

    expect(onConsentGranted).toHaveBeenCalledTimes(1);
  });

  it('calls onConsentDeclined callback when provided', async () => {
    const user = userEvent.setup();
    const onConsentDeclined = vi.fn();
    render(<PaymentConsentModal onConsentDeclined={onConsentDeclined} />);

    const declineButton = screen.getByRole('button', {
      name: /Decline payment consent/i,
    });
    await user.click(declineButton);

    expect(onConsentDeclined).toHaveBeenCalledTimes(1);
  });

  it('does not render when showModal is false', () => {
    vi.mocked(usePaymentConsent).mockReturnValue({
      showModal: false,
      hasConsent: true,
      consentDate: new Date().toISOString(),
      grantConsent: vi.fn(),
      declineConsent: vi.fn(),
      resetConsent: vi.fn(),
    });

    const { container } = render(<PaymentConsentModal />);
    expect(container.firstChild).toBeNull();
  });

  it('has proper ARIA labels for accessibility', () => {
    render(<PaymentConsentModal />);

    const dialog = document.querySelector('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'consent-modal-title');
    expect(dialog).toHaveAttribute(
      'aria-describedby',
      'consent-modal-description'
    );
  });

  it('displays information about data usage', () => {
    render(<PaymentConsentModal />);

    expect(screen.getByText(/What this means:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/External scripts will be loaded/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your payment data will be processed securely/i)
    ).toBeInTheDocument();
  });

  it('displays GDPR compliance notice', () => {
    render(<PaymentConsentModal />);

    expect(
      screen.getByText(/required for GDPR compliance/i)
    ).toBeInTheDocument();
  });

  it('includes link to privacy policy', () => {
    render(<PaymentConsentModal />);

    const privacyLink = screen.getByRole('link', {
      name: /Read privacy policy/i,
    });
    expect(privacyLink).toHaveAttribute('href', '/privacy');
  });

  it('prevents modal from closing via ESC key', () => {
    render(<PaymentConsentModal />);

    const dialog = document.querySelector('dialog');
    const cancelEvent = new Event('cancel', { cancelable: true });

    dialog?.dispatchEvent(cancelEvent);

    // Modal should still be visible
    expect(
      screen.getByRole('heading', { name: /Payment Consent Required/i })
    ).toBeInTheDocument();
  });

  it('has minimum touch target size for buttons', () => {
    const { container } = render(<PaymentConsentModal />);

    const buttons = container.querySelectorAll('button');
    buttons.forEach((button) => {
      expect(button).toHaveClass('min-h-11');
    });
  });

  it('focuses accept button when modal opens', async () => {
    render(<PaymentConsentModal />);

    await waitFor(() => {
      const acceptButton = screen.getByRole('button', {
        name: /Accept payment consent and continue/i,
      });
      expect(acceptButton).toHaveFocus();
    });
  });
});
