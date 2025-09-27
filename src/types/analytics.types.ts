/**
 * Google Analytics 4 TypeScript Type Definitions
 */

/**
 * Google Analytics gtag function type
 */
export type GtagFunction = (
  command: 'config' | 'event' | 'js' | 'set' | 'consent',
  ...args: unknown[]
) => void;

/**
 * Event categories for analytics tracking
 */
export enum EventCategory {
  UI = 'UI',
  FORMS = 'Forms',
  NAVIGATION = 'Navigation',
  PWA = 'PWA',
  PERFORMANCE = 'Performance',
  ERRORS = 'Errors',
  CONSENT = 'Consent',
}

/**
 * Common event actions
 */
export enum EventAction {
  CLICK = 'click',
  VIEW = 'view',
  SUBMIT = 'submit',
  CHANGE = 'change',
  ERROR = 'error',
  INSTALL = 'install',
  DISMISS = 'dismiss',
  ACCEPT = 'accept',
  REJECT = 'reject',
}

/**
 * Base analytics event structure
 */
export interface AnalyticsEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
  custom_parameters?: Record<string, unknown>;
}

/**
 * Web Vital metric event
 */
export interface WebVitalEvent extends AnalyticsEvent {
  metric_name: 'FCP' | 'LCP' | 'CLS' | 'FID' | 'TTFB' | 'INP';
  metric_value: number;
  metric_rating: 'good' | 'needs-improvement' | 'poor';
  metric_delta?: number;
  metric_id?: string;
  navigation_type?: string;
}

/**
 * Page view event
 */
export interface PageViewEvent {
  page_path: string;
  page_title?: string;
  page_location?: string;
  page_referrer?: string;
}

/**
 * Theme change event
 */
export interface ThemeChangeEvent extends AnalyticsEvent {
  action: 'theme_change';
  category: EventCategory.UI;
  label: string; // Theme name
  previous_theme?: string;
}

/**
 * Form submission event
 */
export interface FormSubmitEvent extends AnalyticsEvent {
  action: 'form_submit';
  category: EventCategory.FORMS;
  label: string; // Form name/ID
  form_fields?: number;
  success?: boolean;
}

/**
 * PWA install event
 */
export interface PWAInstallEvent extends AnalyticsEvent {
  action: 'pwa_install';
  category: EventCategory.PWA;
  label: 'accepted' | 'dismissed' | 'deferred';
  platform?: string;
}

/**
 * Error tracking event
 */
export interface ErrorEvent extends AnalyticsEvent {
  action: 'exception';
  category: EventCategory.ERRORS;
  label: string; // Error message
  fatal?: boolean;
  stack_trace?: string; // Dev only
}

/**
 * GA4 configuration options
 */
export interface GA4Config {
  measurementId: string;
  sendPageView?: boolean;
  debugMode?: boolean;
  anonymizeIp?: boolean;
  cookieFlags?: string;
  cookieDomain?: string;
  cookieExpires?: number;
}

/**
 * Consent state for GA4
 */
export interface GA4ConsentState {
  analytics_storage: 'granted' | 'denied';
  ad_storage?: 'granted' | 'denied';
  functionality_storage?: 'granted' | 'denied';
  personalization_storage?: 'granted' | 'denied';
  security_storage?: 'granted';
}

/**
 * Analytics hook return type
 */
export interface UseAnalyticsReturn {
  trackEvent: (
    action: string,
    category: string,
    label?: string,
    value?: number
  ) => void;
  trackThemeChange: (theme: string, previousTheme?: string) => void;
  trackFormSubmit: (formName: string, success?: boolean) => void;
  trackPWAInstall: (
    result: 'accepted' | 'dismissed' | 'deferred',
    platform?: string
  ) => void;
  trackPWAEvent: (action: string, label?: string, value?: number) => void;
  trackError: (error: string, fatal?: boolean) => void;
  trackSearch: (query: string) => void;
  trackClick: (element: string, section: string) => void;
}

/**
 * Global window extension for gtag
 */
declare global {
  interface Window {
    gtag: GtagFunction;
    dataLayer: unknown[];
  }
}
