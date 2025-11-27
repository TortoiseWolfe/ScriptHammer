import { ConsentState } from './consent-types';
import { getConsentFromStorage, clearConsentFromStorage } from './consent';
import { createLogger } from '@/lib/logger';

const logger = createLogger('utils:privacy');

// Import consent history (will be implemented next)
let getConsentHistory: () => unknown[] = () => [];
let clearConsentHistory: () => void = () => {};

// Lazy load consent history to avoid circular dependency
const loadConsentHistoryModule = async () => {
  try {
    const historyModule = await import('./consent-history');
    getConsentHistory = historyModule.getConsentHistory;
    clearConsentHistory = historyModule.clearConsentHistory;
  } catch {
    // Module doesn't exist yet, use defaults
  }
};

// Initialize on module load
loadConsentHistoryModule();

/**
 * Interface for storage data
 */
interface StorageData {
  [key: string]: unknown;
}

/**
 * Interface for export data structure
 */
export interface ExportData {
  exportDate: string;
  version: string;
  timestamp: number;
  userAgent: string;
  localStorage: StorageData;
  sessionStorage: StorageData;
  cookies: Record<string, string>;
  consent: ConsentState | null;
  consentHistory: unknown[];
}

/**
 * Interface for clear data options
 */
export interface ClearDataOptions {
  keepLocalStorage?: string[];
  keepCookies?: string[];
}

/**
 * Interface for clear data result
 */
export interface ClearDataResult {
  success: boolean;
  timestamp: number;
  clearedItems: string[];
  error?: string;
}

/**
 * Get data from storage (localStorage or sessionStorage)
 */
export function getStorageData(
  type: 'local' | 'session'
): Record<string, unknown> {
  const storage = type === 'local' ? localStorage : sessionStorage;
  const data: Record<string, unknown> = {};

  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key) {
      const value = storage.getItem(key);
      if (value) {
        // Try to parse as JSON, fallback to string
        try {
          data[key] = JSON.parse(value);
        } catch {
          data[key] = value;
        }
      }
    }
  }

  return data;
}

/**
 * Get all cookies as an object
 */
export function getAllCookies(): Record<string, string> {
  const cookies: Record<string, string> = {};

  if (typeof document === 'undefined' || !document.cookie) {
    return cookies;
  }

  document.cookie.split(';').forEach((cookie) => {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name) {
      cookies[name] = valueParts.join('=');
    }
  });

  return cookies;
}

/**
 * Export all user data for GDPR compliance
 */
export async function exportUserData(): Promise<ExportData> {
  // Ensure consent history module is loaded
  await loadConsentHistoryModule();

  const exportData: ExportData = {
    exportDate: new Date().toISOString(),
    version: '1.0.0',
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    localStorage: getStorageData('local'),
    sessionStorage: getStorageData('session'),
    cookies: getAllCookies(),
    consent: getConsentFromStorage(),
    consentHistory: getConsentHistory(),
  };

  return exportData;
}

/**
 * Generate formatted JSON export file
 */
export function generateExportFile(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Download data as JSON file
 */
export function downloadJSON(data: unknown, filename?: string): void {
  const json = generateExportFile(data);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const defaultFilename = `scripthammer-privacy-export-${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename ? `${filename}.json` : defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Clear non-necessary cookies
 */
export function clearNonNecessaryCookies(necessaryCookies: string[]): void {
  const allCookies = getAllCookies();

  Object.keys(allCookies).forEach((cookieName) => {
    if (!necessaryCookies.includes(cookieName)) {
      // Clear cookie by setting expiry in the past
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname}`;
    }
  });
}

/**
 * Clear all user data (Right to be Forgotten)
 */
export async function clearUserData(
  options: ClearDataOptions = {}
): Promise<ClearDataResult> {
  const { keepLocalStorage = [], keepCookies = [] } = options;
  const clearedItems: string[] = [];

  try {
    // Log audit event
    logger.info('User data deletion requested', {
      timestamp: new Date().toISOString(),
    });

    // Clear localStorage (except necessary items)
    const localKeys = Object.keys(localStorage);
    localKeys.forEach((key) => {
      if (!keepLocalStorage.includes(key)) {
        localStorage.removeItem(key);
        clearedItems.push(key);
      }
    });

    // Clear sessionStorage completely
    sessionStorage.clear();

    // Clear non-necessary cookies
    clearNonNecessaryCookies(keepCookies);

    // Reset consent to default
    clearConsentFromStorage();

    // Clear consent history
    await loadConsentHistoryModule();
    clearConsentHistory();

    // Log completion
    logger.info('User data deletion completed', {
      clearedCount: clearedItems.length,
    });

    return {
      success: true,
      timestamp: Date.now(),
      clearedItems,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logger.error('User data deletion failed', { error: errorMessage });

    return {
      success: false,
      timestamp: Date.now(),
      clearedItems,
      error: errorMessage,
    };
  }
}
