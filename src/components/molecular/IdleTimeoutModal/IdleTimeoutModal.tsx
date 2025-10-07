import React from 'react';

export interface IdleTimeoutModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Seconds remaining before timeout */
  timeRemaining: number;
  /** Callback when user clicks Continue */
  onContinue: () => void;
  /** Callback when user clicks Sign Out */
  onSignOut: () => void;
}

/**
 * IdleTimeoutModal Component
 * Warning modal shown before automatic sign-out due to inactivity
 *
 * @category molecular
 */
export default function IdleTimeoutModal({
  isOpen,
  timeRemaining,
  onContinue,
  onSignOut,
}: IdleTimeoutModalProps) {
  if (!isOpen) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="text-lg font-bold">Session Timeout Warning</h3>
        <p className="py-4">
          You&apos;ve been inactive for a while. For your security, you&apos;ll
          be automatically signed out in:
        </p>
        <div
          className="text-warning text-center text-4xl font-bold"
          role="timer"
          aria-live="polite"
        >
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
        <p className="text-base-content/70 pt-4 text-sm">
          Click &quot;Continue&quot; to stay signed in, or &quot;Sign Out&quot;
          to sign out now.
        </p>
        <div className="modal-action">
          <button
            className="btn btn-primary min-h-11 min-w-11"
            onClick={onContinue}
            aria-label="Continue session"
          >
            Continue
          </button>
          <button
            className="btn btn-ghost min-h-11 min-w-11"
            onClick={onSignOut}
            aria-label="Sign out now"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
