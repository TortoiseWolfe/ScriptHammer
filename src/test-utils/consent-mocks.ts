/**
 * Test helpers for consent-related mocks
 * Provides complete mock objects with all required properties
 */

import type {
  ConsentState,
  ConsentContextValue,
  ConsentMethod,
} from '@/utils/consent-types';
import { vi } from 'vitest';

/**
 * Create a complete mock ConsentState with all required properties
 */
export function createMockConsentState(
  overrides?: Partial<ConsentState>
): ConsentState {
  return {
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
    timestamp: Date.now(),
    version: '1.0.0',
    lastUpdated: Date.now(),
    method: 'default' as ConsentMethod,
    ...overrides,
  };
}

/**
 * Create a complete mock ConsentContextValue for testing
 */
export function createMockConsentContext(
  overrides?: Partial<ConsentContextValue>
): ConsentContextValue {
  const defaultContext: ConsentContextValue = {
    consent: createMockConsentState(overrides?.consent),
    showBanner: false,
    showModal: false,
    isLoading: false,
    updateConsent: vi.fn(),
    updateMultiple: vi.fn(),
    acceptAll: vi.fn(),
    rejectAll: vi.fn(),
    savePreferences: vi.fn(),
    setShowBanner: vi.fn(),
    setShowModal: vi.fn(),
    dismissBanner: vi.fn(),
    openModal: vi.fn(),
    closeModal: vi.fn(),
    hasConsented: vi.fn(() => true),
    canUseCookies: vi.fn(() => false),
    resetConsent: vi.fn(),
  };

  return {
    ...defaultContext,
    ...overrides,
  };
}

/**
 * Create mock consent context with analytics enabled
 */
export function createMockConsentWithAnalytics(): ConsentContextValue {
  return createMockConsentContext({
    consent: createMockConsentState({ analytics: true }),
    canUseCookies: vi.fn((category) => category === 'analytics'),
  });
}

/**
 * Create mock consent context with all cookies accepted
 */
export function createMockConsentAllAccepted(): ConsentContextValue {
  return createMockConsentContext({
    consent: createMockConsentState({
      functional: true,
      analytics: true,
      marketing: true,
    }),
    canUseCookies: vi.fn(() => true),
  });
}

/**
 * Create mock consent context with all cookies rejected
 */
export function createMockConsentAllRejected(): ConsentContextValue {
  return createMockConsentContext({
    consent: createMockConsentState({
      functional: false,
      analytics: false,
      marketing: false,
    }),
    canUseCookies: vi.fn((category) => category === 'necessary'),
  });
}
