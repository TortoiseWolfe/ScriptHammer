# Google Analytics 4 Integration - Quick Start Guide

## Prerequisites

Before starting, ensure you have:

- [ ] Access to Google Analytics account
- [ ] CRUDkit development environment running
- [ ] Completed PRP-007 (Cookie Consent) ✅

## Step 1: Create GA4 Property (5 minutes)

1. Go to [Google Analytics](https://analytics.google.com)
2. Click **Admin** (gear icon)
3. Click **Create Property**
4. Enter property details:
   - Property name: `CRUDkit - [Your Name]`
   - Time zone: Your local timezone
   - Currency: Your currency
5. Click **Next**
6. Fill business details and click **Create**
7. Choose **Web** platform
8. Enter website details:
   - Website URL: `https://yourdomain.com` (or `http://localhost:3000` for dev)
   - Stream name: `CRUDkit Web Stream`
9. Copy the **Measurement ID** (G-XXXXXXXXXX)

## Step 2: Configure Environment (2 minutes)

1. Open `.env.local` in your project root
2. Add your Measurement ID:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

3. Update `.env.example` for team members:

```bash
# Google Analytics 4
NEXT_PUBLIC_GA_MEASUREMENT_ID=your_ga4_measurement_id_here
```

## Step 3: Generate Component (1 minute)

Run the component generator:

```bash
docker compose exec scripthammer pnpm run generate:component
```

When prompted:

- Category: `atomic`
- Name: `GoogleAnalytics`
- Path: `analytics/GoogleAnalytics`

This creates the proper 5-file structure automatically.

## Step 4: Quick Implementation (10 minutes)

### 4.1 Create Analytics Utilities

Create `src/utils/analytics.ts`:

```typescript
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

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
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false,
    debug_mode: process.env.NODE_ENV === 'development',
  });
}

export function trackEvent(
  action: string,
  category: string,
  label?: string,
  value?: number
) {
  if (!window.gtag) return;
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
}
```

### 4.2 Update GoogleAnalytics Component

Edit `src/components/atomic/analytics/GoogleAnalytics/GoogleAnalytics.tsx`:

```typescript
'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useConsent } from '@/contexts/ConsentContext';
import { GA_MEASUREMENT_ID, initializeGA } from '@/utils/analytics';

export function GoogleAnalytics() {
  const pathname = usePathname();
  const { consent } = useConsent();

  useEffect(() => {
    if (consent.analytics && GA_MEASUREMENT_ID) {
      initializeGA();
      window.gtag('event', 'page_view', {
        page_path: pathname
      });
    }
  }, [pathname, consent.analytics]);

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

### 4.3 Add to Layout

Edit `src/app/layout.tsx`:

```typescript
import { GoogleAnalytics } from '@/components/atomic/analytics/GoogleAnalytics';

// In the component, add after ConsentProvider:
<ConsentProvider>
  <GoogleAnalytics />
  {/* ... rest of your app ... */}
</ConsentProvider>
```

### 4.4 Update CSP Headers

Edit `next.config.ts`:

```javascript
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com;
  connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net;
  // ... rest of CSP
`;
```

## Step 5: Test Your Integration (5 minutes)

### 5.1 Enable Debug Mode

1. Open Chrome DevTools
2. Go to GA4 property → **Admin** → **DebugView**
3. Keep this tab open

### 5.2 Test in Development

1. Start your dev server:

```bash
docker compose up
```

2. Open http://localhost:3000
3. Accept cookie consent (analytics category)
4. Navigate between pages
5. Check DebugView for events appearing in real-time

### 5.3 Verify Events

You should see:

- `page_view` events when navigating
- `web_vitals` events for performance metrics
- Custom events you've implemented

## Step 6: Common Event Implementations

### Theme Change Tracking

```typescript
import { trackEvent } from '@/utils/analytics';

const handleThemeChange = (theme: string) => {
  // ... existing code
  trackEvent('theme_change', 'UI', theme);
};
```

### Form Submission

```typescript
const handleSubmit = (e: FormEvent) => {
  e.preventDefault();
  // ... form logic
  trackEvent('form_submit', 'Forms', 'contact_form');
};
```

### Error Tracking

```typescript
window.addEventListener('error', (e) => {
  trackEvent('exception', 'Errors', e.message, 1);
});
```

## Troubleshooting

### Events Not Appearing

1. **Check Consent**: Ensure analytics consent is granted
2. **Check Measurement ID**: Verify it's correctly set in `.env.local`
3. **Check Ad Blocker**: Disable ad blockers temporarily
4. **Check Console**: Look for gtag errors in browser console

### CSP Errors

If you see CSP violations:

1. Check `next.config.ts` includes all Google domains
2. Restart Next.js after config changes
3. Clear browser cache

### Debug Mode Not Working

1. Ensure `debug_mode: true` in development
2. Install [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna) Chrome extension
3. Check DebugView is enabled in GA4

## Next Steps

1. **Add More Events**: Implement tracking for key user actions
2. **Set Up Goals**: Configure conversions in GA4
3. **Create Audiences**: Segment your users
4. **Build Reports**: Create custom reports for insights
5. **Test Production**: Verify everything works in production

## Resources

- [GA4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [Next.js Analytics](https://nextjs.org/docs/app/building-your-application/optimizing/third-party-libraries#google-analytics)
- [Web Vitals Guide](https://web.dev/vitals/)
- [GA4 DebugView](https://support.google.com/analytics/answer/7201382)

## Support

If you encounter issues:

1. Check the [troubleshooting section](#troubleshooting)
2. Review browser console for errors
3. Verify events in GA4 DebugView
4. Check CSP headers in Network tab
5. Open an issue in the CRUDkit repository

---

**Time to Complete**: ~25 minutes
**Difficulty**: Easy
**Prerequisites**: Cookie Consent (PRP-007) completed
