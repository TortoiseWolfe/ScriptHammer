'use client';

import React, { useEffect, useRef } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useConsent } from '@/contexts/ConsentContext';
import {
  GA_MEASUREMENT_ID,
  initializeGA,
  updateGAConsent,
  trackPageView,
} from '@/utils/analytics';
import { initWebVitals } from '@/utils/performance';

/**
 * GoogleAnalytics component
 * Loads Google Analytics 4 with consent awareness
 * Only tracks when analytics consent is granted
 *
 * @category atomic
 */
export default function GoogleAnalytics() {
  const { consent } = useConsent();
  const pathname = usePathname();
  // initWebVitals subscribes PerformanceObserver listeners that don't
  // unsubscribe on consent flip — guard against double-subscribe so a
  // user who toggles consent off-then-on doesn't end up reporting each
  // metric twice. The web-vitals dispatch is consent-gated downstream
  // (sendToAnalytics → isAnalyticsEnabled), so leaving the subscription
  // in place across a flip-off is safe; only the consent-on transition
  // ever needs to call initWebVitals.
  const webVitalsInitializedRef = useRef(false);

  // Initialize GA and update consent when consent changes
  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;

    if (consent.analytics) {
      initializeGA();
      updateGAConsent(true);
      // Subscribe to LCP/FCP/CLS/TTFB/INP exactly once per page load.
      // initWebVitals is idempotent at the function level only via this
      // ref guard — the underlying web-vitals callbacks unsubscribe
      // themselves on first report (LCP, FCP) or on visibilitychange
      // (CLS, INP), so a single subscribe is sufficient.
      if (!webVitalsInitializedRef.current) {
        initWebVitals();
        webVitalsInitializedRef.current = true;
      }
    } else {
      updateGAConsent(false);
    }
  }, [consent.analytics]);

  // Track page views when pathname changes
  useEffect(() => {
    if (!GA_MEASUREMENT_ID || !consent.analytics || !pathname) return;

    trackPageView(pathname);
  }, [pathname, consent.analytics]);

  // Don't render if no measurement ID or consent denied
  if (!GA_MEASUREMENT_ID || !consent.analytics) {
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

          gtag('consent', 'default', {
            'analytics_storage': '${consent.analytics ? 'granted' : 'denied'}',
            'ad_storage': 'denied'
          });

          gtag('config', '${GA_MEASUREMENT_ID}', {
            send_page_view: false,
            anonymize_ip: true,
            allow_google_signals: false,
            allow_ad_personalization_signals: false
          });
        `}
      </Script>
    </>
  );
}
