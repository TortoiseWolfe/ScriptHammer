import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  exportUserData,
  clearUserData,
  generateExportFile,
  downloadJSON,
  getStorageData,
  getAllCookies,
  clearNonNecessaryCookies,
} from './privacy';
import { getConsentFromStorage, clearConsentFromStorage } from './consent';

// Mock the logger - use vi.hoisted to ensure it's available before mock hoisting
const mockLoggerFns = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => mockLoggerFns),
}));

// Mock the consent utilities
vi.mock('./consent', () => ({
  getConsentFromStorage: vi.fn(),
  clearConsentFromStorage: vi.fn(),
  getDefaultConsent: vi.fn(() => ({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
    timestamp: Date.now(),
    version: '1.0.0',
    lastUpdated: Date.now(),
    method: 'default',
  })),
  setCookie: vi.fn(),
  getCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));

// Mock consent history (will be created later)
vi.mock('./consent-history', () => ({
  getConsentHistory: vi.fn(() => []),
  clearConsentHistory: vi.fn(),
}));

describe('Privacy Utilities', () => {
  beforeEach(() => {
    // Clear all storage before each test
    localStorage.clear();
    sessionStorage.clear();
    // Clear all cookies properly
    document.cookie.split(';').forEach((cookie) => {
      const [name] = cookie.split('=');
      if (name) {
        document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
      }
    });
    vi.clearAllMocks();

    // Mock Date for consistent timestamps
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));

    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Clear cookies after each test
    document.cookie.split(';').forEach((cookie) => {
      const [name] = cookie.split('=');
      if (name) {
        document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
      }
    });
  });

  describe('getStorageData', () => {
    it('should collect all localStorage data', () => {
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('fontSize', 'large');
      localStorage.setItem('cookieConsent', JSON.stringify({ test: true }));

      const data = getStorageData('local');

      expect(data).toEqual({
        theme: 'dark',
        fontSize: 'large',
        cookieConsent: { test: true },
      });
    });

    it('should collect all sessionStorage data', () => {
      sessionStorage.setItem('tempAuth', 'token123');
      sessionStorage.setItem('formData', JSON.stringify({ name: 'test' }));

      const data = getStorageData('session');

      expect(data).toEqual({
        tempAuth: 'token123',
        formData: { name: 'test' },
      });
    });

    it('should handle JSON parsing errors gracefully', () => {
      localStorage.setItem('valid', 'simple string');
      localStorage.setItem('invalid', '{broken json');
      localStorage.setItem('validJson', '{"valid": true}');

      const data = getStorageData('local');

      expect(data).toEqual({
        valid: 'simple string',
        invalid: '{broken json', // Should return as string if not valid JSON
        validJson: { valid: true },
      });
    });

    it('should return empty object for empty storage', () => {
      const data = getStorageData('local');
      expect(data).toEqual({});
    });
  });

  describe('getAllCookies', () => {
    it('should parse all cookies from document.cookie', () => {
      document.cookie = 'sessionId=abc123; path=/';
      document.cookie = 'theme=dark; path=/';
      document.cookie = 'analytics=enabled; path=/';

      const cookies = getAllCookies();

      expect(cookies).toEqual({
        sessionId: 'abc123',
        theme: 'dark',
        analytics: 'enabled',
      });
    });

    it('should handle empty cookie string', () => {
      // Ensure no cookies exist
      const cookies = getAllCookies();
      expect(cookies).toEqual({});
    });

    it('should handle cookies with special characters', () => {
      document.cookie = 'encoded=hello%20world; path=/';
      document.cookie = 'special=value=with=equals; path=/';

      const cookies = getAllCookies();

      expect(cookies).toEqual({
        encoded: 'hello%20world',
        special: 'value=with=equals',
      });
    });
  });

  describe('exportUserData', () => {
    it('should collect all user data from various sources', async () => {
      // Setup test data
      localStorage.setItem('theme', 'dark');
      localStorage.setItem(
        'cookieConsent',
        JSON.stringify({ functional: true })
      );
      sessionStorage.setItem('tempData', 'temporary');
      document.cookie = 'sessionId=abc123; path=/';

      // Mock consent data
      (getConsentFromStorage as ReturnType<typeof vi.fn>).mockReturnValue({
        necessary: true,
        functional: true,
        analytics: false,
        marketing: false,
        timestamp: Date.now(),
        version: '1.0.0',
        lastUpdated: Date.now(),
        method: 'banner_accept_all',
      });

      const exportData = await exportUserData();

      expect(exportData).toHaveProperty('exportDate');
      expect(exportData).toHaveProperty('version');
      expect(exportData.localStorage).toEqual({
        theme: 'dark',
        cookieConsent: { functional: true },
      });
      expect(exportData.sessionStorage).toEqual({
        tempData: 'temporary',
      });
      expect(exportData.cookies).toEqual({
        sessionId: 'abc123',
      });
      expect(exportData.consent).toBeTruthy();
      expect(exportData.consentHistory).toEqual([]);
    });

    it('should include metadata in export', async () => {
      const exportData = await exportUserData();

      expect(exportData.exportDate).toBe('2024-01-15T10:00:00.000Z');
      expect(exportData.version).toBe('1.0.0');
      expect(exportData.userAgent).toBe(navigator.userAgent);
      expect(exportData.timestamp).toBe(Date.now());
    });

    it('should handle missing consent data', async () => {
      (getConsentFromStorage as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const exportData = await exportUserData();

      expect(exportData.consent).toBeNull();
      expect(exportData).toHaveProperty('localStorage');
      expect(exportData).toHaveProperty('sessionStorage');
    });
  });

  describe('generateExportFile', () => {
    it('should generate formatted JSON string', () => {
      const data = {
        test: 'data',
        nested: { value: 123 },
        array: [1, 2, 3],
      };

      const json = generateExportFile(data);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(data);
      expect(json).toContain('\n'); // Should be pretty-printed
    });

    it('should handle complex nested data', () => {
      const data = {
        localStorage: {
          theme: 'dark',
          settings: { fontSize: 16, color: 'blue' },
        },
        consent: {
          necessary: true,
          functional: false,
          timestamp: Date.now(),
        },
      };

      const json = generateExportFile(data);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(data);
    });
  });

  describe('downloadJSON', () => {
    it('should trigger download with correct filename', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      const mockClick = vi.fn();
      const mockElement = document.createElement('a');
      mockElement.click = mockClick;
      createElementSpy.mockReturnValueOnce(mockElement);

      const data = { test: 'data' };
      downloadJSON(data, 'test-export');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockElement.download).toBe('test-export.json');
      expect(mockElement.href).toContain('blob:');
      expect(mockClick).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });

    it('should use default filename with timestamp', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      const mockElement = document.createElement('a');
      createElementSpy.mockReturnValueOnce(mockElement);

      downloadJSON({ test: 'data' });

      expect(mockElement.download).toBe(
        'scripthammer-privacy-export-2024-01-15T10-00-00-000Z.json'
      );
    });

    it('should revoke object URL after download', () => {
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');
      const createElementSpy = vi.spyOn(document, 'createElement');
      const mockElement = document.createElement('a');
      mockElement.click = vi.fn();
      createElementSpy.mockReturnValueOnce(mockElement);

      downloadJSON({ test: 'data' });

      expect(revokeObjectURLSpy).toHaveBeenCalled();
    });
  });

  describe('clearNonNecessaryCookies', () => {
    it('should clear all non-necessary cookies', () => {
      // Set various cookies
      document.cookie = 'necessary=keep; path=/';
      document.cookie = 'analytics=remove; path=/';
      document.cookie = 'marketing=remove; path=/';
      document.cookie = 'functional=remove; path=/';

      // Mock cookie categories
      const necessaryCookies = ['necessary', 'session'];

      clearNonNecessaryCookies(necessaryCookies);

      const cookies = getAllCookies();

      // Only necessary cookies should remain
      expect(cookies.necessary).toBe('keep');
      expect(cookies.analytics).toBeUndefined();
      expect(cookies.marketing).toBeUndefined();
      expect(cookies.functional).toBeUndefined();
    });

    it('should handle empty necessary cookies list', () => {
      document.cookie = 'test1=value1; path=/';
      document.cookie = 'test2=value2; path=/';

      clearNonNecessaryCookies([]);

      const cookies = getAllCookies();

      // All cookies should be cleared
      expect(Object.keys(cookies).length).toBe(0);
    });
  });

  describe('clearUserData', () => {
    it('should clear all user data except necessary items', async () => {
      // Setup test data
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('cookieConsent', 'consent-data');
      localStorage.setItem('necessaryData', 'keep-this');
      sessionStorage.setItem('tempAuth', 'token');
      document.cookie = 'analytics=enabled; path=/';
      document.cookie = 'necessary=keep; path=/';

      const result = await clearUserData({
        keepLocalStorage: ['necessaryData'],
        keepCookies: ['necessary'],
      });

      // Check localStorage - only necessary items remain
      expect(localStorage.getItem('theme')).toBeNull();
      expect(localStorage.getItem('cookieConsent')).toBeNull();
      expect(localStorage.getItem('necessaryData')).toBe('keep-this');

      // Check sessionStorage - should be cleared
      expect(sessionStorage.getItem('tempAuth')).toBeNull();

      // Check result
      expect(result.success).toBe(true);
      expect(result.clearedItems).toContain('theme');
      expect(result.clearedItems).toContain('cookieConsent');
      expect(result.timestamp).toBe(Date.now());
    });

    it('should reset consent to default', async () => {
      await clearUserData();

      expect(clearConsentFromStorage).toHaveBeenCalled();
    });

    it('should log deletion audit event', async () => {
      await clearUserData();

      expect(mockLoggerFns.info).toHaveBeenCalledWith(
        'User data deletion requested',
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      // Add an item to localStorage first
      localStorage.setItem('testItem', 'test');

      // Spy on localStorage.removeItem to throw an error
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
      removeItemSpy.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = await clearUserData();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');

      // Restore original
      removeItemSpy.mockRestore();
    });

    it('should clear data without options', async () => {
      localStorage.setItem('test', 'value');
      sessionStorage.setItem('temp', 'data');
      document.cookie = 'cookie=value; path=/';

      const result = await clearUserData();

      expect(result.success).toBe(true);
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });
  });

  describe('Integration tests', () => {
    it('should export and clear cycle correctly', async () => {
      // Setup data
      localStorage.setItem('userData', 'important');
      sessionStorage.setItem('session', 'active');
      document.cookie = 'tracking=enabled; path=/';

      // Export data first
      const exportData = await exportUserData();
      expect(exportData.localStorage.userData).toBe('important');

      // Clear data
      const clearResult = await clearUserData();
      expect(clearResult.success).toBe(true);

      // Verify data is cleared
      expect(localStorage.getItem('userData')).toBeNull();
      expect(sessionStorage.getItem('session')).toBeNull();

      // Export again should show empty
      const emptyExport = await exportUserData();
      expect(Object.keys(emptyExport.localStorage)).toHaveLength(0);
      expect(Object.keys(emptyExport.sessionStorage)).toHaveLength(0);
    });
  });
});
