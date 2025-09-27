'use client';

import React, { useEffect } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useConsent } from '@/contexts/ConsentContext';
import {
  GA_MEASUREMENT_ID,
  initializeGA,
  updateGAConsent,
  trackPageView,
} from '@/utils/analytics';

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

  // Initialize GA and update consent when consent changes
  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;

    if (consent.analytics) {
      initializeGA();
      updateGAConsent(true);
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
