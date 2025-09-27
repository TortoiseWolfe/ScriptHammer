# API Contracts: Cookie Consent & GDPR Compliance

## Overview

This document defines the API contracts for the cookie consent system, including React hooks, utility functions, and component interfaces.

## Table of Contents

1. [React Hooks API](#react-hooks-api)
2. [Utility Functions API](#utility-functions-api)
3. [Component Props API](#component-props-api)
4. [Event API](#event-api)
5. [Storage API](#storage-api)

---

## React Hooks API

### `useConsent()`

Primary hook for accessing and managing consent state.

```typescript
interface UseConsentReturn {
  // State
  consent: ConsentState;
  showBanner: boolean;
  showModal: boolean;
  isLoading: boolean;

  // Actions
  updateConsent: (category: CookieCategory, enabled: boolean) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (preferences: Partial<ConsentState>) => void;

  // UI Controls
  dismissBanner: () => void;
  openModal: () => void;
  closeModal: () => void;

  // Utilities
  hasConsented: () => boolean;
  canUseCookies: (category: CookieCategory) => boolean;
  resetConsent: () => void;
}

// Usage
const { consent, acceptAll, canUseCookies } = useConsent();

if (canUseCookies(CookieCategory.ANALYTICS)) {
  // Load Google Analytics
}
```

### `useConsentCategory()`

Hook for checking specific category consent.

```typescript
function useConsentCategory(category: CookieCategory): boolean;

// Usage
const hasAnalyticsConsent = useConsentCategory(CookieCategory.ANALYTICS);
```

### `usePrivacy()`

Hook for privacy-related operations.

```typescript
interface UsePrivacyReturn {
  exportData: () => Promise<UserDataExport>;
  deleteData: (categories?: CookieCategory[]) => Promise<void>;
  requestDeletion: (email: string, reason?: string) => Promise<string>;
  getConsentHistory: () => ConsentHistoryEntry[];
}

// Usage
const { exportData, deleteData } = usePrivacy();

const handleExport = async () => {
  const data = await exportData();
  downloadJSON(data, 'my-data.json');
};
```

---

## Utility Functions API

### Consent Utilities

```typescript
// src/utils/consent.ts

/**
 * Get default consent state
 */
export function getDefaultConsent(): ConsentState;

/**
 * Validate consent state from storage
 */
export function validateConsent(data: unknown): ConsentState | null;

/**
 * Check if consent is expired (> 13 months)
 */
export function isConsentExpired(consent: ConsentState): boolean;

/**
 * Migrate consent to current version
 */
export function migrateConsent(oldConsent: any): ConsentState;

/**
 * Get consent age in days
 */
export function getConsentAge(consent: ConsentState): number;

/**
 * Format consent for Google Consent Mode
 */
export function formatForGoogleConsent(
  consent: ConsentState
): GoogleConsentState;
```

### Cookie Management

```typescript
// src/utils/cookies.ts

/**
 * Set a cookie with proper consent check
 */
export function setCookie(
  name: string,
  value: string,
  category: CookieCategory,
  options?: CookieOptions
): boolean;

/**
 * Get cookie value
 */
export function getCookie(name: string): string | null;

/**
 * Delete cookie
 */
export function deleteCookie(name: string, path?: string): void;

/**
 * Delete all cookies in category
 */
export function deleteCategoryCookies(category: CookieCategory): void;

/**
 * Get all cookies
 */
export function getAllCookies(): CookieData[];
```

### Privacy Utilities

```typescript
// src/utils/privacy.ts

/**
 * Export all user data
 */
export async function exportUserData(): Promise<UserDataExport>;

/**
 * Clear all user data
 */
export async function clearUserData(
  categories?: CookieCategory[]
): Promise<void>;

/**
 * Generate data export file
 */
export function generateExportFile(data: UserDataExport): Blob;

/**
 * Download JSON file
 */
export function downloadJSON(data: any, filename: string): void;

/**
 * Hash IP address for audit logs
 */
export function hashIP(ip: string): string;
```

---

## Component Props API

### CookieConsent Component

```typescript
interface CookieConsentProps {
  // Position
  position?: 'top' | 'bottom';

  // Styling
  className?: string;
  theme?: 'light' | 'dark' | 'auto';

  // Behavior
  blocking?: boolean;
  dismissOnScroll?: boolean;
  dismissOnTimeout?: number;

  // Callbacks
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  onCustomize?: () => void;
  onDismiss?: () => void;

  // Content
  customContent?: React.ReactNode;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
}
```

### ConsentModal Component

```typescript
interface ConsentModalProps {
  isOpen: boolean;
  onClose: () => void;

  // Content
  title?: string;
  description?: string;

  // Categories
  categories?: CookieCategory[];
  requiredCategories?: CookieCategory[];

  // Callbacks
  onSave?: (consent: Partial<ConsentState>) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;

  // Links
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;

  // Styling
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}
```

### PrivacyControls Component

```typescript
interface PrivacyControlsProps {
  // Display options
  showHistory?: boolean;
  showExport?: boolean;
  showDelete?: boolean;

  // Callbacks
  onExport?: (data: UserDataExport) => void;
  onDelete?: () => void;
  onConsentChange?: (consent: ConsentState) => void;

  // Styling
  className?: string;
  compact?: boolean;
}
```

### CategoryToggle Component

```typescript
interface CategoryToggleProps {
  category: CookieCategory;
  enabled: boolean;
  required?: boolean;

  // Display
  label?: string;
  description?: string;
  showCookies?: boolean;

  // Callbacks
  onChange?: (enabled: boolean) => void;

  // Styling
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}
```

---

## Event API

### Consent Events

```typescript
// Event types
enum ConsentEventType {
  CONSENT_UPDATED = 'consent:updated',
  CONSENT_ACCEPTED_ALL = 'consent:accepted-all',
  CONSENT_REJECTED_ALL = 'consent:rejected-all',
  CONSENT_CUSTOMIZED = 'consent:customized',
  BANNER_SHOWN = 'consent:banner-shown',
  BANNER_DISMISSED = 'consent:banner-dismissed',
  MODAL_OPENED = 'consent:modal-opened',
  MODAL_CLOSED = 'consent:modal-closed',
}

// Event detail structure
interface ConsentEventDetail {
  consent: ConsentState;
  previousConsent?: ConsentState;
  trigger: ConsentTrigger;
  timestamp: number;
}

// Dispatching events
function dispatchConsentEvent(
  type: ConsentEventType,
  detail: ConsentEventDetail
): void;

// Listening to events
window.addEventListener(
  'consent:updated',
  (event: CustomEvent<ConsentEventDetail>) => {
    console.log('Consent updated:', event.detail);
  }
);
```

### Analytics Events

```typescript
// Track consent interactions
interface ConsentAnalyticsEvent {
  action: 'accept_all' | 'reject_all' | 'customize' | 'dismiss';
  category: 'consent_banner' | 'consent_modal' | 'privacy_settings';
  label?: string;
  value?: number;
}

function trackConsentEvent(event: ConsentAnalyticsEvent): void;
```

---

## Storage API

### localStorage Interface

```typescript
interface ConsentStorage {
  /**
   * Get consent from storage
   */
  getConsent(): ConsentState | null;

  /**
   * Save consent to storage
   */
  setConsent(consent: ConsentState): void;

  /**
   * Clear consent from storage
   */
  clearConsent(): void;

  /**
   * Get consent history
   */
  getHistory(): ConsentHistoryEntry[];

  /**
   * Add history entry
   */
  addHistoryEntry(entry: ConsentHistoryEntry): void;

  /**
   * Clear history
   */
  clearHistory(): void;
}

// Implementation
class LocalStorageConsentStorage implements ConsentStorage {
  private readonly CONSENT_KEY = 'cookie-consent';
  private readonly HISTORY_KEY = 'consent-history';

  getConsent(): ConsentState | null {
    const stored = localStorage.getItem(this.CONSENT_KEY);
    if (!stored) return null;

    try {
      const parsed = JSON.parse(stored);
      return validateConsent(parsed);
    } catch {
      return null;
    }
  }

  setConsent(consent: ConsentState): void {
    localStorage.setItem(this.CONSENT_KEY, JSON.stringify(consent));
  }

  // ... other methods
}
```

### Cookie Storage Interface

```typescript
interface ConsentCookieStorage {
  /**
   * Set consent cookie (for server-side reading)
   */
  setConsentCookie(consent: ConsentState): void;

  /**
   * Get consent from cookie
   */
  getConsentCookie(): ConsentState | null;

  /**
   * Clear consent cookie
   */
  clearConsentCookie(): void;
}
```

---

## Integration Examples

### Google Analytics Integration

```typescript
// src/utils/analytics.ts

import { useConsent } from '@/hooks/useConsent';
import { CookieCategory } from '@/utils/consent-types';

export function useGoogleAnalytics() {
  const { consent } = useConsent();

  useEffect(() => {
    if (!window.gtag) return;

    // Update Google Consent Mode
    window.gtag('consent', 'update', {
      analytics_storage: consent.analytics ? 'granted' : 'denied',
      ad_storage: consent.marketing ? 'granted' : 'denied',
      functionality_storage: consent.functional ? 'granted' : 'denied',
      personalization_storage: consent.marketing ? 'granted' : 'denied',
      security_storage: 'granted',
    });

    // Initialize GA4 if consented
    if (consent.analytics) {
      window.gtag('config', 'GA_MEASUREMENT_ID');
    }
  }, [consent]);
}
```

### Theme Persistence Integration

```typescript
// src/hooks/useTheme.ts

import { useConsent } from '@/hooks/useConsent';
import { CookieCategory } from '@/utils/consent-types';

export function useTheme() {
  const { canUseCookies } = useConsent();
  const [theme, setTheme] = useState('light');

  const saveTheme = (newTheme: string) => {
    setTheme(newTheme);

    if (canUseCookies(CookieCategory.FUNCTIONAL)) {
      // Save to localStorage if consented
      localStorage.setItem('theme', newTheme);
    } else {
      // Use sessionStorage as fallback
      sessionStorage.setItem('theme', newTheme);
    }
  };

  return { theme, setTheme: saveTheme };
}
```

---

## Testing Contracts

### Mock Providers

```typescript
// src/test-utils/consent-mocks.tsx

export const MockConsentProvider: React.FC<{
  children: React.ReactNode;
  consent?: Partial<ConsentState>;
}> = ({ children, consent }) => {
  const mockConsent: ConsentState = {
    necessary: true,
    functional: true,
    analytics: true,
    marketing: false,
    ...consent
  };

  return (
    <ConsentContext.Provider value={{
      consent: mockConsent,
      showBanner: false,
      showModal: false,
      acceptAll: jest.fn(),
      rejectAll: jest.fn(),
      // ... other mocked methods
    }}>
      {children}
    </ConsentContext.Provider>
  );
};
```

### Test Utilities

```typescript
// src/test-utils/consent-helpers.ts

export function createMockConsent(
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
    method: ConsentMethod.DEFAULT,
    ...overrides,
  };
}

export function mockLocalStorage(): void {
  const store: Record<string, string> = {};

  jest
    .spyOn(Storage.prototype, 'getItem')
    .mockImplementation((key) => store[key] || null);

  jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
    store[key] = value;
  });
}
```

---

API Contracts completed: 2025-09-15
Next: Generate quickstart.md
