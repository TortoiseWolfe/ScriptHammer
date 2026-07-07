/**
 * Unit tests for DataExportButton component
 * Task: T189
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataExportButton from './DataExportButton';

// Mock GDPR service using vi.hoisted for proper hoisting
const { mockExportUserData } = vi.hoisted(() => ({
  mockExportUserData: vi.fn(),
}));

vi.mock('@/services/messaging/gdpr-service', () => ({
  gdprService: {
    exportUserData: mockExportUserData,
  },
}));

// Setup DOM mocks at module level
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('DataExportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    const result = render(<DataExportButton />);
    screen.debug(); // Debug what's actually rendered

    expect(
      screen.getByRole('button', { name: /download my data/i })
    ).toBeInTheDocument();
  });

  it('should show loading state while exporting', async () => {
    const mockExportData = {
      export_date: '2025-11-22T12:00:00Z',
      user_id: 'user-123',
      profile: {
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
      },
      connections: [],
      conversations: [],
      statistics: {
        total_conversations: 0,
        total_messages_sent: 0,
        total_messages_received: 0,
        total_connections: 0,
      },
    };

    mockExportUserData.mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve(mockExportData), 100))
    );

    render(<DataExportButton />);

    const button = screen.getByRole('button', { name: /download my data/i });
    await userEvent.click(button);

    // Should show loading state - check button text content
    expect(button).toHaveTextContent(/exporting/i);
    expect(button).toBeDisabled();

    // Verify ARIA live region announces loading state
    expect(screen.getByRole('status')).toHaveTextContent(
      /exporting your data/i
    );

    // Wait for export to complete
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });

  it('should trigger file download on successful export', async () => {
    const mockExportData = {
      export_date: '2025-11-22T12:00:00Z',
      user_id: 'user-123',
      profile: {
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
      },
      connections: [],
      conversations: [],
      statistics: {
        total_conversations: 0,
        total_messages_sent: 0,
        total_messages_received: 0,
        total_connections: 0,
      },
    };

    mockExportUserData.mockResolvedValue(mockExportData);

    const onExportComplete = vi.fn();
    render(<DataExportButton onExportComplete={onExportComplete} />);

    const button = screen.getByRole('button', { name: /download my data/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(onExportComplete).toHaveBeenCalled();
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('should show error message on export failure', async () => {
    mockExportUserData.mockRejectedValue(new Error('Export failed'));

    const onExportError = vi.fn();
    render(<DataExportButton onExportError={onExportError} />);

    const button = screen.getByRole('button', { name: /download my data/i });
    await userEvent.click(button);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/export failed/i);
      expect(onExportError).toHaveBeenCalled();
    });
  });

  it('should have accessible loading state', async () => {
    mockExportUserData.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<DataExportButton />);

    const button = screen.getByRole('button', { name: /download my data/i });
    await userEvent.click(button);

    // Check ARIA live region
    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent(/exporting your data/i);
  });

  it('applies custom className when provided', () => {
    const { container } = render(<DataExportButton className="custom-class" />);

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
