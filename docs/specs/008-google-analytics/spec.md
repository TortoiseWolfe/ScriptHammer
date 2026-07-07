# Product Requirements Prompt (PRP)

**Feature Name**: Google Analytics 4 Integration  
**Priority**: P1 (Constitutional Enhancement)  
**Sprint**: Sprint 3  
**Status**: 📥 Inbox  
**Created**: 2025-09-13  
**Author**: AI Assistant (from SpecKit analysis)

---

## 1. Product Requirements

### What We're Building

A privacy-conscious Google Analytics 4 (GA4) integration with consent management that tracks user behavior, Web Vitals, and custom events. The implementation will respect user privacy choices and only activate after explicit consent.

### Why We're Building It

- Constitutional requirement (Section 6, Phase 4: Google Analytics)
- Essential for understanding user behavior
- Web Vitals monitoring already in place, needs GA4 integration
- Demonstrates privacy-first analytics implementation
- Required for production deployments

### Success Criteria

- [ ] GA4 loads only after cookie consent
- [ ] Web Vitals automatically tracked to GA4
- [ ] Custom events for key interactions
- [ ] Debug mode for development
- [ ] CSP headers updated for Google domains
- [ ] Works with all 32 themes
- [ ] No impact on Lighthouse scores
- [ ] Privacy mode when consent denied

### Out of Scope

- Google Ads integration
- Enhanced ecommerce tracking
- Server-side tracking
- Google Tag Manager
- Universal Analytics (deprecated)

---

## 2. Context & Codebase Intelligence

### Existing Patterns to Follow

#### Web Vitals Collection

```typescript
// src/utils/web-vitals.ts
import { onCLS, onFCP, onLCP, onTTFB } from 'web-vitals';

export function reportWebVitals(metric: any) {
  if (metric.label === 'web-vital') {
    console.log(metric);
    // Currently only logs, needs GA4 integration
  }
}
```

#### Consent Context (from Cookie Consent PRP)

```typescript
// src/contexts/ConsentContext.tsx
interface ConsentState {
  necessary: boolean;
  functional: boolean;
  analytics: boolean; // This controls GA4
  marketing: boolean;
}
```

#### CSP Headers

```javascript
// next.config.ts
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  // Needs Google Analytics domains added
`;
```

### Dependencies & Libraries

```bash
# No npm packages needed - using gtag.js directly
# Script loaded conditionally based on consent
```

### File Structure

```
src/
├── components/
│   └── analytics/
│       ├── GoogleAnalytics/
│       │   ├── index.tsx
│       │   ├── GoogleAnalytics.tsx
│       │   ├── GoogleAnalytics.test.tsx
│       │   └── GoogleAnalytics.stories.tsx
│       └── Analytics.tsx          # Wrapper component
├── utils/
│   ├── analytics.ts               # GA4 utilities
│   └── web-vitals.ts              # UPDATE: Send to GA4
└── hooks/
    └── useAnalytics.ts            # Analytics hook
```

---

## 3. Technical Specifications

### GA4 Configuration

```typescript
// src/utils/analytics.ts
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Initialize gtag
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

export function initializeGA() {
  if (typeof window === 'undefined' || !GA_MEASUREMENT_ID) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());

  // Default to denied until consent
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
  });

  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false, // We'll send manually
    debug_mode: process.env.NODE_ENV === 'development',
  });
}

// Update consent
export function updateGAConsent(granted: boolean) {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('consent', 'update', {
    analytics_storage: granted ? 'granted' : 'denied',
  });
}

// Track page views
export function trackPageView(url: string) {
  if (!window.gtag) return;

  window.gtag('event', 'page_view', {
    page_path: url,
    page_title: document.title,
  });
}

// Track custom events
export function trackEvent({
  action,
  category,
  label,
  value,
}: {
  action: string;
  category: string;
  label?: string;
  value?: number;
}) {
  if (!window.gtag) return;

  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
}
```

### GoogleAnalytics Component

```typescript
// src/components/analytics/GoogleAnalytics.tsx
'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useConsent } from '@/contexts/ConsentContext';
import { GA_MEASUREMENT_ID, initializeGA, updateGAConsent, trackPageView } from '@/utils/analytics';

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const { consent } = useConsent();

  // Initialize GA and handle consent
  useEffect(() => {
    if (consent.analytics && GA_MEASUREMENT_ID) {
      initializeGA();
      updateGAConsent(true);
    } else {
      updateGAConsent(false);
    }
  }, [consent.analytics]);

  // Track page views
  useEffect(() => {
    if (consent.analytics) {
      trackPageView(pathname);
    }
  }, [pathname, consent.analytics]);

  // Only load script if consent granted
  if (!consent.analytics || !GA_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
```

### Web Vitals Integration

```typescript
// Update src/utils/web-vitals.ts
import { onCLS, onFCP, onLCP, onTTFB, Metric } from 'web-vitals';
import { trackEvent } from './analytics';

export function reportWebVitals(metric: Metric) {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(metric);
  }

  // Send to Google Analytics
  trackEvent({
    action: 'web_vitals',
    category: 'Web Vitals',
    label: metric.name,
    value: Math.round(metric.value),
  });

  // Also send as custom metric for better GA4 reporting
  if (window.gtag) {
    window.gtag('event', metric.name, {
      value: metric.value,
      metric_id: metric.id,
      metric_value: metric.value,
      metric_delta: metric.delta,
      metric_rating: metric.rating,
    });
  }
}
```

### Custom Events

```typescript
// src/hooks/useAnalytics.ts
import { trackEvent } from '@/utils/analytics';
import { useConsent } from '@/contexts/ConsentContext';

export function useAnalytics() {
  const { consent } = useConsent();

  const track = (
    action: string,
    category: string,
    label?: string,
    value?: number
  ) => {
    if (!consent.analytics) return;
    trackEvent({ action, category, label, value });
  };

  return {
    trackThemeChange: (theme: string) => track('theme_change', 'UI', theme),

    trackFormSubmit: (formName: string) =>
      track('form_submit', 'Forms', formName),

    trackPWAInstall: (result: 'accepted' | 'dismissed') =>
      track('pwa_install', 'PWA', result),

    trackError: (error: string, fatal: boolean = false) =>
      track('exception', 'Errors', error, fatal ? 1 : 0),

    trackSearch: (query: string) => track('search', 'Site Search', query),

    trackClick: (element: string, section: string) =>
      track('click', section, element),
  };
}
```

### Environment Configuration

```bash
# .env.local
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# .env.example
NEXT_PUBLIC_GA_MEASUREMENT_ID=your_ga4_measurement_id
```

### CSP Header Updates

```javascript
// next.config.ts updates
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com;
  connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net;
  img-src 'self' data: https://www.google-analytics.com;
`;
```

---

## 4. Implementation Runbook

### Step 1: Create GA4 Property

1. Go to Google Analytics
2. Create new GA4 property
3. Get Measurement ID (G-XXXXXXXXXX)
4. Add to .env.local

### Step 2: Implement Analytics Utilities

```bash
# Create analytics files
touch src/utils/analytics.ts
touch src/hooks/useAnalytics.ts

# Implement utilities (see Technical Specs)
```

### Step 3: Create GoogleAnalytics Component

```bash
# Create component directory
mkdir -p src/components/analytics/GoogleAnalytics

# Create component files
touch src/components/analytics/GoogleAnalytics/{index.tsx,GoogleAnalytics.tsx,GoogleAnalytics.test.tsx,GoogleAnalytics.stories.tsx}
```

### Step 4: Integration

```typescript
// app/layout.tsx
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <GoogleAnalytics />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### Step 5: Update Web Vitals

```typescript
// app/layout.tsx
import { reportWebVitals } from '@/utils/web-vitals';

// Web Vitals reporting
if (typeof window !== 'undefined') {
  reportWebVitals(console.log);
}
```

### Step 6: Add Event Tracking

```typescript
// Example: ThemeSwitcher.tsx
const analytics = useAnalytics();

const handleThemeChange = (theme: string) => {
  // ... existing code
  analytics.trackThemeChange(theme);
};
```

### Step 7: Testing

- [ ] GA4 loads only with consent
- [ ] Events appear in GA4 DebugView
- [ ] Web Vitals tracked
- [ ] Page views recorded
- [ ] CSP headers allow GA4
- [ ] No console errors

---

## 5. Validation Loops

### Pre-Implementation Checks

- [ ] GA4 property created
- [ ] Measurement ID obtained
- [ ] Consent system implemented
- [ ] CSP headers understood

### During Implementation

- [ ] Script loads conditionally
- [ ] Consent respected
- [ ] Events firing correctly
- [ ] No performance impact

### Post-Implementation

- [ ] Data flowing to GA4
- [ ] DebugView working
- [ ] Real-time data visible
- [ ] Reports generating

---

## 6. Risk Mitigation

### Potential Risks

1. **Risk**: Ad blockers prevent GA4 loading
   **Mitigation**: Graceful degradation, no errors thrown

2. **Risk**: Performance impact from tracking
   **Mitigation**: Async loading, debounce events

3. **Risk**: Privacy compliance issues
   **Mitigation**: Strict consent checking, data anonymization

4. **Risk**: CSP violations
   **Mitigation**: Properly configured headers, tested thoroughly

---

## 7. References

### Internal Documentation

- Constitution: `/docs/constitution.md` (Section 6, Phase 4)
- Web Vitals: `/src/utils/web-vitals.ts`
- Consent Context: `/src/contexts/ConsentContext.tsx`
- CSP Config: `/next.config.ts`

### External Resources

- [GA4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [GA4 with Next.js](https://nextjs.org/docs/app/building-your-application/optimizing/third-party-libraries#google-analytics)
- [Google Consent Mode](https://support.google.com/analytics/answer/9976101)
- [Web Vitals to GA4](https://web.dev/vitals-ga4/)

---

## PRP Workflow Status

### Review Checklist (Inbox → Outbox)

- [ ] Product requirements clear and complete
- [ ] Technical approach validated
- [ ] Resources available
- [ ] No blocking dependencies
- [ ] Approved by: [PENDING]

### Processing Status (Outbox → Processed)

- [ ] Specification generated
- [ ] Plan created
- [ ] Tasks broken down
- [ ] Implementation started
- [ ] Completed on: [PENDING]

---

<!--
PRP for Google Analytics 4 Integration
Generated from SpecKit constitution analysis
Privacy-first analytics implementation
-->
