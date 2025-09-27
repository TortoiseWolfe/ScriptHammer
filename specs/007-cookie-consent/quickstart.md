# Quickstart Guide: Cookie Consent & GDPR Compliance

## Overview

This guide provides quick instructions for developers working with the cookie consent system.

## Table of Contents

1. [Quick Setup](#quick-setup)
2. [Basic Usage](#basic-usage)
3. [Common Patterns](#common-patterns)
4. [Testing Guide](#testing-guide)
5. [Compliance Checklist](#compliance-checklist)
6. [Troubleshooting](#troubleshooting)

---

## Quick Setup

### 1. Wrap Your App

```tsx
// app/layout.tsx
import { ConsentProvider } from '@/contexts/ConsentContext';
import CookieConsent from '@/components/privacy/CookieConsent';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ConsentProvider>
          {children}
          <CookieConsent position="bottom" />
        </ConsentProvider>
      </body>
    </html>
  );
}
```

### 2. Check Consent Before Setting Cookies

```tsx
import { useConsent } from '@/hooks/useConsent';
import { CookieCategory } from '@/utils/consent-types';

function MyComponent() {
  const { canUseCookies } = useConsent();

  const savePreference = (value: string) => {
    if (canUseCookies(CookieCategory.FUNCTIONAL)) {
      // Safe to use cookies
      document.cookie = `preference=${value}; path=/; max-age=31536000`;
    } else {
      // Fallback to sessionStorage
      sessionStorage.setItem('preference', value);
    }
  };
}
```

### 3. Load Analytics Conditionally

```tsx
// components/Analytics.tsx
import { useEffect } from 'react';
import { useConsent } from '@/hooks/useConsent';
import { CookieCategory } from '@/utils/consent-types';

export function Analytics() {
  const { consent } = useConsent();

  useEffect(() => {
    if (consent.analytics) {
      // Load Google Analytics
      const script = document.createElement('script');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
      script.async = true;
      document.head.appendChild(script);

      window.gtag('config', GA_ID);
    }
  }, [consent.analytics]);

  return null;
}
```

---

## Basic Usage

### Accept All Consent

```tsx
const { acceptAll } = useConsent();

<button onClick={acceptAll}>Accept All Cookies</button>;
```

### Reject All (Except Necessary)

```tsx
const { rejectAll } = useConsent();

<button onClick={rejectAll}>Reject All</button>;
```

### Custom Preferences

```tsx
const { consent, updateConsent } = useConsent();

<div>
  <label>
    <input
      type="checkbox"
      checked={consent.functional}
      onChange={(e) =>
        updateConsent(CookieCategory.FUNCTIONAL, e.target.checked)
      }
    />
    Functional Cookies
  </label>
</div>;
```

### Export User Data

```tsx
import { usePrivacy } from '@/hooks/usePrivacy';

function PrivacySettings() {
  const { exportData } = usePrivacy();

  const handleExport = async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-data.json';
    a.click();
  };

  return <button onClick={handleExport}>Export My Data</button>;
}
```

---

## Common Patterns

### Pattern 1: Feature Flags Based on Consent

```tsx
function FeatureComponent() {
  const { consent } = useConsent();

  return (
    <div>
      {consent.analytics && <AnalyticsDashboard />}
      {consent.functional && <PersonalizationSettings />}
      {consent.marketing && <RecommendedProducts />}
    </div>
  );
}
```

### Pattern 2: Server-Side Consent Check

```tsx
// Set a cookie that can be read server-side
const { consent } = useConsent();

useEffect(() => {
  // Create a simple consent cookie for server
  document.cookie = `consent-status=${JSON.stringify({
    analytics: consent.analytics,
    marketing: consent.marketing,
  })}; path=/; max-age=31536000; SameSite=Lax`;
}, [consent]);
```

### Pattern 3: Lazy Loading Based on Consent

```tsx
import dynamic from 'next/dynamic';
import { useConsent } from '@/hooks/useConsent';

function HomePage() {
  const { consent } = useConsent();

  // Only load analytics component if consented
  const Analytics = consent.analytics
    ? dynamic(() => import('@/components/Analytics'))
    : () => null;

  return (
    <>
      <MainContent />
      <Analytics />
    </>
  );
}
```

### Pattern 4: Consent-Aware Forms

```tsx
function ContactForm() {
  const { consent } = useConsent();
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  return (
    <form>
      <input name="email" type="email" required />

      {consent.marketing && (
        <label>
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
          />
          Send me marketing emails
        </label>
      )}

      <button type="submit">Submit</button>
    </form>
  );
}
```

---

## Testing Guide

### Test Setup

```tsx
// test-setup.ts
import '@testing-library/jest-dom';
import { MockConsentProvider } from '@/test-utils/consent-mocks';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;
```

### Testing Consent Flow

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsentProvider } from '@/contexts/ConsentContext';
import CookieConsent from '@/components/privacy/CookieConsent';

describe('Cookie Consent', () => {
  it('shows banner on first visit', () => {
    render(
      <ConsentProvider>
        <CookieConsent />
      </ConsentProvider>
    );

    expect(screen.getByText(/We use cookies/i)).toBeInTheDocument();
  });

  it('accepts all cookies', () => {
    render(
      <ConsentProvider>
        <CookieConsent />
      </ConsentProvider>
    );

    fireEvent.click(screen.getByText('Accept All'));

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'cookie-consent',
      expect.stringContaining('"analytics":true')
    );
  });
});
```

### Testing with Mock Consent

```tsx
import { render } from '@testing-library/react';
import { MockConsentProvider } from '@/test-utils/consent-mocks';
import MyComponent from '@/components/MyComponent';

test('renders with analytics consent', () => {
  render(
    <MockConsentProvider consent={{ analytics: true }}>
      <MyComponent />
    </MockConsentProvider>
  );

  // Component should render analytics features
  expect(screen.getByTestId('analytics-widget')).toBeInTheDocument();
});
```

---

## Compliance Checklist

### GDPR Requirements

- [ ] **Explicit Consent**: No pre-ticked boxes
- [ ] **Granular Control**: Separate consent for each purpose
- [ ] **Easy Withdrawal**: Clear way to change/revoke consent
- [ ] **Information**: Clear description of each cookie category
- [ ] **Records**: Store when and how consent was given
- [ ] **No Cookie Walls**: Site usable without accepting all cookies

### Technical Implementation

- [ ] **No Cookies Before Consent**: Check consent before setting
- [ ] **Consent Persistence**: Save preferences for return visits
- [ ] **Version Management**: Handle consent version updates
- [ ] **Data Export**: Provide user data in portable format
- [ ] **Data Deletion**: Clear all data when requested
- [ ] **Consent API**: Programmatic access to consent state

### UI/UX Requirements

- [ ] **Visible Banner**: Clear and prominent on first visit
- [ ] **Equal Prominence**: Accept/Reject equally visible
- [ ] **Accessible**: Keyboard navigable, screen reader friendly
- [ ] **Responsive**: Works on all device sizes
- [ ] **Performance**: Minimal impact on page load
- [ ] **Dismissible**: Can close without accepting

### Documentation

- [ ] **Privacy Policy**: Updated with cookie information
- [ ] **Cookie Policy**: Detailed list of all cookies
- [ ] **Developer Docs**: Integration instructions
- [ ] **Test Coverage**: Unit and integration tests
- [ ] **Audit Trail**: Consent change logging

---

## Troubleshooting

### Banner Not Showing

```tsx
// Check if consent already exists
const stored = localStorage.getItem('cookie-consent');
if (stored) {
  // User has already consented
  console.log('Existing consent:', JSON.parse(stored));
}

// Force banner to show (for testing)
localStorage.removeItem('cookie-consent');
window.location.reload();
```

### Consent Not Persisting

```tsx
// Verify localStorage is available
if (typeof Storage === 'undefined') {
  console.error('localStorage not supported');
}

// Check for private browsing mode
try {
  localStorage.setItem('test', 'test');
  localStorage.removeItem('test');
} catch (e) {
  console.error('localStorage not available:', e);
}
```

### Analytics Not Loading

```tsx
// Debug consent state
const { consent } = useConsent();
console.log('Analytics consent:', consent.analytics);

// Check for ad blockers
if (window.gtag === undefined) {
  console.warn('Google Analytics blocked or not loaded');
}

// Verify script loading
const scripts = Array.from(document.scripts);
const gaScript = scripts.find((s) => s.src.includes('googletagmanager'));
console.log('GA script loaded:', !!gaScript);
```

### Cookies Still Being Set

```tsx
// Audit all cookie setters
const originalSetCookie = document.__lookupSetter__('cookie');
document.__defineSetter__('cookie', function (value) {
  console.trace('Cookie being set:', value);
  return originalSetCookie.call(document, value);
});

// Check third-party scripts
if (window.performance) {
  const resources = performance.getEntriesByType('resource');
  const thirdParty = resources.filter(
    (r) => !r.name.includes(window.location.hostname)
  );
  console.log('Third-party resources:', thirdParty);
}
```

---

## Quick Commands

### Development

```bash
# Run tests
pnpm test src/components/privacy
pnpm test src/contexts/ConsentContext

# Type checking
pnpm tsc --noEmit

# Lint
pnpm lint src/components/privacy

# Storybook
pnpm storybook
```

### Debugging

```javascript
// Console commands for debugging

// Check current consent
JSON.parse(localStorage.getItem('cookie-consent'));

// Reset consent
localStorage.removeItem('cookie-consent');

// Force banner
window.dispatchEvent(new Event('consent:reset'));

// Export all cookies
document.cookie.split(';').map((c) => c.trim());

// Clear all cookies
document.cookie.split(';').forEach((c) => {
  document.cookie =
    c.split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
});
```

---

## Resources

- [GDPR Cookie Guidance](https://gdpr.eu/cookies/)
- [ICO Cookie Guidance](https://ico.org.uk/for-organisations/guide-to-pecr/cookies-and-similar-technologies/)
- [Google Consent Mode](https://support.google.com/analytics/answer/9976101)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

Quickstart Guide completed: 2025-09-15
Ready for implementation!
