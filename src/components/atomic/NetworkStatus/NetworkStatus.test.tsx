import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NetworkStatus from './NetworkStatus';

// Mock useNetworkStatus hook
const mockUseNetworkStatus = vi.fn();
vi.mock('./useNetworkStatus', () => ({
  useNetworkStatus: () => mockUseNetworkStatus(),
}));

describe('NetworkStatus', () => {
  beforeEach(() => {
    // Default mock: offline state so component renders
    mockUseNetworkStatus.mockReturnValue({
      isOnline: false,
      wasOffline: false,
    });
  });

  it('renders without crashing', () => {
    const { container } = render(<NetworkStatus />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-test-class';
    const { container } = render(<NetworkStatus className={customClass} />);
    const element = container.querySelector('.custom-test-class');
    expect(element).toBeInTheDocument();
  });

  it('renders in compact mode', () => {
    const { container } = render(<NetworkStatus compact={true} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  // Add component-specific tests based on actual functionality
});
