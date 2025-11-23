'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { gdprService } from '@/services/messaging/gdpr-service';

export interface AccountDeletionModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when deletion completes successfully */
  onDeleteComplete?: () => void;
  /** Callback when deletion fails */
  onDeleteError?: (error: Error) => void;
}

/**
 * AccountDeletionModal component
 * Task: T187
 *
 * Confirmation modal for permanent account deletion.
 * Requires typing "DELETE" to confirm.
 *
 * @category molecular
 */
export default function AccountDeletionModal({
  isOpen,
  onClose,
  onDeleteComplete,
  onDeleteError,
}: AccountDeletionModalProps) {
  const router = useRouter();
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDialogElement>(null);

  // Open/close modal
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.showModal();
    } else if (!isOpen && modalRef.current) {
      modalRef.current.close();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmationText('');
      setError(null);
    }
  }, [isOpen]);

  const isConfirmed = confirmationText === 'DELETE';

  const handleDelete = async () => {
    if (!isConfirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      await gdprService.deleteUserAccount();
      onDeleteComplete?.();

      // Redirect to sign-in page after successful deletion
      router.push('/sign-in?message=account_deleted');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to delete account';
      setError(errorMessage);
      onDeleteError?.(err instanceof Error ? err : new Error(errorMessage));
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      onClose();
    }
  };

  return (
    <dialog
      ref={modalRef}
      className="modal"
      onClose={handleClose}
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-description"
    >
      <div className="modal-box max-w-md">
        <h3 id="delete-modal-title" className="text-error text-lg font-bold">
          Delete Account Permanently
        </h3>

        <div id="delete-modal-description" className="py-4">
          <div className="alert alert-warning mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 shrink-0 stroke-current"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-sm">
              This action cannot be undone. All your messages, connections, and
              account data will be permanently deleted.
            </span>
          </div>

          <p className="mb-4 text-sm">What will be deleted:</p>
          <ul className="mb-4 ml-4 list-disc space-y-1 text-sm">
            <li>All messages you&apos;ve sent and received</li>
            <li>All conversations and connections</li>
            <li>Your user profile and account</li>
            <li>All encryption keys</li>
          </ul>

          <div className="form-control">
            <label htmlFor="confirmation-input" className="label">
              <span className="label-text font-semibold">
                Type <span className="text-error font-mono">DELETE</span> to
                confirm:
              </span>
            </label>
            <input
              id="confirmation-input"
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              disabled={isDeleting}
              className="input input-bordered min-h-11"
              placeholder="DELETE"
              autoComplete="off"
              aria-required="true"
              aria-invalid={confirmationText.length > 0 && !isConfirmed}
              aria-describedby={
                confirmationText.length > 0 && !isConfirmed
                  ? 'confirmation-error'
                  : undefined
              }
            />
            {confirmationText.length > 0 && !isConfirmed && (
              <label id="confirmation-error" className="label">
                <span className="label-text-alt text-error">
                  Please type DELETE exactly (case-sensitive)
                </span>
              </label>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="alert alert-error mt-4" role="alert">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 shrink-0 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="modal-action">
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="btn btn-ghost min-h-11 min-w-11"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className="btn btn-error min-h-11 min-w-11"
            aria-label="Delete my account permanently"
          >
            {isDeleting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Deleting...
              </>
            ) : (
              'Delete Account'
            )}
          </button>
        </div>

        {/* ARIA live region for status updates */}
        <div
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {isDeleting && 'Deleting your account...'}
          {error && `Error: ${error}`}
          {!isDeleting && !error && isConfirmed && 'Ready to delete'}
        </div>
      </div>

      {/* Backdrop */}
      <form method="dialog" className="modal-backdrop">
        <button
          disabled={isDeleting}
          onClick={handleClose}
          aria-label="Close modal"
        >
          close
        </button>
      </form>
    </dialog>
  );
}
