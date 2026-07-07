/**
 * Analytics Hook
 * Provides consent-aware analytics tracking functions
 */

import { useCallback } from 'react';
import { useConsent } from '@/contexts/ConsentContext';
import {
  trackEvent as trackAnalyticsEvent,
  trackError as trackAnalyticsError,
} from '@/utils/analytics';
import type { UseAnalyticsReturn } from '@/types/analytics.types';

/**
 * Custom hook for analytics tracking
 * All tracking functions respect user consent
 */
export function useAnalytics(): UseAnalyticsReturn {
  const { consent } = useConsent();

  /**
   * Track a custom event (consent-aware)
   */
  const trackEvent = useCallback(
    (action: string, category: string, label?: string, value?: number) => {
      if (!consent.analytics) return;
      trackAnalyticsEvent(action, category, label, value);
    },
    [consent.analytics]
  );

  /**
   * Track theme change
   */
  const trackThemeChange = useCallback(
    (theme: string, previousTheme?: string) => {
      if (!consent.analytics) return;
      trackAnalyticsEvent('theme_change', 'UI', theme, undefined, {
        previous_theme: previousTheme,
      });
    },
    [consent.analytics]
  );

  /**
   * Track form submission
   */
  const trackFormSubmit = useCallback(
    (formName: string, success?: boolean) => {
      if (!consent.analytics) return;
      trackAnalyticsEvent('form_submit', 'Forms', formName, undefined, {
        success,
      });
    },
    [consent.analytics]
  );

  /**
   * Track PWA install prompt result
   */
  const trackPWAInstall = useCallback(
    (result: 'accepted' | 'dismissed' | 'deferred', platform?: string) => {
      if (!consent.analytics) return;
      trackAnalyticsEvent('pwa_install', 'PWA', result, undefined, {
        platform,
      });
    },
    [consent.analytics]
  );

  /**
   * Track PWA-related events
   */
  const trackPWAEvent = useCallback(
    (action: string, label?: string, value?: number) => {
      if (!consent.analytics) return;
      trackAnalyticsEvent(action, 'PWA', label, value);
    },
    [consent.analytics]
  );

  /**
   * Track an error/exception
   */
  const trackError = useCallback(
    (error: string, fatal: boolean = false) => {
      if (!consent.analytics) return;
      trackAnalyticsError(error, fatal);
    },
    [consent.analytics]
  );

  /**
   * Track a search query
   */
  const trackSearch = useCallback(
    (query: string) => {
      if (!consent.analytics) return;
      trackAnalyticsEvent('search', 'Site Search', query);
    },
    [consent.analytics]
  );

  /**
   * Track a click event
   */
  const trackClick = useCallback(
    (element: string, section: string) => {
      if (!consent.analytics) return;
      trackAnalyticsEvent('click', section, element);
    },
    [consent.analytics]
  );

  return {
    trackEvent,
    trackThemeChange,
    trackFormSubmit,
    trackPWAInstall,
    trackPWAEvent,
    trackError,
    trackSearch,
    trackClick,
  };
}
