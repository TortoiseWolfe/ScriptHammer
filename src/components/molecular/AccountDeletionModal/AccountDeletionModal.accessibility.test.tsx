/**
 * Accessibility tests for AccountDeletionModal component
 * Task: T194
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import AccountDeletionModal from './AccountDeletionModal';
import * as gdprService from '@/services/messaging/gdpr-service';

expect.extend(toHaveNoViolations);

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock GDPR service using vi.hoisted for proper hoisting
const { mockDeleteUserAccount } = vi.hoisted(() => ({
  mockDeleteUserAccount: vi.fn(),
}));

vi.mock('@/services/messaging/gdpr-service', () => ({
  gdprService: {
    deleteUserAccount: mockDeleteUserAccount,
  },
}));

describe('AccountDeletionModal Accessibility', () => {
  const mockRouter = {
    push: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue(mockRouter as any);
  });

  it('should have no accessibility violations when open', async () => {
    const { container } = render(
      <AccountDeletionModal isOpen={true} onClose={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper dialog role and labels', () => {
    render(<AccountDeletionModal isOpen={true} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'delete-modal-title');
    expect(dialog).toHaveAttribute(
      'aria-describedby',
      'delete-modal-description'
    );
  });

  it('should have accessible input labels', () => {
    render(<AccountDeletionModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('DELETE');
    // Text is broken up by <span> element, use custom matcher
    const label = screen.getByText((content, element) => {
      return (
        element?.tagName === 'SPAN' &&
        element.textContent === 'Type DELETE to confirm:'
      );
    });

    expect(input).toHaveAccessibleName();
    expect(label).toBeInTheDocument();
  });

  it('should have ARIA live region for status updates', () => {
    render(<AccountDeletionModal isOpen={true} onClose={vi.fn()} />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
  });

  it('should announce validation errors to screen readers', async () => {
    render(<AccountDeletionModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('DELETE');

    // Type incorrect text
    await userEvent.type(input, 'delete');

    // Should have aria-invalid
    expect(input).toHaveAttribute('aria-invalid', 'true');

    // Should have aria-describedby pointing to error message
    expect(input).toHaveAttribute('aria-describedby', 'confirmation-error');

    // Error message should be visible - find parent element with id
    const errorMessage = screen.getByText(/please type delete exactly/i);
    expect(errorMessage).toBeInTheDocument();

    // The id is on the parent label/container element, not the text span
    const errorContainer = errorMessage.closest('[id="confirmation-error"]');
    expect(errorContainer).toHaveAttribute('id', 'confirmation-error');
  });

  it('should announce loading state to screen readers', async () => {
    mockDeleteUserAccount.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<AccountDeletionModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('DELETE');
    const deleteButton = screen.getByRole('button', {
      name: /delete my account permanently/i,
    });

    // Type confirmation
    await userEvent.type(input, 'DELETE');

    // Click delete
    await userEvent.click(deleteButton);

    // Live region should announce deletion in progress
    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent(/deleting your account/i);
  });

  it('should announce errors to screen readers', async () => {
    mockDeleteUserAccount.mockRejectedValue(new Error('Deletion failed'));

    render(<AccountDeletionModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('DELETE');
    const deleteButton = screen.getByRole('button', {
      name: /delete my account permanently/i,
    });

    // Type confirmation
    await userEvent.type(input, 'DELETE');

    // Click delete
    await userEvent.click(deleteButton);

    // Wait for error
    await screen.findByRole('alert');

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent(/error.*deletion failed/i);
  });

  it('should be keyboard accessible', async () => {
    const onClose = vi.fn();
    render(<AccountDeletionModal isOpen={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText('DELETE');
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const deleteButton = screen.getByRole('button', {
      name: /delete my account permanently/i,
    });

    // Type DELETE to enable the delete button (it's disabled by default)
    await userEvent.type(input, 'DELETE');

    // Should be able to tab through controls
    input.focus();
    expect(input).toHaveFocus();

    await userEvent.tab();
    expect(cancelButton).toHaveFocus();

    await userEvent.tab();
    expect(deleteButton).toHaveFocus();

    // Should be able to cancel with keyboard
    cancelButton.focus();
    await userEvent.keyboard('{Enter}');
    expect(onClose).toHaveBeenCalled();
  });

  it('should have minimum touch target sizes (44x44px)', () => {
    render(<AccountDeletionModal isOpen={true} onClose={vi.fn()} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const deleteButton = screen.getByRole('button', {
      name: /delete my account permanently/i,
    });
    const input = screen.getByPlaceholderText('DELETE');

    // Buttons should have minimum touch targets
    expect(cancelButton).toHaveClass('min-h-11', 'min-w-11');
    expect(deleteButton).toHaveClass('min-h-11', 'min-w-11');

    // Input should have minimum height
    expect(input).toHaveClass('min-h-11');
  });

  it('should have proper semantic HTML', () => {
    const { container } = render(
      <AccountDeletionModal isOpen={true} onClose={vi.fn()} />
    );

    // Modal should be a <dialog> element
    const dialog = screen.getByRole('dialog');
    expect(dialog.tagName).toBe('DIALOG');

    // Buttons should be <button> elements
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const deleteButton = screen.getByRole('button', {
      name: /delete my account permanently/i,
    });
    expect(cancelButton.tagName).toBe('BUTTON');
    expect(deleteButton.tagName).toBe('BUTTON');

    // Input should be <input> element
    const input = screen.getByPlaceholderText('DELETE');
    expect(input.tagName).toBe('INPUT');

    // SVG icons should be hidden from screen readers
    const svgs = container.querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('should have required attribute on confirmation input', () => {
    render(<AccountDeletionModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('DELETE');
    expect(input).toHaveAttribute('aria-required', 'true');
  });
});
