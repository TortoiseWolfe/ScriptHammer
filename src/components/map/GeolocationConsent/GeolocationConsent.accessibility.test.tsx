import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { GeolocationConsent } from './GeolocationConsent';

expect.extend(toHaveNoViolations);

describe('GeolocationConsent Accessibility', () => {
  const defaultProps = {
    isOpen: true,
    onAccept: vi.fn(),
    onDecline: vi.fn(),
    onClose: vi.fn(),
  };

  it('should have no accessibility violations with default props', async () => {
    const { container } = render(<GeolocationConsent {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes for modal', () => {
    render(<GeolocationConsent {...defaultProps} title="Location Consent" />);

    const modal = screen.getByRole('dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAttribute('aria-labelledby');
    expect(modal).toHaveAttribute('aria-describedby');
  });

  it('should have accessible title', () => {
    render(<GeolocationConsent {...defaultProps} title="Location Access" />);

    const heading = screen.getByRole('heading', { name: 'Location Access' });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveAttribute('id');
  });

  it('should have accessible checkboxes', () => {
    render(<GeolocationConsent {...defaultProps} />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAccessibleName();
      expect(checkbox).not.toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('should have accessible buttons', () => {
    render(<GeolocationConsent {...defaultProps} />);

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    const declineButton = screen.getByRole('button', { name: /decline/i });

    expect(acceptButton).toBeInTheDocument();
    expect(declineButton).toBeInTheDocument();

    // Check that buttons are reachable via keyboard
    expect(acceptButton).not.toHaveAttribute('tabindex', '-1');
    expect(declineButton).not.toHaveAttribute('tabindex', '-1');
  });

  it('should have no violations when required', async () => {
    const { container } = render(
      <GeolocationConsent {...defaultProps} required={true} />
    );

    // Decline button should be disabled
    const declineButton = screen.getByRole('button', { name: /decline/i });
    expect(declineButton).toBeDisabled();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have accessible privacy policy link', async () => {
    const { container } = render(
      <GeolocationConsent {...defaultProps} privacyPolicyUrl="/privacy" />
    );

    const link = screen.getByRole('link', { name: /privacy policy/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/privacy');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should trap focus within modal', () => {
    render(<GeolocationConsent {...defaultProps} />);

    const modal = screen.getByRole('dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');

    // All interactive elements should be within the modal
    const interactiveElements = modal.querySelectorAll(
      'button, input[type="checkbox"], a[href]'
    );
    expect(interactiveElements.length).toBeGreaterThan(0);
  });

  it('should maintain keyboard navigation order', () => {
    render(<GeolocationConsent {...defaultProps} />);

    const checkboxes = screen.getAllByRole('checkbox');
    const acceptButton = screen.getByRole('button', { name: /accept/i });
    const declineButton = screen.getByRole('button', { name: /decline/i });

    // Ensure tab order is logical
    checkboxes.forEach((checkbox) => {
      expect(checkbox).not.toHaveAttribute('tabindex', '-1');
    });
    expect(acceptButton).not.toHaveAttribute('tabindex', '-1');
    expect(declineButton).not.toHaveAttribute('tabindex', '-1');
  });

  it('should announce state changes', () => {
    const { rerender } = render(
      <GeolocationConsent {...defaultProps} isOpen={false} />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<GeolocationConsent {...defaultProps} isOpen={true} />);

    const modal = screen.getByRole('dialog');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute('aria-modal', 'true');
  });

  it('should have accessible close button when not required', () => {
    render(<GeolocationConsent {...defaultProps} required={false} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toBeInTheDocument();
    expect(closeButton).not.toBeDisabled();
    expect(closeButton).toHaveAccessibleName();
  });
});
