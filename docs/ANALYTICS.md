# Google Analytics 4 Integration Guide

## Overview

ScriptHammer includes a privacy-conscious Google Analytics 4 (GA4) integration that respects user consent and provides comprehensive tracking capabilities for understanding user behavior.

## Features

- ✅ **Privacy-First**: Analytics only loads after explicit user consent
- ✅ **Consent Management**: Fully integrated with cookie consent system
- ✅ **Web Vitals Tracking**: Automatic tracking of Core Web Vitals (FCP, LCP, CLS, TTFB)
- ✅ **Custom Event Tracking**: Track user interactions, errors, and conversions
- ✅ **Error Tracking**: Automatic error boundary integration
- ✅ **PWA Tracking**: Track PWA install events and engagement
- ✅ **Theme Tracking**: Monitor theme preference changes
- ✅ **TypeScript Support**: Fully typed analytics functions

## Setup

### 1. Create a GA4 Property

1. Go to [Google Analytics](https://analytics.google.com/)
2. Create a new GA4 property
3. Copy your Measurement ID (format: `G-XXXXXXXXXX`)

### 2. Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local and add your measurement ID
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 3. Verify Installation

Analytics will automatically initialize when:

- The measurement ID is configured
- The user grants analytics consent
- The page loads

## Event Tracking

### Automatic Events

The following events are tracked automatically:

#### Page Views

- Tracked on every route change
- Includes page path, title, and referrer

#### Web Vitals

- **FCP** (First Contentful Paint)
- **LCP** (Largest Contentful Paint)
- **CLS** (Cumulative Layout Shift)
- **TTFB** (Time to First Byte)
- **FID** (First Input Delay)
- **INP** (Interaction to Next Paint)

#### Error Events

- JavaScript errors caught by ErrorBoundary
- Includes error message, severity, and category
- Fatal errors marked for critical issues

### Custom Events

Use the `useAnalytics` hook to track custom events:

```typescript
import { useAnalytics } from '@/hooks/useAnalytics';

function MyComponent() {
  const {
    trackEvent,
    trackClick,
    trackFormSubmit,
    trackSearch,
    trackPWAInstall,
    trackThemeChange,
    trackError,
  } = useAnalytics();

  // Track generic event
  trackEvent('video_play', 'Video', 'Tutorial', 42);

  // Track click
  trackClick('cta_button', 'Homepage');

  // Track form submission
  trackFormSubmit('contact_form', true);

  // Track search
  trackSearch('react hooks');

  // Track PWA install
  trackPWAInstall('accepted', 'mobile');

  // Track theme change
  trackThemeChange('dark', 'light');

  // Track error
  trackError('API request failed', false);
}
```

### Event Categories

Events are organized into categories for better analysis:

- **UI**: User interface interactions (clicks, theme changes)
- **Forms**: Form submissions and validation
- **PWA**: Progressive Web App events
- **Errors**: Application errors and exceptions
- **Performance**: Web Vitals and loading metrics
- **Site Search**: Search queries and results

## PWA Event Tracking

The PWA installation flow tracks these events:

1. **install_prompt_shown**: When the browser shows the install prompt
2. **install_button_clicked**: User clicks the install button
3. **install_accepted**: User accepts the installation
4. **install_dismissed**: User dismisses the installation
5. **install_prompt_minimized**: User minimizes the prompt
6. **install_prompt_expanded**: User expands the minimized prompt
7. **install_prompt_dismissed_forever**: User permanently dismisses
8. **installed**: App successfully installed

## Theme Tracking

Theme changes are tracked with:

- Current theme name
- Previous theme name
- Timestamp of change

## Error Tracking

Errors are automatically tracked with:

- Error message and type
- Severity level (low, medium, high, critical)
- Error category (network, validation, auth, system)
- Component stack (in development)
- Fatal flag for critical errors

### Error Categories

- **Network**: API and fetch errors
- **Validation**: Form and input validation errors
- **Authentication**: Login and auth errors
- **Authorization**: Permission errors
- **Business Logic**: Application-specific errors
- **System**: Critical system errors

## Consent Management

Analytics respects user consent choices:

```typescript
// Check if analytics is enabled
import { isAnalyticsEnabled } from '@/utils/analytics';

if (isAnalyticsEnabled()) {
  // Analytics is ready to use
}

// Update consent programmatically
import { updateGAConsent } from '@/utils/analytics';

updateGAConsent(true); // Grant consent
updateGAConsent(false); // Revoke consent
```

## Testing Analytics

### Development Testing

1. **Enable Debug Mode**: Add `?ga_debug=true` to your URL
2. **Check Console**: Look for `[GA]` prefixed messages
3. **Use Browser Extension**: Install Google Analytics Debugger

### GA4 DebugView

1. Go to GA4 > Admin > DebugView
2. Events appear in real-time
3. Click events to see parameters
4. Use for testing custom events

### Testing Checklist

- [ ] Measurement ID is configured
- [ ] Cookie consent banner appears
- [ ] Analytics loads after consent
- [ ] Page views are tracked
- [ ] Custom events fire correctly
- [ ] Web Vitals are collected
- [ ] Errors are tracked
- [ ] PWA events work

## Performance Considerations

### Bundle Size Impact

- GA4 script: ~45KB (gzipped)
- Loaded asynchronously
- No impact on initial page load

### Loading Strategy

- Script loads after consent
- Non-blocking async loading
- Deferred initialization
- No render blocking

### Best Practices

1. Track only necessary events
2. Use event parameters sparingly
3. Batch related events
4. Avoid PII in event data
5. Test in DebugView first

## Privacy & Compliance

### GDPR Compliance

- Explicit consent required
- Consent stored locally
- Easy opt-out mechanism
- No tracking before consent

### Data Collection

- IP anonymization enabled
- No personal data collection
- Secure transmission (HTTPS)
- Data retention: 14 months (default)

### User Rights

- View consent status
- Change consent anytime
- Export tracked data (via GA4)
- Request data deletion

## Troubleshooting

### Analytics Not Loading

1. **Check Measurement ID**

   ```bash
   echo $NEXT_PUBLIC_GA_MEASUREMENT_ID
   ```

2. **Verify Consent**

   ```javascript
   localStorage.getItem('cookie-consent');
   ```

3. **Check Network Tab**
   - Look for `gtag/js` request
   - Should return 200 status

### Events Not Tracking

1. **Enable Debug Mode**

   ```javascript
   window.gtag('config', 'G-XXXXXXXXXX', {
     debug_mode: true,
   });
   ```

2. **Check Console Errors**

   ```javascript
   // Look for gtag errors
   window.dataLayer;
   ```

3. **Verify Event Parameters**
   - Event names: lowercase, underscores
   - No spaces or special characters
   - Parameters must be valid

### Common Issues

**Issue**: "gtag is not defined"

- **Solution**: Ensure GA script is loaded and consent is granted

**Issue**: Events delayed or missing

- **Solution**: Check network connectivity and ad blockers

**Issue**: Incorrect event parameters

- **Solution**: Use GA4 DebugView to inspect parameters

**Issue**: No data in GA4 dashboard

- **Solution**: Wait 24-48 hours for data processing

## Advanced Configuration

### Custom Dimensions

```typescript
// Track custom user properties
trackEvent('user_profile', 'User', undefined, undefined, {
  user_type: 'premium',
  account_age: 365,
  features_used: 10,
});
```

### Enhanced Ecommerce

```typescript
// Track purchase event
trackEvent('purchase', 'Ecommerce', undefined, 99.99, {
  transaction_id: '12345',
  currency: 'USD',
  items: [
    {
      item_id: 'SKU123',
      item_name: 'Product Name',
      price: 99.99,
      quantity: 1,
    },
  ],
});
```

### User Timing

```typescript
// Track custom timing
trackEvent('timing_complete', 'Performance', 'API Load', 1234);
```

## Resources

- [GA4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [GA4 Event Reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/events)
- [Web Vitals Library](https://github.com/GoogleChrome/web-vitals)
- [Consent Mode](https://developers.google.com/tag-platform/devguides/consent)
- [DebugView Guide](https://support.google.com/analytics/answer/7201382)

## Support

For issues or questions:

1. Check this documentation
2. Review [CLAUDE.md](./CLAUDE.md) for development notes
3. Open an issue on GitHub
4. Check GA4 DebugView for real-time testing
