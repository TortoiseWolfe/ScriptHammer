/**
 * PaymentConsentModal Component
 * GDPR-compliant consent UI before loading external payment scripts
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { usePaymentConsent } from '@/hooks/usePaymentConsent';

export interface PaymentConsentModalProps {
  showLogo?: boolean;
  customMessage?: string;
  onConsentGranted?: () => void;
  onConsentDeclined?: () => void;
}

/**
 * Modal for requesting payment consent per GDPR requirements
 *
 * @example
 * ```tsx
 * function PaymentPage() {
 *   const { showModal } = usePaymentConsent();
 *
 *   return (
 *     <>
 *       {showModal && <PaymentConsentModal />}
 *       <PaymentButton ... />
 *     </>
 *   );
 * }
 * ```
 */
export const PaymentConsentModal: React.FC<PaymentConsentModalProps> = ({
  showLogo = true,
  customMessage,
  onConsentGranted,
  onConsentDeclined,
}) => {
  const { showModal, grantConsent, declineConsent } = usePaymentConsent();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const acceptButtonRef = useRef<HTMLButtonElement>(null);

  // Open/close dialog based on showModal state
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (showModal && !dialog.open) {
      dialog.showModal();
      // Focus accept button when modal opens
      acceptButtonRef.current?.focus();
    } else if (!showModal && dialog.open) {
      dialog.close();
    }
  }, [showModal]);

  // Prevent closing via ESC key or backdrop click
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault(); // Prevent default ESC/backdrop close
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, []);

  const handleAccept = () => {
    grantConsent();
    if (onConsentGranted) {
      onConsentGranted();
    }
  };

  const handleDecline = () => {
    declineConsent();
    if (onConsentDeclined) {
      onConsentDeclined();
    }
  };

  if (!showModal) return null;

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-open"
      aria-labelledby="consent-modal-title"
      aria-describedby="consent-modal-description"
    >
      <div className="modal-box max-w-lg">
        {/* Header */}
        {showLogo && (
          <div className="mb-4 flex justify-center">
            <svg
              className="text-primary h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
        )}

        <h3
          id="consent-modal-title"
          className="mb-4 text-center text-2xl font-bold"
        >
          Payment Consent Required
        </h3>

        <div id="consent-modal-description" className="space-y-4 text-base">
          <p>
            {customMessage ||
              'To process payments, we need your consent to load external payment provider scripts (Stripe and PayPal).'}
          </p>

          <div className="bg-base-200 rounded-lg p-4">
            <h4 className="mb-2 font-semibold">What this means:</h4>
            <ul className="list-inside list-disc space-y-1 text-sm">
              <li>External scripts will be loaded from Stripe and PayPal</li>
              <li>
                Your payment data will be processed securely by these providers
              </li>
              <li>
                No payment scripts are loaded without your explicit consent
              </li>
              <li>You can revoke this consent at any time in settings</li>
            </ul>
          </div>

          <div className="border-info bg-info/10 rounded-lg border-l-4 p-4">
            <p className="flex items-start gap-2 text-sm">
              <svg
                className="text-info mt-0.5 h-5 w-5 shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                This is required for GDPR compliance. Your privacy is important
                to us.
              </span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="modal-action flex-col gap-2 sm:flex-row">
          <button
            ref={acceptButtonRef}
            type="button"
            className="btn btn-primary min-h-11 flex-1"
            onClick={handleAccept}
            aria-label="Accept payment consent and continue"
          >
            Accept & Continue
          </button>
          <button
            type="button"
            className="btn btn-ghost min-h-11 flex-1"
            onClick={handleDecline}
            aria-label="Decline payment consent"
          >
            Decline
          </button>
        </div>

        {/* Privacy Notice */}
        <p className="text-base-content/60 mt-4 text-center text-xs">
          By accepting, you agree to our payment processing terms.
          <br />
          Read our{' '}
          <a
            href="/privacy"
            className="link-hover link"
            aria-label="Read privacy policy"
          >
            Privacy Policy
          </a>{' '}
          for more details.
        </p>
      </div>
    </dialog>
  );
};

PaymentConsentModal.displayName = 'PaymentConsentModal';
