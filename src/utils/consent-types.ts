/**
 * Cookie Consent Type Definitions
 * GDPR-compliant consent management types
 */

/**
 * Cookie categories as per GDPR guidelines
 */
export enum CookieCategory {
  NECESSARY = 'necessary',
  FUNCTIONAL = 'functional',
  ANALYTICS = 'analytics',
  MARKETING = 'marketing',
}

/**
 * How the user provided consent
 */
export enum ConsentMethod {
  BANNER_ACCEPT_ALL = 'banner_accept_all',
  BANNER_REJECT_ALL = 'banner_reject_all',
  BANNER_CUSTOM = 'banner_custom',
  SETTINGS_PAGE = 'settings_page',
  IMPORTED = 'imported',
  DEFAULT = 'default',
}

/**
 * What triggered a consent change
 */
export enum ConsentTrigger {
  USER_ACTION = 'user_action',
  TIMEOUT = 'timeout',
  VERSION_MIGRATION = 'version_migration',
  ADMIN_RESET = 'admin_reset',
  DATA_IMPORT = 'data_import',
}

/**
 * Main consent state structure
 */
export interface ConsentState {
  // Consent flags for each category
  necessary: boolean; // Always true
  functional: boolean; // User preference
  analytics: boolean; // User preference
  marketing: boolean; // User preference

  // Metadata
  timestamp: number; // When consent was given/updated
  version: string; // Consent version for migration
  lastUpdated: number; // Last modification timestamp

  // User interaction tracking
  method: ConsentMethod; // How consent was given
  bannerId?: string; // Which banner version was shown
}

/**
 * React Context value type
 */
export interface ConsentContextValue {
  // Current consent state
  consent: ConsentState;

  // UI state
  showBanner: boolean;
  showModal: boolean;
  isLoading: boolean;

  // Actions
  updateConsent: (category: CookieCategory, enabled: boolean) => void;
  updateMultiple: (updates: Partial<ConsentState>) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (preferences: Partial<ConsentState>) => void;

  // UI controls
  setShowBanner: (show: boolean) => void;
  setShowModal: (show: boolean) => void;
  dismissBanner: () => void;
  openModal: () => void;
  closeModal: () => void;

  // Utilities
  hasConsented: () => boolean;
  canUseCookies: (category: CookieCategory) => boolean;
  resetConsent: () => void;
}

/**
 * Track consent changes over time
 */
export interface ConsentHistoryEntry {
  id: string; // Unique identifier
  timestamp: number; // When the change occurred
  previousState: ConsentState; // State before change
  newState: ConsentState; // State after change
  trigger: ConsentTrigger; // What caused the change
  userAgent?: string; // Browser info
  ipHash?: string; // Hashed IP for audit
}

/**
 * Complete consent history
 */
export interface ConsentHistory {
  entries: ConsentHistoryEntry[];
  maxEntries: number; // Limit storage (default: 50)
}

/**
 * Cookie data structure
 */
export interface CookieData {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  category?: CookieCategory;
}

/**
 * Cookie definition for documentation
 */
export interface CookieDefinition {
  name: string;
  category: CookieCategory;
  purpose: string;
  duration: string; // e.g., "Session", "1 year", "30 days"
  provider: string; // e.g., "First-party", "Google", "Facebook"
  description: string;
  required: boolean;
}

/**
 * User data export format for GDPR compliance
 */
export interface UserDataExport {
  // Metadata
  exportId: string;
  timestamp: string; // ISO 8601 format
  version: string; // Export format version

  // Consent information
  consent: {
    current: ConsentState;
    history: ConsentHistoryEntry[];
  };

  // Browser storage
  localStorage: Record<string, unknown>;
  sessionStorage: Record<string, unknown>;
  cookies: CookieData[];

  // Application data
  preferences: {
    theme?: string;
    fontSize?: string;
    lineHeight?: string;
    fontFamily?: string;
    colorblindMode?: string;
  };

  // Analytics data (if consented)
  analytics?: {
    webVitals?: unknown[];
    customEvents?: unknown[];
    sessionData?: unknown;
  };
}

/**
 * Data deletion request
 */
export interface DataDeletionRequest {
  id: string;
  timestamp: number;
  email: string;
  reason?: string;
  categories: CookieCategory[];
  status: RequestStatus;
  completedAt?: number;
  notes?: string;
}

/**
 * Data access request (GDPR Article 15)
 */
export interface DataAccessRequest {
  id: string;
  timestamp: number;
  email: string;
  purpose: string;
  status: RequestStatus;
  exportId?: string; // Link to UserDataExport
  expiresAt?: number; // Download link expiration
}

export enum RequestStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Storage keys enum for type safety
 */
export enum StorageKey {
  CONSENT = 'cookie-consent',
  HISTORY = 'consent-history',
  REQUESTS = 'privacy-requests',
  BANNER_DISMISSED = 'consent-banner-dismissed',
  BANNER_TIMESTAMP = 'consent-banner-dismiss-timestamp',
}

/**
 * Cookie options for setting cookies
 */
export interface CookieOptions {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Google Consent Mode state
 */
export interface GoogleConsentState {
  analytics_storage: 'granted' | 'denied';
  ad_storage: 'granted' | 'denied';
  functionality_storage: 'granted' | 'denied';
  personalization_storage: 'granted' | 'denied';
  security_storage: 'granted';
}

/**
 * Human-readable labels for cookie categories
 */
export const CATEGORY_LABELS: Record<CookieCategory, string> = {
  [CookieCategory.NECESSARY]: 'Strictly Necessary',
  [CookieCategory.FUNCTIONAL]: 'Functional',
  [CookieCategory.ANALYTICS]: 'Analytics',
  [CookieCategory.MARKETING]: 'Marketing',
};

/**
 * Detailed descriptions for each category
 */
export const CATEGORY_DESCRIPTIONS: Record<CookieCategory, string> = {
  [CookieCategory.NECESSARY]:
    'These cookies are essential for the website to function properly. They enable core functionality such as security, network management, and accessibility.',
  [CookieCategory.FUNCTIONAL]:
    'These cookies enable enhanced functionality and personalization, such as remembering your preferences, language, and region.',
  [CookieCategory.ANALYTICS]:
    'These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.',
  [CookieCategory.MARKETING]:
    'These cookies are used to deliver advertisements more relevant to you and your interests. They may also be used to limit the number of times you see an ad.',
};

/**
 * Default consent state for new users
 */
export const DEFAULT_CONSENT_STATE: ConsentState = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
  timestamp: Date.now(),
  version: '1.0.0',
  lastUpdated: Date.now(),
  method: ConsentMethod.DEFAULT,
};

/**
 * Type guard to check if a value is a valid ConsentState
 */
export function isValidConsent(value: unknown): value is ConsentState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.necessary === 'boolean' &&
    typeof obj.functional === 'boolean' &&
    typeof obj.analytics === 'boolean' &&
    typeof obj.marketing === 'boolean' &&
    typeof obj.timestamp === 'number' &&
    typeof obj.version === 'string' &&
    typeof obj.lastUpdated === 'number' &&
    typeof obj.method === 'string'
  );
}

/**
 * Type guard to check if a value is a valid CookieCategory
 */
export function isValidCategory(value: unknown): value is CookieCategory {
  return Object.values(CookieCategory).includes(value as CookieCategory);
}

/**
 * Type guard to check if a value is a valid ConsentMethod
 */
export function isValidMethod(value: unknown): value is ConsentMethod {
  return Object.values(ConsentMethod).includes(value as ConsentMethod);
}
