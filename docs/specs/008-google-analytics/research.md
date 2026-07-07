# PRP-008: Technology Research & Decisions

## Overview

This document outlines the technology choices and implementation decisions for integrating Google Analytics 4 (GA4) into the CRUDkit application.

## Technology Selection

### Analytics Platform: Google Analytics 4

**Why GA4?**

- Industry standard for web analytics
- Free tier sufficient for most projects
- Privacy-focused with consent mode
- Excellent Next.js integration
- Comprehensive documentation

**Alternatives Considered:**

- **Plausible**: Privacy-first but paid
- **Matomo**: Self-hosted complexity
- **Fathom**: Limited free tier
- **PostHog**: Over-engineered for our needs

### Implementation Approach: Direct gtag.js

**Why Direct Implementation?**

- No additional npm dependencies
- Full control over loading behavior
- Consent-aware from the start
- Smaller bundle size
- Official Google approach

**Alternatives Considered:**

- **react-ga4**: Adds unnecessary abstraction
- **next-google-analytics**: Limited consent control
- **gtag npm package**: Outdated, not maintained

## Technical Decisions

### 1. Script Loading Strategy

**Decision**: Use Next.js Script component with `afterInteractive`

```typescript
<Script
  src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
  strategy="afterInteractive"
/>
```

**Rationale:**

- Non-blocking page load
- Optimal performance
- Built-in Next.js optimization
- Lazy loading support

### 2. Consent Integration

**Decision**: Deep integration with ConsentContext

```typescript
if (consent.analytics) {
  // Load and initialize GA4
} else {
  // Don't load any GA4 resources
}
```

**Rationale:**

- GDPR compliance
- User privacy respect
- No tracking without consent
- Clean implementation

### 3. Web Vitals Integration

**Decision**: Enhance existing web-vitals.ts

```typescript
// Send to GA4 if consent granted
if (window.gtag && hasAnalyticsConsent()) {
  window.gtag('event', metric.name, {...});
}
```

**Rationale:**

- Leverage existing implementation
- Automatic performance tracking
- No duplicate code
- Consent-aware metrics

### 4. Event Tracking Architecture

**Decision**: Centralized through useAnalytics hook

```typescript
const analytics = useAnalytics();
analytics.trackEvent('action', 'category', 'label');
```

**Rationale:**

- Consistent API across app
- Consent checking built-in
- Easy to test and mock
- Type-safe implementation

### 5. TypeScript Support

**Decision**: Full type definitions for gtag

```typescript
declare global {
  interface Window {
    gtag: GtagFunction;
    dataLayer: any[];
  }
}
```

**Rationale:**

- Type safety
- Better IDE support
- Catch errors at compile time
- Self-documenting code

## Implementation Patterns

### Pattern 1: Consent-First Loading

```typescript
// Only load if consent granted
if (!consent.analytics) return null;

return <Script ... />;
```

### Pattern 2: Graceful Degradation

```typescript
try {
  window.gtag('event', ...);
} catch (error) {
  // Silently fail - analytics is optional
}
```

### Pattern 3: Debug Mode

```typescript
const debugMode = process.env.NODE_ENV === 'development';
gtag('config', GA_ID, { debug_mode: debugMode });
```

## Security Considerations

### CSP Header Updates

**Required Domains:**

- `https://www.googletagmanager.com` - gtag.js script
- `https://www.google-analytics.com` - Analytics endpoint
- `https://analytics.google.com` - Analytics resources
- `https://stats.g.doubleclick.net` - Analytics beacon

**Implementation:**

```javascript
script-src 'self' 'unsafe-inline' https://www.googletagmanager.com;
connect-src 'self' https://www.google-analytics.com https://analytics.google.com;
```

### Data Privacy

**Implemented Safeguards:**

- IP anonymization by default
- No PII in custom events
- Consent mode v2 compliance
- Data retention limits
- User opt-out persistence

## Performance Optimization

### Loading Optimization

- Async script loading
- AfterInteractive strategy
- No render blocking
- Conditional loading based on consent

### Bundle Size Impact

- No npm dependencies: 0KB
- gtag.js: ~28KB (gzipped, loaded async)
- Our code: <2KB
- Total impact: Minimal when async

### Runtime Performance

- Events debounced where appropriate
- No synchronous operations
- Background thread usage
- RequestIdleCallback for non-critical events

## Browser Compatibility

### Supported Browsers

- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅

### Fallback Strategy

- Feature detection for Performance Observer
- Graceful degradation for older browsers
- Core functionality works without Web Vitals
- No errors thrown in unsupported browsers

## Testing Strategy

### Unit Testing

- Mock window.gtag
- Test consent integration
- Verify event formatting
- Check type safety

### Integration Testing

- Consent flow validation
- Script loading behavior
- Event tracking accuracy
- CSP compliance

### E2E Testing

- Real GA4 property (test account)
- DebugView validation
- Cross-browser testing
- Performance impact measurement

## Monitoring & Debugging

### Development Tools

- GA4 DebugView for real-time events
- Browser DevTools for network inspection
- Console logging in development mode
- React DevTools for component state

### Production Monitoring

- GA4 Real-time reports
- Custom alerts for anomalies
- Performance budget tracking
- Error event tracking

## Migration Path

### From Universal Analytics

Not applicable - new implementation

### Future Considerations

- Server-side tracking (future PRP)
- Enhanced ecommerce (if needed)
- Custom dimensions/metrics
- Audience integration

## Cost Analysis

### GA4 Pricing

- **Free Tier**: 10M events/month
- **Our Usage**: ~100K events/month estimated
- **Cost**: $0 (well within free tier)

### Alternative Costs (for comparison)

- Plausible: $9/month
- Fathom: $14/month
- Matomo Cloud: $23/month

## Recommendations

1. **Start Simple**: Basic implementation first, enhance later
2. **Privacy First**: Always check consent before tracking
3. **Test Thoroughly**: Use DebugView extensively
4. **Document Events**: Maintain event taxonomy
5. **Monitor Usage**: Watch event volumes for cost

## Conclusion

The chosen approach provides a robust, privacy-conscious, and performant analytics implementation that aligns with modern web standards and user expectations. The direct gtag.js implementation offers the best balance of control, performance, and maintainability.
