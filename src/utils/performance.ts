import { onCLS, onFCP, onLCP, onTTFB, onINP, Metric } from 'web-vitals';
import { createLogger } from '@/lib/logger';

const logger = createLogger('utils:performance');

export interface PerformanceMetrics {
  CLS?: number;
  FCP?: number;
  LCP?: number;
  TTFB?: number;
  INP?: number;
  timestamp: number;
}

const metricsStorage: PerformanceMetrics = {
  timestamp: Date.now(),
};

function sendToAnalytics(metric: Metric) {
  // In production, you might send this to an analytics service
  if (process.env.NODE_ENV === 'production') {
    // Example: send to Google Analytics
    if (typeof window !== 'undefined' && 'gtag' in window) {
      const gtag = (window as unknown as Record<string, unknown>).gtag as (
        ...args: unknown[]
      ) => void;
      gtag('event', metric.name, {
        value: Math.round(
          metric.name === 'CLS' ? metric.value * 1000 : metric.value
        ),
        event_category: 'Web Vitals',
        event_label: metric.id,
        non_interaction: true,
      });
    }
  }

  // Store in memory for dashboard display
  metricsStorage[metric.name as keyof PerformanceMetrics] = metric.value;

  // Also store in localStorage for persistence
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('webVitals');
    const existing = stored ? JSON.parse(stored) : {};
    existing[metric.name] = {
      value: metric.value,
      timestamp: Date.now(),
      rating: metric.rating,
    };
    localStorage.setItem('webVitals', JSON.stringify(existing));
  }

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Web Vitals metric', {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
    });
  }
}

export function initWebVitals() {
  if (typeof window === 'undefined') return;

  // Core Web Vitals
  onCLS(sendToAnalytics);
  onFCP(sendToAnalytics);
  onLCP(sendToAnalytics);

  // Additional metrics
  onTTFB(sendToAnalytics);
  onINP(sendToAnalytics);
}

export function getStoredMetrics(): PerformanceMetrics | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem('webVitals');
  if (!stored) return null;

  try {
    const metrics = JSON.parse(stored);
    return {
      CLS: metrics.CLS?.value,
      FCP: metrics.FCP?.value,
      LCP: metrics.LCP?.value,
      TTFB: metrics.TTFB?.value,
      INP: metrics.INP?.value,
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

export function clearMetrics() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('webVitals');
  }
}

// Performance monitoring utilities
export function measurePerformance<T>(
  name: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const startTime = performance.now();

  const result = fn();

  if (result instanceof Promise) {
    return result.finally(() => {
      const duration = performance.now() - startTime;
      logger.debug('Performance measurement', {
        operation: name,
        durationMs: duration.toFixed(2),
      });
    });
  }

  const duration = performance.now() - startTime;
  logger.debug('Performance measurement', {
    operation: name,
    durationMs: duration.toFixed(2),
  });
  return result;
}

// Resource timing analysis
export function analyzeResourceTiming() {
  if (typeof window === 'undefined' || !window.performance) return null;

  const resources = performance.getEntriesByType('resource');

  const analysis = {
    totalResources: resources.length,
    totalSize: 0,
    slowestResources: [] as Array<{ name: string; duration: number }>,
    byType: {} as Record<string, { count: number; totalDuration: number }>,
  };

  resources.forEach((resource) => {
    const perfResource = resource as PerformanceResourceTiming;
    const duration = perfResource.responseEnd - perfResource.startTime;

    // Track slowest resources
    if (duration > 100) {
      analysis.slowestResources.push({
        name: perfResource.name.split('/').pop() || perfResource.name,
        duration: Math.round(duration),
      });
    }

    // Group by type
    const type = perfResource.initiatorType || 'other';
    if (!analysis.byType[type]) {
      analysis.byType[type] = { count: 0, totalDuration: 0 };
    }
    analysis.byType[type].count++;
    analysis.byType[type].totalDuration += duration;
  });

  // Sort slowest resources
  analysis.slowestResources.sort((a, b) => b.duration - a.duration);
  analysis.slowestResources = analysis.slowestResources.slice(0, 5);

  return analysis;
}

// Navigation timing
export function getNavigationTiming() {
  if (typeof window === 'undefined' || !window.performance) return null;

  const navigation = performance.getEntriesByType(
    'navigation'
  )[0] as PerformanceNavigationTiming;
  if (!navigation) return null;

  return {
    domContentLoaded: Math.round(
      navigation.domContentLoadedEventEnd -
        navigation.domContentLoadedEventStart
    ),
    loadComplete: Math.round(
      navigation.loadEventEnd - navigation.loadEventStart
    ),
    domInteractive: Math.round(
      navigation.domInteractive - navigation.fetchStart
    ),
    dnsLookup: Math.round(
      navigation.domainLookupEnd - navigation.domainLookupStart
    ),
    tcpConnection: Math.round(navigation.connectEnd - navigation.connectStart),
    request: Math.round(navigation.responseStart - navigation.requestStart),
    response: Math.round(navigation.responseEnd - navigation.responseStart),
    domProcessing: Math.round(
      navigation.domComplete - navigation.domInteractive
    ),
  };
}
