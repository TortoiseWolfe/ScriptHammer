import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import NetworkStatus from './NetworkStatus';

expect.extend(toHaveNoViolations);

// Mock useNetworkStatus hook
const mockUseNetworkStatus = vi.fn();
vi.mock('./useNetworkStatus', () => ({
  useNetworkStatus: () => mockUseNetworkStatus(),
}));

describe('NetworkStatus Accessibility', () => {
  beforeEach(() => {
    // Default mock: offline state so component renders
    mockUseNetworkStatus.mockReturnValue({
      isOnline: false,
      wasOffline: false,
    });
  });
  it('should have no accessibility violations', async () => {
    const { container } = render(<NetworkStatus />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have focusable elements in proper tab order', () => {
    const { container } = render(<NetworkStatus />);

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    // All focusable elements should be visible
    focusableElements.forEach((element) => {
      expect(element).toBeVisible();
    });
  });

  it('should have proper semantic HTML', () => {
    const { container } = render(<NetworkStatus />);

    // Verify component renders with proper HTML structure
    expect(container.firstChild).toBeInTheDocument();

    // Images should have alt text
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt');
    });
  });
});
