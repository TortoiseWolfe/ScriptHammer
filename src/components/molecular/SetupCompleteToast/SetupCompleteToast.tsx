'use client';

import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'messaging_setup_complete';
const AUTO_DISMISS_MS = 10000;

export interface SetupCompleteToastProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * SetupCompleteToast — one-shot reminder after first-time encryption setup.
 *
 * The setup page sets `sessionStorage.messaging_setup_complete = 'true'`
 * before redirecting to /messages. This component reads and immediately
 * clears that flag on mount, shows the toast, and auto-dismisses after 10s.
 *
 * Fully self-contained — no props needed beyond className. The timer is
 * cleaned up on unmount (FR-003 from the original page extraction).
 *
 * @category molecular
 */
export default function SetupCompleteToast({
  className = '',
}: SetupCompleteToastProps) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;

    const setupComplete = sessionStorage.getItem(STORAGE_KEY);
    if (setupComplete === 'true') {
      setShow(true);
      sessionStorage.removeItem(STORAGE_KEY);
      timeoutRef.current = setTimeout(() => setShow(false), AUTO_DISMISS_MS);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={`toast toast-top toast-center z-50 ${className}`}
      data-testid="setup-complete-toast"
    >
      <div className="alert alert-success" role="status">
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
          onClick={() => setShow(false)}
          className="btn btn-ghost btn-sm min-h-11"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
