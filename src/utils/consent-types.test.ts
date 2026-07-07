import { describe, it, expect } from 'vitest';
import {
  CookieCategory,
  ConsentState,
  ConsentMethod,
  ConsentTrigger,
  RequestStatus,
  StorageKey,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  DEFAULT_CONSENT_STATE,
  isValidConsent,
  isValidCategory,
  isValidMethod,
} from './consent-types';

describe('Consent Types', () => {
  describe('CookieCategory enum', () => {
    it('should have all required cookie categories', () => {
      expect(CookieCategory.NECESSARY).toBe('necessary');
      expect(CookieCategory.FUNCTIONAL).toBe('functional');
      expect(CookieCategory.ANALYTICS).toBe('analytics');
      expect(CookieCategory.MARKETING).toBe('marketing');
    });
  });

  describe('ConsentMethod enum', () => {
    it('should have all consent methods', () => {
      expect(ConsentMethod.BANNER_ACCEPT_ALL).toBe('banner_accept_all');
      expect(ConsentMethod.BANNER_REJECT_ALL).toBe('banner_reject_all');
      expect(ConsentMethod.BANNER_CUSTOM).toBe('banner_custom');
      expect(ConsentMethod.SETTINGS_PAGE).toBe('settings_page');
      expect(ConsentMethod.IMPORTED).toBe('imported');
      expect(ConsentMethod.DEFAULT).toBe('default');
    });
  });

  describe('ConsentTrigger enum', () => {
    it('should have all consent triggers', () => {
      expect(ConsentTrigger.USER_ACTION).toBe('user_action');
      expect(ConsentTrigger.TIMEOUT).toBe('timeout');
      expect(ConsentTrigger.VERSION_MIGRATION).toBe('version_migration');
      expect(ConsentTrigger.ADMIN_RESET).toBe('admin_reset');
      expect(ConsentTrigger.DATA_IMPORT).toBe('data_import');
    });
  });

  describe('RequestStatus enum', () => {
    it('should have all request statuses', () => {
      expect(RequestStatus.PENDING).toBe('pending');
      expect(RequestStatus.IN_PROGRESS).toBe('in_progress');
      expect(RequestStatus.COMPLETED).toBe('completed');
      expect(RequestStatus.FAILED).toBe('failed');
      expect(RequestStatus.CANCELLED).toBe('cancelled');
    });
  });

  describe('StorageKey enum', () => {
    it('should have all storage keys', () => {
      expect(StorageKey.CONSENT).toBe('cookie-consent');
      expect(StorageKey.HISTORY).toBe('consent-history');
      expect(StorageKey.REQUESTS).toBe('privacy-requests');
      expect(StorageKey.BANNER_DISMISSED).toBe('consent-banner-dismissed');
      expect(StorageKey.BANNER_TIMESTAMP).toBe(
        'consent-banner-dismiss-timestamp'
      );
    });
  });

  describe('Category labels and descriptions', () => {
    it('should have labels for all categories', () => {
      expect(CATEGORY_LABELS[CookieCategory.NECESSARY]).toBe(
        'Strictly Necessary'
      );
      expect(CATEGORY_LABELS[CookieCategory.FUNCTIONAL]).toBe('Functional');
      expect(CATEGORY_LABELS[CookieCategory.ANALYTICS]).toBe('Analytics');
      expect(CATEGORY_LABELS[CookieCategory.MARKETING]).toBe('Marketing');
    });

    it('should have descriptions for all categories', () => {
      expect(CATEGORY_DESCRIPTIONS[CookieCategory.NECESSARY]).toContain(
        'essential'
      );
      expect(CATEGORY_DESCRIPTIONS[CookieCategory.FUNCTIONAL]).toContain(
        'enhanced functionality'
      );
      expect(CATEGORY_DESCRIPTIONS[CookieCategory.ANALYTICS]).toContain(
        'understand'
      );
      expect(CATEGORY_DESCRIPTIONS[CookieCategory.MARKETING]).toContain(
        'advertisements'
      );
    });
  });

  describe('DEFAULT_CONSENT_STATE', () => {
    it('should have necessary cookies enabled by default', () => {
      expect(DEFAULT_CONSENT_STATE.necessary).toBe(true);
    });

    it('should have all optional cookies disabled by default', () => {
      expect(DEFAULT_CONSENT_STATE.functional).toBe(false);
      expect(DEFAULT_CONSENT_STATE.analytics).toBe(false);
      expect(DEFAULT_CONSENT_STATE.marketing).toBe(false);
    });

    it('should have required metadata', () => {
      expect(DEFAULT_CONSENT_STATE.version).toBe('1.0.0');
      expect(DEFAULT_CONSENT_STATE.method).toBe(ConsentMethod.DEFAULT);
      expect(typeof DEFAULT_CONSENT_STATE.timestamp).toBe('number');
      expect(typeof DEFAULT_CONSENT_STATE.lastUpdated).toBe('number');
    });
  });

  describe('Type guards', () => {
    describe('isValidConsent', () => {
      it('should validate correct consent state', () => {
        const validConsent: ConsentState = {
          necessary: true,
          functional: false,
          analytics: false,
          marketing: false,
          timestamp: Date.now(),
          version: '1.0.0',
          lastUpdated: Date.now(),
          method: ConsentMethod.DEFAULT,
        };
        expect(isValidConsent(validConsent)).toBe(true);
      });

      it('should reject invalid consent state', () => {
        expect(isValidConsent(null)).toBe(false);
        expect(isValidConsent(undefined)).toBe(false);
        expect(isValidConsent({})).toBe(false);
        expect(isValidConsent({ necessary: true })).toBe(false);
        expect(
          isValidConsent({
            necessary: 'true', // wrong type
            functional: false,
            analytics: false,
            marketing: false,
            timestamp: Date.now(),
            version: '1.0.0',
            lastUpdated: Date.now(),
            method: ConsentMethod.DEFAULT,
          })
        ).toBe(false);
      });

      it('should reject consent with missing fields', () => {
        const missingFields = {
          necessary: true,
          functional: false,
          analytics: false,
          // missing marketing
          timestamp: Date.now(),
          version: '1.0.0',
          lastUpdated: Date.now(),
          method: ConsentMethod.DEFAULT,
        };
        expect(isValidConsent(missingFields)).toBe(false);
      });
    });

    describe('isValidCategory', () => {
      it('should validate correct categories', () => {
        expect(isValidCategory(CookieCategory.NECESSARY)).toBe(true);
        expect(isValidCategory(CookieCategory.FUNCTIONAL)).toBe(true);
        expect(isValidCategory(CookieCategory.ANALYTICS)).toBe(true);
        expect(isValidCategory(CookieCategory.MARKETING)).toBe(true);
        expect(isValidCategory('necessary')).toBe(true);
        expect(isValidCategory('functional')).toBe(true);
      });

      it('should reject invalid categories', () => {
        expect(isValidCategory('invalid')).toBe(false);
        expect(isValidCategory('')).toBe(false);
        expect(isValidCategory(null)).toBe(false);
        expect(isValidCategory(undefined)).toBe(false);
        expect(isValidCategory(123)).toBe(false);
      });
    });

    describe('isValidMethod', () => {
      it('should validate correct methods', () => {
        expect(isValidMethod(ConsentMethod.BANNER_ACCEPT_ALL)).toBe(true);
        expect(isValidMethod(ConsentMethod.BANNER_REJECT_ALL)).toBe(true);
        expect(isValidMethod(ConsentMethod.BANNER_CUSTOM)).toBe(true);
        expect(isValidMethod(ConsentMethod.SETTINGS_PAGE)).toBe(true);
        expect(isValidMethod(ConsentMethod.IMPORTED)).toBe(true);
        expect(isValidMethod(ConsentMethod.DEFAULT)).toBe(true);
        expect(isValidMethod('banner_accept_all')).toBe(true);
      });

      it('should reject invalid methods', () => {
        expect(isValidMethod('invalid')).toBe(false);
        expect(isValidMethod('')).toBe(false);
        expect(isValidMethod(null)).toBe(false);
        expect(isValidMethod(undefined)).toBe(false);
        expect(isValidMethod(123)).toBe(false);
      });
    });
  });

  describe('ConsentState interface', () => {
    it('should allow creating valid consent state', () => {
      const consent: ConsentState = {
        necessary: true,
        functional: true,
        analytics: false,
        marketing: false,
        timestamp: 1234567890,
        version: '2.0.0',
        lastUpdated: 1234567891,
        method: ConsentMethod.BANNER_ACCEPT_ALL,
        bannerId: 'banner-v2',
      };

      expect(consent.necessary).toBe(true);
      expect(consent.functional).toBe(true);
      expect(consent.bannerId).toBe('banner-v2');
    });
  });
});
