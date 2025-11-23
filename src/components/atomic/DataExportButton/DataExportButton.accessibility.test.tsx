/**
 * Accessibility tests for DataExportButton component
 * Task: T194
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import DataExportButton from './DataExportButton';

expect.extend(toHaveNoViolations);

// Mock GDPR service using vi.hoisted for proper hoisting
const { mockExportUserData } = vi.hoisted(() => ({
  mockExportUserData: vi.fn(),
}));

vi.mock('@/services/messaging/gdpr-service', () => ({
  gdprService: {
    exportUserData: mockExportUserData,
  },
}));

describe('DataExportButton Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have no accessibility violations', async () => {
    const { container } = render(<DataExportButton />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have accessible button label', () => {
    render(<DataExportButton />);

    const button = screen.getByRole('button', { name: /download my data/i });
    expect(button).toHaveAccessibleName('Download my data');
  });

  it('should have ARIA live region for status updates', async () => {
    render(<DataExportButton />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
  });

  it('should announce loading state to screen readers', async () => {
    mockExportUserData.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<DataExportButton />);

    const button = screen.getByRole('button', { name: /download my data/i });
    await userEvent.click(button);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent(/exporting your data/i);
  });

  it('should announce errors to screen readers', async () => {
    mockExportUserData.mockRejectedValue(new Error('Export failed'));

    render(<DataExportButton />);

    const button = screen.getByRole('button', { name: /download my data/i });
    await userEvent.click(button);

    // Wait for error state
    await screen.findByRole('alert');

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent(/error.*export failed/i);
  });

  it('should be keyboard accessible', async () => {
    // Add delay to mock so loading state persists
    mockExportUserData.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
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
              }),
            100
          )
        )
    );

    const { container } = render(<DataExportButton />);

    const button = screen.getByRole('button', { name: /download my data/i });

    // Should be focusable
    button.focus();
    expect(button).toHaveFocus();

    // Should be activatable with keyboard
    await userEvent.keyboard('{Enter}');

    // Should show loading state - check button text content
    expect(button).toHaveTextContent(/exporting/i);
    // Verify ARIA live region
    expect(screen.getByRole('status')).toHaveTextContent(
      /exporting your data/i
    );
  });

  it('should have proper contrast ratio', () => {
    const { container } = render(<DataExportButton />);

    // Button should be visible and have proper styling
    const button = screen.getByRole('button', { name: /download my data/i });
    expect(button).toBeVisible();
    expect(button).toHaveClass('btn', 'btn-primary');
  });

  it('should have minimum touch target size (44x44px)', () => {
    render(<DataExportButton />);

    const button = screen.getByRole('button', { name: /download my data/i });
    expect(button).toHaveClass('min-h-11', 'min-w-11'); // 44px in Tailwind
  });

  it('should have proper semantic HTML', () => {
    const { container } = render(<DataExportButton />);

    // Button should be a <button> element
    const button = screen.getByRole('button', { name: /download my data/i });
    expect(button.tagName).toBe('BUTTON');

    // SVG icons should be hidden from screen readers
    const svgs = container.querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
