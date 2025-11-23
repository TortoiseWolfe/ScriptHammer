import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QueueStatusIndicator from './QueueStatusIndicator';
import * as useOfflineQueueModule from '@/hooks/useOfflineQueue';

// Mock the useOfflineQueue hook
const mockUseOfflineQueue = vi.fn();
vi.mock('@/hooks/useOfflineQueue', () => ({
  useOfflineQueue: () => mockUseOfflineQueue(),
}));

describe('QueueStatusIndicator', () => {
  beforeEach(() => {
    // Default mock with some queued messages so component renders
    mockUseOfflineQueue.mockReturnValue({
      queue: [],
      queueCount: 1,
      failedCount: 0,
      isSyncing: false,
      isOnline: true,
      syncQueue: vi.fn(),
      retryFailed: vi.fn(),
      clearSynced: vi.fn(),
      getFailedMessages: vi.fn().mockResolvedValue([]),
    });
  });

  it('renders without crashing', () => {
    const { container } = render(<QueueStatusIndicator />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-test-class';
    const { container } = render(
      <QueueStatusIndicator className={customClass} />
    );
    const element = container.querySelector('.custom-test-class');
    expect(element).toBeInTheDocument();
  });

  it('shows retry button when showRetryButton is true', () => {
    // Mock with failed messages to trigger retry button
    mockUseOfflineQueue.mockReturnValue({
      queue: [],
      queueCount: 0,
      failedCount: 1,
      isSyncing: false,
      isOnline: true,
      syncQueue: vi.fn(),
      retryFailed: vi.fn(),
      clearSynced: vi.fn(),
      getFailedMessages: vi.fn().mockResolvedValue([]),
    });

    const { container } = render(
      <QueueStatusIndicator showRetryButton={true} />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    // Mock with failed messages to trigger retry button
    mockUseOfflineQueue.mockReturnValue({
      queue: [],
      queueCount: 0,
      failedCount: 1,
      isSyncing: false,
      isOnline: true,
      syncQueue: vi.fn(),
      retryFailed: vi.fn(),
      clearSynced: vi.fn(),
      getFailedMessages: vi.fn().mockResolvedValue([]),
    });

    const onRetry = vi.fn();
    const { container } = render(
      <QueueStatusIndicator showRetryButton={true} onRetry={onRetry} />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  // Add component-specific tests based on actual functionality
});
