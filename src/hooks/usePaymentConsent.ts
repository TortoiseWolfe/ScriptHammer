/**
 * usePaymentConsent Hook
 * Manages GDPR payment consent for external payment scripts (Stripe, PayPal)
 */

'use client';

import { useState, useEffect } from 'react';

export interface PaymentConsentState {
  hasConsent: boolean;
  showModal: boolean;
  consentDate: string | null;
}

export interface PaymentConsentActions {
  grantConsent: () => void;
  declineConsent: () => void;
  resetConsent: () => void;
}

export type UsePaymentConsentReturn = PaymentConsentState &
  PaymentConsentActions;

/**
 * Hook for managing payment consent state
 *
 * @example
 * ```tsx
 * function PaymentPage() {
 *   const { hasConsent, showModal, grantConsent, declineConsent } = usePaymentConsent();
 *
 *   if (showModal) {
 *     return <PaymentConsentModal onAccept={grantConsent} onDecline={declineConsent} />;
 *   }
 *
 *   return hasConsent ? <PaymentButton /> : <p>Consent required</p>;
 * }
 * ```
 */
export function usePaymentConsent(): UsePaymentConsentReturn {
  const [hasConsent, setHasConsent] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [consentDate, setConsentDate] = useState<string | null>(null);

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    const consent = localStorage.getItem('payment_consent');
    const date = localStorage.getItem('payment_consent_date');

    setConsentDate(date);

    if (consent === 'granted') {
      setHasConsent(true);
      setShowModal(false);
    } else {
      // Show modal if no consent or declined
      // Note: We retry each visit (don't permanently store 'declined' per GDPR)
      setHasConsent(false);
      setShowModal(true);
    }
  }, []);

  const grantConsent = () => {
    const now = new Date().toISOString();
    localStorage.setItem('payment_consent', 'granted');
    localStorage.setItem('payment_consent_date', now);
    setHasConsent(true);
    setConsentDate(now);
    setShowModal(false);
    console.log('✅ Payment consent granted');
  };

  const declineConsent = () => {
    // Store decline but allow retry on next visit
    localStorage.setItem('payment_consent', 'declined');
    setHasConsent(false);
    setShowModal(false);
    console.log('❌ Payment consent declined');
  };

  const resetConsent = () => {
    localStorage.removeItem('payment_consent');
    localStorage.removeItem('payment_consent_date');
    setHasConsent(false);
    setConsentDate(null);
    setShowModal(true);
  };

  return {
    hasConsent,
    showModal,
    consentDate,
    grantConsent,
    declineConsent,
    resetConsent,
  };
}
