import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getDefaultConsent,
  validateConsent,
  isConsentExpired,
  migrateConsent,
  formatForGoogleConsent,
  setCookie,
  getCookie,
  deleteCookie,
  getAllCookies,
  getConsentAge,
  updateConsentTimestamp,
  hasUserConsented,
  getConsentFromStorage,
  saveConsentToStorage,
  clearConsentFromStorage,
  setCurrentConsentState,
} from './consent';
import {
  ConsentState,
  ConsentMethod,
  CookieCategory,
  StorageKey,
} from './consent-types';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock document.cookie
let cookieStore: { [key: string]: string } = {};
Object.defineProperty(document, 'cookie', {
  get: vi.fn(() => {
    return Object.entries(cookieStore)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }),
  set: vi.fn((value: string) => {
    const [cookiePair] = value.split(';');
    const [key, val] = cookiePair.split('=');
    if (
      value.includes('max-age=0') ||
      value.includes('expires=Thu, 01 Jan 1970')
    ) {
      delete cookieStore[key];
    } else {
      cookieStore[key] = val;
    }
  }),
  configurable: true,
});

describe('Consent Utilities', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
    cookieStore = {};
  });

  describe('getDefaultConsent', () => {
    it('should return valid default consent state', () => {
      const consent = getDefaultConsent();
      expect(consent.necessary).toBe(true);
      expect(consent.functional).toBe(false);
      expect(consent.analytics).toBe(false);
      expect(consent.marketing).toBe(false);
      expect(consent.version).toBe('1.0.0');
      expect(consent.method).toBe(ConsentMethod.DEFAULT);
      expect(typeof consent.timestamp).toBe('number');
      expect(typeof consent.lastUpdated).toBe('number');
    });

    it('should create unique timestamps for each call', () => {
      const consent1 = getDefaultConsent();
      const consent2 = getDefaultConsent();
      expect(consent2.timestamp).toBeGreaterThanOrEqual(consent1.timestamp);
    });
  });

  describe('validateConsent', () => {
    it('should validate correct consent state', () => {
      const validConsent: ConsentState = {
        necessary: true,
        functional: true,
        analytics: false,
        marketing: false,
        timestamp: Date.now(),
        version: '1.0.0',
        lastUpdated: Date.now(),
        method: ConsentMethod.BANNER_ACCEPT_ALL,
      };
      expect(validateConsent(validConsent)).toEqual(validConsent);
    });

    it('should return null for invalid consent', () => {
      expect(validateConsent(null)).toBeNull();
      expect(validateConsent(undefined)).toBeNull();
      expect(validateConsent({})).toBeNull();
      expect(validateConsent('invalid')).toBeNull();
      expect(validateConsent({ necessary: true })).toBeNull();
    });

    it('should handle missing optional fields', () => {
      const consent = {
        necessary: true,
        functional: false,
        analytics: false,
        marketing: false,
        timestamp: Date.now(),
        version: '1.0.0',
        lastUpdated: Date.now(),
        method: ConsentMethod.DEFAULT,
      };
      expect(validateConsent(consent)).toEqual(consent);
    });
  });

  describe('isConsentExpired', () => {
    it('should return false for recent consent', () => {
      const consent = getDefaultConsent();
      expect(isConsentExpired(consent)).toBe(false);
    });

    it('should return true for consent older than 13 months', () => {
      const oldConsent: ConsentState = {
        ...getDefaultConsent(),
        timestamp: Date.now() - 14 * 30 * 24 * 60 * 60 * 1000, // 14 months ago
      };
      expect(isConsentExpired(oldConsent)).toBe(true);
    });

    it('should return false for consent just under 13 months old', () => {
      const consent: ConsentState = {
        ...getDefaultConsent(),
        timestamp: Date.now() - (13 * 30 * 24 * 60 * 60 * 1000 - 1), // Just under 13 months ago
      };
      expect(isConsentExpired(consent)).toBe(false);
    });
  });

  describe('migrateConsent', () => {
    it('should migrate old consent format to new version', () => {
      const oldConsent = {
        necessary: true,
        functional: true,
        analytics: false,
        // Missing marketing, version, etc.
      };
      const migrated = migrateConsent(oldConsent);
      expect(migrated.necessary).toBe(true);
      expect(migrated.functional).toBe(true);
      expect(migrated.analytics).toBe(false);
      expect(migrated.marketing).toBe(false); // Default value
      expect(migrated.version).toBe('1.0.0');
      expect(migrated.method).toBe(ConsentMethod.IMPORTED);
      expect(typeof migrated.timestamp).toBe('number');
    });

    it('should preserve existing valid fields', () => {
      const consent = {
        necessary: true,
        functional: true,
        analytics: true,
        marketing: true,
        timestamp: 123456789,
        version: '0.9.0',
      };
      const migrated = migrateConsent(consent);
      expect(migrated.functional).toBe(true);
      expect(migrated.analytics).toBe(true);
      expect(migrated.marketing).toBe(true);
      expect(migrated.version).toBe('1.0.0'); // Updated version
      expect(migrated.method).toBe(ConsentMethod.IMPORTED);
    });
  });

  describe('formatForGoogleConsent', () => {
    it('should format consent for Google Consent Mode', () => {
      const consent: ConsentState = {
        ...getDefaultConsent(),
        analytics: true,
        marketing: true,
        functional: true,
      };
      const googleConsent = formatForGoogleConsent(consent);
      expect(googleConsent.analytics_storage).toBe('granted');
      expect(googleConsent.ad_storage).toBe('granted');
      expect(googleConsent.functionality_storage).toBe('granted');
      expect(googleConsent.personalization_storage).toBe('granted');
      expect(googleConsent.security_storage).toBe('granted');
    });

    it('should deny storage when consent is not given', () => {
      const consent = getDefaultConsent();
      const googleConsent = formatForGoogleConsent(consent);
      expect(googleConsent.analytics_storage).toBe('denied');
      expect(googleConsent.ad_storage).toBe('denied');
      expect(googleConsent.functionality_storage).toBe('denied');
      expect(googleConsent.personalization_storage).toBe('denied');
      expect(googleConsent.security_storage).toBe('granted'); // Always granted
    });
  });

  describe('Cookie management', () => {
    describe('setCookie', () => {
      it('should set cookie when consent is given', () => {
        const consentWithFunctional = {
          ...getDefaultConsent(),
          functional: true,
        };
        setCurrentConsentState(consentWithFunctional);

        const result = setCookie('test', 'value', CookieCategory.FUNCTIONAL, {
          maxAge: 3600,
        });
        expect(result).toBe(true);
        expect(cookieStore['test']).toBe('value');
      });

      it('should not set cookie without consent', () => {
        const result = setCookie('test', 'value', CookieCategory.ANALYTICS);
        expect(result).toBe(false);
        expect(cookieStore['test']).toBeUndefined();
      });

      it('should always set necessary cookies', () => {
        const result = setCookie('session', 'abc123', CookieCategory.NECESSARY);
        expect(result).toBe(true);
        expect(cookieStore['session']).toBe('abc123');
      });
    });

    describe('getCookie', () => {
      it('should retrieve existing cookie', () => {
        cookieStore['test'] = 'value';
        expect(getCookie('test')).toBe('value');
      });

      it('should return null for non-existent cookie', () => {
        expect(getCookie('nonexistent')).toBeNull();
      });
    });

    describe('deleteCookie', () => {
      it('should delete existing cookie', () => {
        cookieStore['test'] = 'value';
        deleteCookie('test');
        expect(cookieStore['test']).toBeUndefined();
      });
    });

    describe('getAllCookies', () => {
      it('should return all cookies as array', () => {
        cookieStore['cookie1'] = 'value1';
        cookieStore['cookie2'] = 'value2';
        const cookies = getAllCookies();
        expect(cookies).toHaveLength(2);
        expect(cookies).toContainEqual({
          name: 'cookie1',
          value: 'value1',
        });
        expect(cookies).toContainEqual({
          name: 'cookie2',
          value: 'value2',
        });
      });

      it('should return empty array when no cookies', () => {
        expect(getAllCookies()).toEqual([]);
      });
    });
  });

  describe('Consent age', () => {
    it('should calculate consent age in days', () => {
      const consent: ConsentState = {
        ...getDefaultConsent(),
        timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
      };
      expect(getConsentAge(consent)).toBe(7);
    });

    it('should return 0 for consent given today', () => {
      const consent = getDefaultConsent();
      expect(getConsentAge(consent)).toBe(0);
    });
  });

  describe('Storage operations', () => {
    describe('saveConsentToStorage', () => {
      it('should save consent to localStorage', () => {
        const consent = getDefaultConsent();
        saveConsentToStorage(consent);
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          StorageKey.CONSENT,
          JSON.stringify(consent)
        );
      });
    });

    describe('getConsentFromStorage', () => {
      it('should retrieve valid consent from localStorage', () => {
        const consent = getDefaultConsent();
        localStorageMock.getItem.mockReturnValue(JSON.stringify(consent));
        const retrieved = getConsentFromStorage();
        expect(retrieved).toEqual(consent);
      });

      it('should return null for invalid stored consent', () => {
        localStorageMock.getItem.mockReturnValue('invalid json');
        expect(getConsentFromStorage()).toBeNull();
      });

      it('should return null when no consent stored', () => {
        localStorageMock.getItem.mockReturnValue(null);
        expect(getConsentFromStorage()).toBeNull();
      });
    });

    describe('clearConsentFromStorage', () => {
      it('should remove consent from localStorage', () => {
        clearConsentFromStorage();
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(
          StorageKey.CONSENT
        );
      });
    });
  });

  describe('hasUserConsented', () => {
    it('should return true if user has made any consent choice', () => {
      const consent: ConsentState = {
        ...getDefaultConsent(),
        method: ConsentMethod.BANNER_ACCEPT_ALL,
      };
      expect(hasUserConsented(consent)).toBe(true);
    });

    it('should return false for default consent', () => {
      const consent = getDefaultConsent();
      expect(hasUserConsented(consent)).toBe(false);
    });
  });

  describe('updateConsentTimestamp', () => {
    it('should update lastUpdated timestamp', () => {
      const consent = getDefaultConsent();
      const originalTime = consent.lastUpdated;
      const updated = updateConsentTimestamp(consent);
      expect(updated.lastUpdated).toBeGreaterThan(originalTime);
      expect(updated.timestamp).toBe(consent.timestamp); // Original timestamp preserved
    });
  });
});
