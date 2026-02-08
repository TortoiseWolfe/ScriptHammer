# Feature: Google Analytics 4 Integration

**Feature ID**: 019
**Category**: enhancements
**Source**: ScriptHammer_v_001/docs/specs/008-google-analytics
**Status**: Ready for SpecKit

## Description

A privacy-conscious Google Analytics 4 (GA4) integration with consent management that tracks user behavior, Web Vitals, and custom events. Only activates after explicit user consent.

## User Scenarios

### US-1: Consent-Gated Analytics (P1)

Analytics tracking only begins after user explicitly grants consent via the cookie consent banner.

**Acceptance Criteria**:

1. Given no consent provided, when page loads, then GA4 script is NOT loaded
2. Given analytics consent granted, when page loads, then GA4 initializes
3. Given consent withdrawn, when next page loads, then tracking stops

### US-2: Web Vitals Tracking (P2)

Core Web Vitals (CLS, FCP, LCP, TTFB) are automatically sent to GA4 for performance monitoring.

**Acceptance Criteria**:

1. Given consent granted, when page renders, then Web Vitals are measured
2. Given Web Vitals collected, when sent to GA4, then they appear in reports
3. Given vitals measured, when in dev mode, then they also log to console

### US-3: Custom Event Tracking (P2)

Key user interactions are tracked as custom events.

**Acceptance Criteria**:

1. Given consent granted, when user changes theme, then event is tracked
2. Given consent granted, when form submitted, then event is tracked
3. Given consent granted, when PWA installed, then event is tracked

### US-4: Page View Tracking (P1)

Navigation events are tracked as page views.

**Acceptance Criteria**:

1. Given consent granted, when user navigates, then page_view event fires
2. Given SPA navigation, when route changes, then new page_view is sent
3. Given page view, when tracked, then page_path and page_title included

## Requirements

### Functional

- FR-001: GA4 loads ONLY after cookie consent granted
- FR-002: Web Vitals automatically tracked to GA4
- FR-003: Custom events for theme change, form submit, PWA install, search, errors
- FR-004: Debug mode enabled in development environment
- FR-005: CSP headers updated for Google domains
- FR-006: Works with all 32 themes
- FR-007: No impact on Lighthouse scores
- FR-008: Privacy mode when consent denied (no tracking at all)

### Non-Functional

- NFR-001: Script loads async/afterInteractive
- NFR-002: Graceful degradation when ad blockers present
- NFR-003: No errors thrown when GA blocked

### Key Components

- **GoogleAnalytics**: Component that conditionally loads GA4
- **analytics.ts**: Utility functions for tracking
- **useAnalytics**: Hook with pre-built tracking methods

### Configuration

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### CSP Headers Required

```
script-src: https://www.googletagmanager.com https://www.google-analytics.com
connect-src: https://www.google-analytics.com https://analytics.google.com
```

### Out of Scope

- Google Ads integration
- Enhanced ecommerce tracking
- Server-side tracking
- Google Tag Manager
- Universal Analytics (deprecated)

## Success Criteria

- SC-001: GA4 never loads without consent
- SC-002: Web Vitals visible in GA4 DebugView
- SC-003: Custom events appear in real-time reports
- SC-004: Page views tracked for all navigation
- SC-005: No Lighthouse score regression
- SC-006: Works with ad blockers (graceful degradation)
