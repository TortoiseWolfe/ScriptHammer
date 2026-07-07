/**
 * Web Vitals reporters — thin re-exports of the `web-vitals` npm package.
 *
 * History: this file used to hand-roll PerformanceObserver-based reporters
 * (~280 LOC) because the `web-vitals` dep wasn't pulled in until ^5.1.0.
 * The hand-rolled implementations had subtle correctness gaps versus the
 * official package (e.g. CLS session detection, INP entry buffering, LCP
 * report-on-bfcache). The dep is now in package.json and the official
 * package is the right source of truth — keeping a parallel implementation
 * would only drift over time.
 *
 * Public API is unchanged: callers (notably src/app/status/page.tsx) import
 * the same {onFCP, onLCP, onCLS, onTTFB, onINP, Metric} symbols they always
 * did. The Metric shape is identical to web-vitals' own.
 */

import {
  onCLS as _onCLS,
  onFCP as _onFCP,
  onINP as _onINP,
  onLCP as _onLCP,
  onTTFB as _onTTFB,
  type Metric as _Metric,
} from 'web-vitals';

export type Metric = _Metric;
export type ReportCallback = (metric: Metric) => void;

export const onCLS: typeof _onCLS = _onCLS;
export const onFCP: typeof _onFCP = _onFCP;
export const onINP: typeof _onINP = _onINP;
export const onLCP: typeof _onLCP = _onLCP;
export const onTTFB: typeof _onTTFB = _onTTFB;

/**
 * Subscribe to all five Core/Loading Web Vitals metrics and dispatch each
 * report through the supplied callback. Convenience wrapper for callers
 * that don't care about per-metric subscription granularity.
 *
 * Note: FID is intentionally omitted — Chromium replaced it with INP in
 * 2024 and the `web-vitals` package no longer ships an `onFID` export.
 */
export function reportWebVitals(callback: ReportCallback): void {
  onFCP(callback);
  onLCP(callback);
  onCLS(callback);
  onTTFB(callback);
  onINP(callback);
}

/**
 * Bridge a Metric report through to analytics.ts trackWebVital() if
 * analytics is enabled. Imported dynamically to avoid coupling this
 * utility module to the analytics gtag bootstrap path.
 */
export function sendToAnalytics(metric: Metric): void {
  void import('./analytics').then(({ trackWebVital, isAnalyticsEnabled }) => {
    if (isAnalyticsEnabled()) {
      trackWebVital({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
      });
    }
  });
}
