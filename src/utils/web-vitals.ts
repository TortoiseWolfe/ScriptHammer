// Web Vitals monitoring utilities
// Lightweight implementation without external dependencies

import { createLogger } from '@/lib/logger';

const logger = createLogger('utils:web-vitals');

export interface Metric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  id?: string;
  navigationType?: string;
}

// Thresholds based on Web Vitals standards
const thresholds = {
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
};

// Get rating based on value and thresholds
function getRating(
  metricName: string,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const threshold = thresholds[metricName as keyof typeof thresholds];
  if (!threshold) return 'good';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

// Callback type for metric reporting
export type ReportCallback = (metric: Metric) => void;

// Report First Contentful Paint
export function onFCP(callback: ReportCallback): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          const value = Math.round(entry.startTime);
          callback({
            name: 'FCP',
            value,
            rating: getRating('FCP', value),
            navigationType: (
              performance.getEntriesByType(
                'navigation'
              )[0] as PerformanceNavigationTiming
            )?.type,
          });
          observer.disconnect();
        }
      }
    });
    observer.observe({ entryTypes: ['paint'] });
  } catch (e) {
    logger.error('FCP observer failed', { error: e });
  }
}

// Report Largest Contentful Paint
export function onLCP(callback: ReportCallback): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    let lastEntry: PerformanceEntry | undefined;
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      lastEntry = entries[entries.length - 1];
    });

    observer.observe({ entryTypes: ['largest-contentful-paint'] });

    // Report when page is hidden or unloaded
    const reportLCP = () => {
      if (lastEntry) {
        const value = Math.round(lastEntry.startTime);
        callback({
          name: 'LCP',
          value,
          rating: getRating('LCP', value),
        });
        observer.disconnect();
      }
    };

    // Report on page hide or immediately if page is already hidden
    if (document.visibilityState === 'hidden') {
      reportLCP();
    } else {
      addEventListener(
        'visibilitychange',
        () => {
          if (document.visibilityState === 'hidden') {
            reportLCP();
          }
        },
        { once: true }
      );

      // Also report on page unload
      addEventListener('beforeunload', reportLCP, { once: true });
    }
  } catch (e) {
    logger.error('LCP observer failed', { error: e });
  }
}

// Report First Input Delay
export function onFID(callback: ReportCallback): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'first-input') {
          const firstInputEntry = entry as PerformanceEntry & {
            processingStart?: number;
          };
          const value = Math.round(
            (firstInputEntry.processingStart || 0) - entry.startTime
          );
          callback({
            name: 'FID',
            value,
            rating: getRating('FID', value),
            navigationType: entry.name,
          });
          observer.disconnect();
        }
      }
    });
    observer.observe({ entryTypes: ['first-input'] });
  } catch (e) {
    logger.error('FID observer failed', { error: e });
  }
}

// Report Cumulative Layout Shift
export function onCLS(callback: ReportCallback): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    let clsValue = 0;
    let sessionValue = 0;
    let sessionEntries: PerformanceEntry[] = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Only count layout shifts without recent user input
        const layoutShiftEntry = entry as PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        };
        if (!layoutShiftEntry.hadRecentInput && layoutShiftEntry.value) {
          const firstSessionEntry = sessionEntries[0];
          const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

          // If the entry is more than 1 second after the previous entry and
          // more than 5 seconds after the first entry, start a new session
          if (
            sessionValue &&
            entry.startTime - lastSessionEntry.startTime > 1000 &&
            entry.startTime - firstSessionEntry.startTime > 5000
          ) {
            sessionValue = 0;
            sessionEntries = [];
          }

          sessionEntries.push(entry);
          sessionValue += layoutShiftEntry.value;

          // Keep the maximum session value
          if (sessionValue > clsValue) {
            clsValue = sessionValue;
          }
        }
      }
    });

    observer.observe({ entryTypes: ['layout-shift'] });

    // Report when page is hidden
    const reportCLS = () => {
      const value = Math.round(clsValue * 1000) / 1000;
      callback({
        name: 'CLS',
        value,
        rating: getRating('CLS', value),
      });
      observer.disconnect();
    };

    if (document.visibilityState === 'hidden') {
      reportCLS();
    } else {
      addEventListener(
        'visibilitychange',
        () => {
          if (document.visibilityState === 'hidden') {
            reportCLS();
          }
        },
        { once: true }
      );

      addEventListener('beforeunload', reportCLS, { once: true });
    }
  } catch (e) {
    logger.error('CLS observer failed', { error: e });
  }
}

// Report Time to First Byte
export function onTTFB(callback: ReportCallback): void {
  if (!('performance' in window)) return;

  try {
    // Wait for the load event to ensure navigation timing is available
    const reportTTFB = () => {
      const navTiming = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      if (navTiming && navTiming.responseStart > 0) {
        const value = Math.round(
          navTiming.responseStart - navTiming.requestStart
        );
        callback({
          name: 'TTFB',
          value,
          rating: getRating('TTFB', value),
          navigationType: navTiming.type,
        });
      }
    };

    if (document.readyState === 'complete') {
      reportTTFB();
    } else {
      addEventListener('load', reportTTFB, { once: true });
    }
  } catch (e) {
    logger.error('TTFB measurement failed', { error: e });
  }
}

// Report Interaction to Next Paint (INP)
export function onINP(callback: ReportCallback): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    let maxDuration = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if ('duration' in entry) {
          maxDuration = Math.max(maxDuration, entry.duration);
        }
      }
    });

    observer.observe({ entryTypes: ['event'] });

    // Report when page is hidden
    const reportINP = () => {
      if (maxDuration > 0) {
        const value = Math.round(maxDuration);
        callback({
          name: 'INP',
          value,
          rating: getRating('INP', value),
        });
        observer.disconnect();
      }
    };

    if (document.visibilityState === 'hidden') {
      reportINP();
    } else {
      addEventListener(
        'visibilitychange',
        () => {
          if (document.visibilityState === 'hidden') {
            reportINP();
          }
        },
        { once: true }
      );

      addEventListener('beforeunload', reportINP, { once: true });
    }
  } catch (e) {
    logger.error('INP observer failed', { error: e });
  }
}

// Convenience function to track all web vitals
export function reportWebVitals(callback: ReportCallback): void {
  onFCP(callback);
  onLCP(callback);
  onFID(callback);
  onCLS(callback);
  onTTFB(callback);
  onINP(callback);
}

// Helper to send metrics to analytics
export function sendToAnalytics(metric: Metric): void {
  // Import our analytics utilities dynamically to avoid circular dependencies
  import('./analytics')
    .then(({ trackWebVital, isAnalyticsEnabled }) => {
      // Use our centralized analytics tracking
      if (isAnalyticsEnabled()) {
        trackWebVital(metric);
      }
    })
    .catch((error) => {
      logger.error('Failed to load analytics module', { error });
    });

  // Or send to custom endpoint
  const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
  if (endpoint) {
    fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(metric),
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {
      // Silently fail analytics
    });
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Web Vitals metric', {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
    });
  }
}
