/**
 * usePaymentConsent Hook
 * Manages GDPR payment consent for external payment scripts (Stripe, PayPal)
 */

'use client';

import { useState, useEffect } from 'react';
import { createLogger } from '@/lib/logger';

const logger = createLogger('hooks:paymentConsent');

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
  // Initialize synchronously from localStorage to avoid flash of consent
  // section on reload (useState lazy initializer runs once, before first render).
  const [hasConsent, setHasConsent] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('payment_consent') === 'granted';
    } catch {
      return false;
    }
  });
  const [showModal, setShowModal] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('payment_consent') !== 'granted';
    } catch {
      return true;
    }
  });
  const [consentDate, setConsentDate] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem('payment_consent_date');
    } catch {
      return null;
    }
  });

  const grantConsent = () => {
    const now = new Date().toISOString();
    try {
      localStorage.setItem('payment_consent', 'granted');
      localStorage.setItem('payment_consent_date', now);
    } catch (error) {
      logger.warn(
        'localStorage access blocked, consent stored in memory only',
        { error }
      );
    }
    setHasConsent(true);
    setConsentDate(now);
    setShowModal(false);
    logger.info('Payment consent granted');
  };

  const declineConsent = () => {
    try {
      // Store decline but allow retry on next visit
      localStorage.setItem('payment_consent', 'declined');
    } catch (error) {
      logger.warn(
        'localStorage access blocked, consent stored in memory only',
        { error }
      );
    }
    setHasConsent(false);
    setShowModal(false);
    logger.info('Payment consent declined');
  };

  const resetConsent = () => {
    try {
      localStorage.removeItem('payment_consent');
      localStorage.removeItem('payment_consent_date');
    } catch (error) {
      logger.warn('localStorage access blocked', { error });
    }
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
