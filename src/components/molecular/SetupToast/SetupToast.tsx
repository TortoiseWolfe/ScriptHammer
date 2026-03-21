import React from 'react';

export interface SetupToastProps {
  /** Callback when toast is dismissed */
  onDismiss: () => void;
}

/**
 * SetupToast component
 * Displays a success toast after messaging encryption setup,
 * reminding the user to save their messaging password.
 * @category molecular
 */
export default function SetupToast({ onDismiss }: SetupToastProps) {
  return (
    <div className="toast toast-top toast-center z-50">
      <div className="alert alert-success">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 shrink-0 stroke-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <span className="font-semibold">Encryption set up!</span>
          <p className="text-sm">
            Make sure you saved your messaging password - you&apos;ll need it on
            new devices.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="btn btn-ghost btn-sm"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
