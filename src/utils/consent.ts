/**
 * Cookie Consent Utility Functions
 * GDPR-compliant consent management utilities
 */

import {
  ConsentState,
  ConsentMethod,
  CookieCategory,
  StorageKey,
  GoogleConsentState,
  CookieOptions,
  CookieData,
  DEFAULT_CONSENT_STATE,
  isValidConsent,
} from './consent-types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('utils:consent');

/**
 * Check if we can use cookies for a specific category
 */
export function canUseCookies(category: CookieCategory): boolean {
  try {
    const storedConsent = localStorage.getItem(StorageKey.CONSENT);
    if (!storedConsent) return false;

    const consent = JSON.parse(storedConsent) as ConsentState;

    // Check category consent
    switch (category) {
      case CookieCategory.NECESSARY:
        return true; // Always allowed
      case CookieCategory.FUNCTIONAL:
        return consent.functional === true;
      case CookieCategory.ANALYTICS:
        return consent.analytics === true;
      case CookieCategory.MARKETING:
        return consent.marketing === true;
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Get default consent state for new users
 */
export function getDefaultConsent(): ConsentState {
  return {
    ...DEFAULT_CONSENT_STATE,
    timestamp: Date.now(),
    lastUpdated: Date.now(),
  };
}

/**
 * Validate consent state from storage
 */
export function validateConsent(data: unknown): ConsentState | null {
  if (!isValidConsent(data)) {
    return null;
  }
  return data as ConsentState;
}

/**
 * Check if consent is expired (> 13 months as per GDPR)
 */
export function isConsentExpired(consent: ConsentState): boolean {
  const thirteenMonthsInMs = 13 * 30 * 24 * 60 * 60 * 1000;
  const age = Date.now() - consent.timestamp;
  return age > thirteenMonthsInMs;
}

/**
 * Migrate old consent format to current version
 */
export function migrateConsent(oldConsent: unknown): ConsentState {
  const obj = oldConsent as Record<string, unknown>;
  return {
    necessary: true, // Always true
    functional: (obj.functional as boolean) ?? false,
    analytics: (obj.analytics as boolean) ?? false,
    marketing: (obj.marketing as boolean) ?? false,
    timestamp: (obj.timestamp as number) ?? Date.now(),
    version: '1.0.0', // Current version
    lastUpdated: Date.now(),
    method: ConsentMethod.IMPORTED,
    bannerId: obj.bannerId as string | undefined,
  };
}

/**
 * Format consent for Google Consent Mode v2
 */
export function formatForGoogleConsent(
  consent: ConsentState
): GoogleConsentState {
  return {
    analytics_storage: consent.analytics ? 'granted' : 'denied',
    ad_storage: consent.marketing ? 'granted' : 'denied',
    functionality_storage: consent.functional ? 'granted' : 'denied',
    personalization_storage: consent.marketing ? 'granted' : 'denied',
    security_storage: 'granted', // Always granted for security
  };
}

/**
 * Get consent age in days
 */
export function getConsentAge(consent: ConsentState): number {
  const ageInMs = Date.now() - consent.timestamp;
  return Math.floor(ageInMs / (24 * 60 * 60 * 1000));
}

/**
 * Update consent timestamp for changes
 */
export function updateConsentTimestamp(consent: ConsentState): ConsentState {
  return {
    ...consent,
    lastUpdated: Date.now() + 1, // Ensure it's always greater than original
  };
}

/**
 * Check if user has actively consented (not default state)
 */
export function hasUserConsented(consent: ConsentState): boolean {
  return consent.method !== ConsentMethod.DEFAULT;
}

/**
 * Storage operations
 */

/**
 * Get consent from localStorage
 */
export function getConsentFromStorage(): ConsentState | null {
  try {
    const stored = localStorage.getItem(StorageKey.CONSENT);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    return validateConsent(parsed);
  } catch {
    return null;
  }
}

/**
 * Save consent to localStorage
 */
export function saveConsentToStorage(consent: ConsentState): void {
  try {
    localStorage.setItem(StorageKey.CONSENT, JSON.stringify(consent));
  } catch (error) {
    logger.error('Failed to save consent', { error });
  }
}

/**
 * Clear consent from localStorage
 */
export function clearConsentFromStorage(): void {
  try {
    localStorage.removeItem(StorageKey.CONSENT);
  } catch (error) {
    logger.error('Failed to clear consent', { error });
  }
}

/**
 * Cookie management functions
 */

// In-memory consent state for cookie operations (will be set by Context)
let currentConsentState: ConsentState | null = null;

/**
 * Set the current consent state for cookie operations
 */
export function setCurrentConsentState(consent: ConsentState): void {
  currentConsentState = consent;
}

/**
 * Check if cookies can be used for a category
 */
function canUseCategoryInternal(category: CookieCategory): boolean {
  // Always allow necessary cookies
  if (category === CookieCategory.NECESSARY) return true;

  // Check current consent state
  if (!currentConsentState) {
    // Try to load from storage if not set
    currentConsentState = getConsentFromStorage();
  }

  if (!currentConsentState) return false;

  switch (category) {
    case CookieCategory.FUNCTIONAL:
      return currentConsentState.functional;
    case CookieCategory.ANALYTICS:
      return currentConsentState.analytics;
    case CookieCategory.MARKETING:
      return currentConsentState.marketing;
    default:
      return false;
  }
}

/**
 * Set a cookie with proper consent check
 */
export function setCookie(
  name: string,
  value: string,
  category: CookieCategory,
  options: CookieOptions = {}
): boolean {
  // Check consent for category
  if (!canUseCategoryInternal(category)) {
    return false;
  }

  const {
    path = '/',
    domain,
    maxAge = 31536000, // 1 year default
    expires,
    secure = false,
    sameSite = 'Lax',
  } = options;

  let cookieString = `${name}=${encodeURIComponent(value)}`;

  if (path) cookieString += `; path=${path}`;
  if (domain) cookieString += `; domain=${domain}`;
  if (maxAge) cookieString += `; max-age=${maxAge}`;
  if (expires) cookieString += `; expires=${expires.toUTCString()}`;
  if (secure) cookieString += '; secure';
  if (sameSite) cookieString += `; SameSite=${sameSite}`;

  document.cookie = cookieString;
  return true;
}

/**
 * Get cookie value
 */
export function getCookie(name: string): string | null {
  const nameEQ = name + '=';
  const cookies = document.cookie.split(';');

  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.indexOf(nameEQ) === 0) {
      return decodeURIComponent(cookie.substring(nameEQ.length));
    }
  }

  return null;
}

/**
 * Delete a cookie
 */
export function deleteCookie(name: string, path: string = '/'): void {
  document.cookie = `${name}=; path=${path}; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Delete all cookies in a category
 */
export function deleteCategoryCookies(category: CookieCategory): void {
  // This would need a registry of cookies by category
  // For now, we'll implement this when we have the cookie registry
  logger.warn('Deleting cookies for category not yet implemented', {
    category,
  });
}

/**
 * Get all cookies
 */
export function getAllCookies(): CookieData[] {
  const cookies: CookieData[] = [];
  const cookieStrings = document.cookie.split(';');

  for (let cookieString of cookieStrings) {
    cookieString = cookieString.trim();
    if (!cookieString) continue;

    const [name, ...valueParts] = cookieString.split('=');
    const value = valueParts.join('='); // Handle values with '='

    cookies.push({
      name: name.trim(),
      value: decodeURIComponent(value || ''),
    });
  }

  return cookies;
}

/**
 * Cookie registry for categorization
 */
const COOKIE_REGISTRY: Record<string, CookieCategory> = {
  // Necessary cookies
  consent: CookieCategory.NECESSARY,
  session: CookieCategory.NECESSARY,
  csrf: CookieCategory.NECESSARY,

  // Functional cookies
  theme: CookieCategory.FUNCTIONAL,
  'font-family': CookieCategory.FUNCTIONAL,
  'font-size': CookieCategory.FUNCTIONAL,
  'line-height': CookieCategory.FUNCTIONAL,
  'colorblind-mode': CookieCategory.FUNCTIONAL,

  // Analytics cookies
  _ga: CookieCategory.ANALYTICS,
  _gid: CookieCategory.ANALYTICS,
  _gat: CookieCategory.ANALYTICS,

  // Marketing cookies
  fbp: CookieCategory.MARKETING,
  fr: CookieCategory.MARKETING,
};

/**
 * Get category for a cookie by name
 */
export function getCookieCategory(cookieName: string): CookieCategory {
  return COOKIE_REGISTRY[cookieName] || CookieCategory.NECESSARY;
}
