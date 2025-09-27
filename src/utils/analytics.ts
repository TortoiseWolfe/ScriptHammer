/**
 * Google Analytics 4 Utilities
 * Privacy-conscious analytics implementation with consent management
 */

import type { GA4ConsentState, GtagFunction } from '@/types/analytics.types';
import analyticsDebugger from './analytics-debug';

/**
 * Extended window type for analytics
 */
type WindowWithAnalytics = typeof globalThis & {
  dataLayer?: unknown[];
  gtag?: GtagFunction;
};

/**
 * GA4 Measurement ID from environment
 */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Initialize Google Analytics with consent mode
 * Sets default consent to denied until explicitly granted
 */
export function initializeGA(): void {
  // Skip on server side
  if (typeof window === 'undefined') {
    return;
  }

  // Skip if no measurement ID
  if (!GA_MEASUREMENT_ID) {
    return;
  }

  // Skip if already initialized
  if ('gtag' in window) {
    return;
  }

  // Initialize dataLayer and gtag function
  const win = window as WindowWithAnalytics;
  win.dataLayer = win.dataLayer || [];
  win.gtag = function gtag(...args: unknown[]) {
    win.dataLayer!.push(args);
  } as GtagFunction;

  // Set initial timestamp
  win.gtag!('js', new Date());

  // Set default consent to denied (privacy-first approach)
  win.gtag!('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
  } as GA4ConsentState);

  // Configure GA4 with measurement ID
  win.gtag!('config', GA_MEASUREMENT_ID, {
    send_page_view: false, // We'll send page views manually
    debug_mode: process.env.NODE_ENV === 'development',
    // Additional privacy settings
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
}

/**
 * Update GA4 consent state
 * @param granted - Whether analytics consent is granted
 */
export function updateGAConsent(granted: boolean): void {
  if (typeof window === 'undefined' || !window.gtag) {
    return;
  }

  window.gtag('consent', 'update', {
    analytics_storage: granted ? 'granted' : 'denied',
  } as GA4ConsentState);
}

/**
 * Track a custom event
 * @param action - Event action
 * @param category - Event category
 * @param label - Optional event label
 * @param value - Optional numeric value
 * @param customParameters - Optional custom parameters
 */
export function trackEvent(
  action: string,
  category: string,
  label?: string,
  value?: number,
  customParameters?: Record<string, unknown>
): void {
  if (typeof window === 'undefined' || !window.gtag) {
    return;
  }

  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
    ...customParameters,
  });

  // Log to debugger
  analyticsDebugger.logEvent(action, category, label, value, customParameters);
}

/**
 * Track a page view
 * @param path - Page path
 * @param title - Optional page title
 * @param location - Optional full URL
 */
export function trackPageView(
  path: string,
  title?: string,
  location?: string
): void {
  if (typeof window === 'undefined' || !window.gtag) {
    return;
  }

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title,
    page_location: location,
  });
}

/**
 * Check if analytics is enabled and ready
 * @returns Whether analytics is enabled
 */
export function isAnalyticsEnabled(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    'gtag' in window &&
    GA_MEASUREMENT_ID
  );
}

/**
 * Track Web Vitals metric
 * @param metric - Web Vitals metric data
 */
export function trackWebVital(metric: {
  name: string;
  value: number;
  rating: string;
  delta?: number;
  id?: string;
  navigationType?: string;
}): void {
  if (!isAnalyticsEnabled()) {
    return;
  }

  // Send as custom event with Web Vitals category
  trackEvent('web_vitals', 'Web Vitals', metric.name, Math.round(metric.value));

  // Also send as specific metric event for better GA4 reporting
  window.gtag('event', metric.name, {
    value: metric.value,
    metric_id: metric.id,
    metric_value: metric.value,
    metric_delta: metric.delta,
    metric_rating: metric.rating,
    navigation_type: metric.navigationType,
    engagement_time_msec: 100, // Required for GA4 engagement
  });
}

/**
 * Track an error/exception
 * @param description - Error description
 * @param fatal - Whether the error is fatal
 */
export function trackError(description: string, fatal: boolean = false): void {
  if (!isAnalyticsEnabled()) {
    return;
  }

  window.gtag('event', 'exception', {
    description: description,
    fatal: fatal,
  });
}
