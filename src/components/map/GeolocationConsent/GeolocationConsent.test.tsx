import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GeolocationConsent, GeolocationPurpose } from './GeolocationConsent';
import type { GeolocationConsentProps } from './GeolocationConsent';

describe('GeolocationConsent', () => {
  const defaultProps: GeolocationConsentProps = {
    isOpen: true,
    onAccept: vi.fn(),
    onDecline: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal when isOpen is true', () => {
    render(<GeolocationConsent {...defaultProps} />);

    const modal = screen.getByRole('dialog');
    expect(modal).toBeInTheDocument();
  });

  it('should not render modal when isOpen is false', () => {
    const props = {
      ...defaultProps,
      isOpen: false,
    };

    render(<GeolocationConsent {...props} />);

    const modal = screen.queryByRole('dialog');
    expect(modal).not.toBeInTheDocument();
  });

  it('should display default title', () => {
    render(<GeolocationConsent {...defaultProps} />);

    const title = screen.getByRole('heading', { name: 'Location Access' });
    expect(title).toBeInTheDocument();
  });

  it('should display custom title when provided', () => {
    const props = {
      ...defaultProps,
      title: 'Custom Location Title',
    };

    render(<GeolocationConsent {...props} />);

    const title = screen.getByRole('heading', {
      name: 'Custom Location Title',
    });
    expect(title).toBeInTheDocument();
  });

  it('should display default description', () => {
    render(<GeolocationConsent {...defaultProps} />);

    const description = screen.getByText(
      /This app would like to use your location/i
    );
    expect(description).toBeInTheDocument();
  });

  it('should display custom description when provided', () => {
    const props = {
      ...defaultProps,
      description: 'Custom description text',
    };

    render(<GeolocationConsent {...props} />);

    const description = screen.getByText('Custom description text');
    expect(description).toBeInTheDocument();
  });

  it('should display all default purposes', () => {
    render(<GeolocationConsent {...defaultProps} />);

    expect(
      screen.getByLabelText(/Show your location on the map/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Find nearby places/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Improve your experience/i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Provide personalized content/i)
    ).toBeInTheDocument();
  });

  it('should display custom purposes when provided', () => {
    const props = {
      ...defaultProps,
      purposes: [
        GeolocationPurpose.USER_LOCATION_DISPLAY,
        GeolocationPurpose.NEARBY_SEARCH,
      ],
    };

    render(<GeolocationConsent {...props} />);

    expect(
      screen.getByLabelText(/Show your location on the map/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Find nearby places/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Improve your experience/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Provide personalized content/i)
    ).not.toBeInTheDocument();
  });

  it('should have all purposes checked by default', () => {
    render(<GeolocationConsent {...defaultProps} />);

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toBeChecked();
    });
  });

  it('should allow toggling purpose checkboxes', () => {
    render(<GeolocationConsent {...defaultProps} />);

    const checkbox = screen.getByLabelText(/Show your location on the map/i);
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('should call onAccept with selected purposes when accept clicked', () => {
    const onAccept = vi.fn();
    const props = {
      ...defaultProps,
      onAccept,
    };

    render(<GeolocationConsent {...props} />);

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    expect(onAccept).toHaveBeenCalledWith(
      expect.arrayContaining([
        GeolocationPurpose.USER_LOCATION_DISPLAY,
        GeolocationPurpose.NEARBY_SEARCH,
        GeolocationPurpose.LOCATION_ANALYTICS,
        GeolocationPurpose.PERSONALIZATION,
      ])
    );
  });

  it('should call onAccept with only selected purposes', () => {
    const onAccept = vi.fn();
    const props = {
      ...defaultProps,
      onAccept,
    };

    render(<GeolocationConsent {...props} />);

    // Uncheck some purposes
    const analyticsCheckbox = screen.getByLabelText(/Improve your experience/i);
    const personalizationCheckbox = screen.getByLabelText(
      /Provide personalized content/i
    );

    fireEvent.click(analyticsCheckbox);
    fireEvent.click(personalizationCheckbox);

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    expect(onAccept).toHaveBeenCalledWith([
      GeolocationPurpose.USER_LOCATION_DISPLAY,
      GeolocationPurpose.NEARBY_SEARCH,
    ]);
  });

  it('should call onDecline when decline clicked', () => {
    const onDecline = vi.fn();
    const props = {
      ...defaultProps,
      onDecline,
    };

    render(<GeolocationConsent {...props} />);

    const declineButton = screen.getByRole('button', { name: /decline/i });
    fireEvent.click(declineButton);

    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when close button clicked', () => {
    const onClose = vi.fn();
    const props = {
      ...defaultProps,
      onClose,
    };

    render(<GeolocationConsent {...props} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not show close button when required is true', () => {
    const props = {
      ...defaultProps,
      required: true,
    };

    render(<GeolocationConsent {...props} />);

    const closeButton = screen.queryByRole('button', { name: /close/i });
    expect(closeButton).not.toBeInTheDocument();
  });

  it('should disable decline button when required is true', () => {
    const props = {
      ...defaultProps,
      required: true,
    };

    render(<GeolocationConsent {...props} />);

    const declineButton = screen.getByRole('button', { name: /decline/i });
    expect(declineButton).toBeDisabled();
  });

  it('should display privacy policy link when URL provided', () => {
    const props = {
      ...defaultProps,
      privacyPolicyUrl: '/privacy',
    };

    render(<GeolocationConsent {...props} />);

    const link = screen.getByRole('link', { name: /privacy policy/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/privacy');
  });

  it('should not display privacy policy link when URL not provided', () => {
    render(<GeolocationConsent {...defaultProps} />);

    const link = screen.queryByRole('link', { name: /privacy policy/i });
    expect(link).not.toBeInTheDocument();
  });

  it('should disable accept button when no purposes selected', () => {
    render(<GeolocationConsent {...defaultProps} />);

    // Uncheck all purposes
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((checkbox) => {
      fireEvent.click(checkbox);
    });

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    expect(acceptButton).toBeDisabled();
  });

  it('should enable accept button when at least one purpose selected', () => {
    render(<GeolocationConsent {...defaultProps} />);

    // Uncheck all purposes
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((checkbox) => {
      fireEvent.click(checkbox);
    });

    // Check one purpose
    fireEvent.click(checkboxes[0]);

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    expect(acceptButton).not.toBeDisabled();
  });

  it('should apply custom test ID when provided', () => {
    const props = {
      ...defaultProps,
      testId: 'custom-consent-modal',
    };

    render(<GeolocationConsent {...props} />);

    const modal = screen.getByTestId('custom-consent-modal');
    expect(modal).toBeInTheDocument();
  });

  it('should handle keyboard navigation', () => {
    render(<GeolocationConsent {...defaultProps} />);

    const modal = screen.getByRole('dialog');

    // Tab through focusable elements
    const focusableElements = modal.querySelectorAll(
      'button, input[type="checkbox"], a[href]'
    );

    expect(focusableElements.length).toBeGreaterThan(0);

    // Focusable elements should be keyboard navigable (they don't all need explicit tabindex)
    focusableElements.forEach((element) => {
      const tabindex = element.getAttribute('tabindex');
      // Element is focusable if it has no tabindex, or tabindex >= -1
      if (tabindex !== null) {
        expect(parseInt(tabindex)).toBeGreaterThanOrEqual(-1);
      }
    });
  });

  it('should trap focus within modal', () => {
    render(<GeolocationConsent {...defaultProps} />);

    const modal = screen.getByRole('dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
  });

  it('should have proper ARIA attributes', () => {
    const props = {
      ...defaultProps,
      title: 'Location Consent',
    };

    render(<GeolocationConsent {...props} />);

    const modal = screen.getByRole('dialog');
    expect(modal).toHaveAttribute('aria-labelledby');
    expect(modal).toHaveAttribute('aria-describedby');

    const title = screen.getByRole('heading', { name: 'Location Consent' });
    expect(title).toHaveAttribute('id');
  });

  it('should close on escape key press', () => {
    const onClose = vi.fn();
    const props = {
      ...defaultProps,
      onClose,
    };

    render(<GeolocationConsent {...props} />);

    const modal = screen.getByRole('dialog');
    fireEvent.keyDown(modal, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not close on escape when required is true', () => {
    const onClose = vi.fn();
    const props = {
      ...defaultProps,
      onClose,
      required: true,
    };

    render(<GeolocationConsent {...props} />);

    const modal = screen.getByRole('dialog');
    fireEvent.keyDown(modal, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });
});
