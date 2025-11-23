/**
 * Unit tests for AccountDeletionModal component
 * Task: T190
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import AccountDeletionModal from './AccountDeletionModal';
import * as gdprService from '@/services/messaging/gdpr-service';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock GDPR service
vi.mock('@/services/messaging/gdpr-service');

describe('AccountDeletionModal', () => {
  const mockRouter = {
    push: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue(mockRouter as any);
  });

  it('renders without crashing when closed', () => {
    const { container } = render(
      <AccountDeletionModal isOpen={false} onClose={vi.fn()} />
    );

    // Modal should not have open attribute when closed
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toHaveAttribute('open');
  });

  it('renders modal content when open', () => {
    render(<AccountDeletionModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/delete account permanently/i)).toBeInTheDocument();
    expect(
      screen.getByText(/this action cannot be undone/i)
    ).toBeInTheDocument();
    // Text is broken up by <span> element, so use custom matcher targeting the span
    expect(
      screen.getByText((content, element) => {
        return (
          element?.tagName === 'SPAN' &&
          element.textContent === 'Type DELETE to confirm:'
        );
      })
    ).toBeInTheDocument();
  });

  it('enables delete button only when "DELETE" is typed correctly', async () => {
    render(<AccountDeletionModal isOpen={true} onClose={vi.fn()} />);

    const deleteButton = screen.getByRole('button', {
      name: /delete my account permanently/i,
    });
    const input = screen.getByPlaceholderText('DELETE');

    // Initially disabled
    expect(deleteButton).toBeDisabled();

    // Typing wrong text keeps it disabled
    await userEvent.type(input, 'delete');
    expect(deleteButton).toBeDisabled();

    // Clear and type correct text
    await userEvent.clear(input);
    await userEvent.type(input, 'DELETE');

    // Now enabled
    expect(deleteButton).not.toBeDisabled();
  });

  it('shows validation error for incorrect confirmation text', async () => {
    render(<AccountDeletionModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('DELETE');

    await userEvent.type(input, 'delete');

    expect(screen.getByText(/please type delete exactly/i)).toBeInTheDocument();
  });

  it('calls deleteUserAccount and redirects on successful deletion', async () => {
    vi.mocked(gdprService.gdprService.deleteUserAccount).mockResolvedValue(
      undefined
    );

    const onDeleteComplete = vi.fn();
    render(
      <AccountDeletionModal
        isOpen={true}
        onClose={vi.fn()}
        onDeleteComplete={onDeleteComplete}
      />
    );

    const input = screen.getByPlaceholderText('DELETE');
    const deleteButton = screen.getByRole('button', {
      name: /delete my account permanently/i,
    });

    // Type confirmation
    await userEvent.type(input, 'DELETE');

    // Click delete
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(gdprService.gdprService.deleteUserAccount).toHaveBeenCalled();
      expect(onDeleteComplete).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith(
        '/sign-in?message=account_deleted'
      );
    });
  });

  it('shows error message on deletion failure', async () => {
    vi.mocked(gdprService.gdprService.deleteUserAccount).mockRejectedValue(
      new Error('Deletion failed')
    );

    const onDeleteError = vi.fn();
    render(
      <AccountDeletionModal
        isOpen={true}
        onClose={vi.fn()}
        onDeleteError={onDeleteError}
      />
    );

    const input = screen.getByPlaceholderText('DELETE');
    const deleteButton = screen.getByRole('button', {
      name: /delete my account permanently/i,
    });

    // Type confirmation
    await userEvent.type(input, 'DELETE');

    // Click delete
    await userEvent.click(deleteButton);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/deletion failed/i);
      expect(onDeleteError).toHaveBeenCalled();
    });
  });

  it('disables all controls while deleting', async () => {
    vi.mocked(gdprService.gdprService.deleteUserAccount).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<AccountDeletionModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('DELETE');
    const deleteButton = screen.getByRole('button', {
      name: /delete my account permanently/i,
    });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    // Type confirmation
    await userEvent.type(input, 'DELETE');

    // Click delete
    await userEvent.click(deleteButton);

    // All controls should be disabled
    await waitFor(() => {
      expect(input).toBeDisabled();
      expect(deleteButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });
  });

  it('calls onClose when cancel button is clicked', async () => {
    const onClose = vi.fn();
    render(<AccountDeletionModal isOpen={true} onClose={onClose} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await userEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('resets state when modal closes', async () => {
    const { rerender } = render(
      <AccountDeletionModal isOpen={true} onClose={vi.fn()} />
    );

    const input = screen.getByPlaceholderText('DELETE');
    await userEvent.type(input, 'DELETE');

    // Close modal
    rerender(<AccountDeletionModal isOpen={false} onClose={vi.fn()} />);

    // Reopen modal
    rerender(<AccountDeletionModal isOpen={true} onClose={vi.fn()} />);

    // Input should be cleared
    const newInput = screen.getByPlaceholderText('DELETE');
    expect(newInput).toHaveValue('');
  });

  it('has accessible ARIA attributes', () => {
    render(<AccountDeletionModal isOpen={true} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'delete-modal-title');
    expect(dialog).toHaveAttribute(
      'aria-describedby',
      'delete-modal-description'
    );

    const input = screen.getByPlaceholderText('DELETE');
    expect(input).toHaveAttribute('aria-required', 'true');
  });
});
