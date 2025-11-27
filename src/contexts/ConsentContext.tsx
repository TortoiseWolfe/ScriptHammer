'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  ConsentState,
  ConsentContextValue,
  ConsentMethod,
  CookieCategory,
} from '../utils/consent-types';
import {
  getDefaultConsent,
  isConsentExpired,
  saveConsentToStorage,
  getConsentFromStorage,
  clearConsentFromStorage,
  updateConsentTimestamp,
  hasUserConsented,
  setCurrentConsentState,
} from '../utils/consent';
import { createLogger } from '@/lib/logger';
// Removed unused import - history tracking integrated inline

const logger = createLogger('contexts:consent');

/**
 * Consent Context
 */
const ConsentContext = createContext<ConsentContextValue | undefined>(
  undefined
);

/**
 * Consent Provider Component
 */
export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentState>(getDefaultConsent());
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load consent from localStorage on mount
   */
  useEffect(() => {
    try {
      const storedConsent = getConsentFromStorage();

      if (storedConsent) {
        // Check if consent is expired
        if (isConsentExpired(storedConsent)) {
          // Reset to default and show banner
          setConsent(getDefaultConsent());
          setShowBanner(true);
        } else {
          // Use stored consent
          setConsent(storedConsent);
          setShowBanner(false);
          // Update the global consent state for cookie operations
          setCurrentConsentState(storedConsent);
        }
      } else {
        // First visit - show banner
        setShowBanner(true);
      }
    } catch (error) {
      logger.error('Failed to load consent', { error });
      setShowBanner(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Save consent whenever it changes
   */
  useEffect(() => {
    if (!isLoading && hasUserConsented(consent)) {
      try {
        saveConsentToStorage(consent);
        setCurrentConsentState(consent);
      } catch (error) {
        logger.error('Failed to save consent', { error });
      }
    }
  }, [consent, isLoading]);

  /**
   * Update consent for a specific category
   */
  const updateConsent = useCallback(
    (category: CookieCategory, enabled: boolean) => {
      setConsent((prev) => {
        const updated = updateConsentTimestamp({
          ...prev,
          [category]: category === CookieCategory.NECESSARY ? true : enabled,
          method: ConsentMethod.SETTINGS_PAGE,
        });
        return updated;
      });
      setShowBanner(false);
    },
    []
  );

  /**
   * Update multiple consent categories at once
   */
  const updateMultiple = useCallback((updates: Partial<ConsentState>) => {
    setConsent((prev) => {
      const updated = updateConsentTimestamp({
        ...prev,
        ...updates,
        necessary: true, // Always keep necessary true
        method: updates.method || ConsentMethod.SETTINGS_PAGE,
      });
      return updated;
    });
    setShowBanner(false);
  }, []);

  /**
   * Accept all cookies
   */
  const acceptAll = useCallback(() => {
    const newConsent = updateConsentTimestamp({
      ...consent,
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
      method: ConsentMethod.BANNER_ACCEPT_ALL,
    });
    setConsent(newConsent);
    setShowBanner(false);
    setShowModal(false);
  }, [consent]);

  /**
   * Reject all optional cookies
   */
  const rejectAll = useCallback(() => {
    const newConsent = updateConsentTimestamp({
      ...consent,
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
      method: ConsentMethod.BANNER_REJECT_ALL,
    });
    setConsent(newConsent);
    setShowBanner(false);
    setShowModal(false);
  }, [consent]);

  /**
   * Save custom preferences
   */
  const savePreferences = useCallback(
    (preferences: Partial<ConsentState>) => {
      const newConsent = updateConsentTimestamp({
        ...consent,
        ...preferences,
        necessary: true, // Always keep necessary true
        method: ConsentMethod.BANNER_CUSTOM,
      });
      setConsent(newConsent);
      setShowBanner(false);
      setShowModal(false);
    },
    [consent]
  );

  /**
   * Dismiss banner without making a choice
   */
  const dismissBanner = useCallback(() => {
    setShowBanner(false);
  }, []);

  /**
   * Open consent modal
   */
  const openModal = useCallback(() => {
    setShowModal(true);
    setShowBanner(false);
  }, []);

  /**
   * Close consent modal
   */
  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  /**
   * Check if user has actively consented
   */
  const hasConsented = useCallback(() => {
    return hasUserConsented(consent);
  }, [consent]);

  /**
   * Check if cookies can be used for a category
   */
  const canUseCookies = useCallback(
    (category: CookieCategory) => {
      switch (category) {
        case CookieCategory.NECESSARY:
          return true;
        case CookieCategory.FUNCTIONAL:
          return consent.functional;
        case CookieCategory.ANALYTICS:
          return consent.analytics;
        case CookieCategory.MARKETING:
          return consent.marketing;
        default:
          return false;
      }
    },
    [consent]
  );

  /**
   * Reset consent to default
   */
  const resetConsent = useCallback(() => {
    const defaultConsent = getDefaultConsent();
    setConsent(defaultConsent);
    clearConsentFromStorage();
    setCurrentConsentState(defaultConsent);
    setShowBanner(true);
    setShowModal(false);
  }, []);

  /**
   * Memoize context value to prevent unnecessary re-renders
   */
  const contextValue = useMemo<ConsentContextValue>(
    () => ({
      consent,
      showBanner,
      showModal,
      isLoading,
      updateConsent,
      updateMultiple,
      acceptAll,
      rejectAll,
      savePreferences,
      setShowBanner,
      setShowModal,
      dismissBanner,
      openModal,
      closeModal,
      hasConsented,
      canUseCookies,
      resetConsent,
    }),
    [
      consent,
      showBanner,
      showModal,
      isLoading,
      updateConsent,
      updateMultiple,
      acceptAll,
      rejectAll,
      savePreferences,
      dismissBanner,
      openModal,
      closeModal,
      hasConsented,
      canUseCookies,
      resetConsent,
    ]
  );

  return (
    <ConsentContext.Provider value={contextValue}>
      {children}
    </ConsentContext.Provider>
  );
}

/**
 * Hook to use consent context
 */
export function useConsent() {
  const context = useContext(ConsentContext);
  if (context === undefined) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return context;
}

/**
 * Hook to check specific category consent
 */
export function useConsentCategory(category: CookieCategory): boolean {
  const { consent } = useConsent();

  switch (category) {
    case CookieCategory.NECESSARY:
      return true;
    case CookieCategory.FUNCTIONAL:
      return consent.functional;
    case CookieCategory.ANALYTICS:
      return consent.analytics;
    case CookieCategory.MARKETING:
      return consent.marketing;
    default:
      return false;
  }
}
