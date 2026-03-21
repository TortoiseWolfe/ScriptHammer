import React from 'react';

export interface ErrorBannerProps {
  /** Error message to display */
  message: string;
  /** Callback when banner is dismissed */
  onDismiss: () => void;
}

/**
 * ErrorBanner component
 * Displays a dismissible info/error alert with an icon.
 * Uses DaisyUI alert-info styling with a dismiss button.
 * @category molecular
 */
export default function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="alert alert-info m-4 shrink-0" role="alert">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        className="h-6 w-6 shrink-0 stroke-current"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        ></path>
      </svg>
      <span>{message}</span>
      <button
        onClick={onDismiss}
        className="btn btn-ghost btn-sm min-h-11"
        aria-label="Dismiss error"
      >
        Dismiss
      </button>
    </div>
  );
}
