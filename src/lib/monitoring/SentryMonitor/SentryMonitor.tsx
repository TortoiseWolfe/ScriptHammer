'use client';

import { useEffect } from 'react';
import { useConsent } from '@/contexts/ConsentContext';
import { SENTRY_DSN, initSentry, closeSentry } from '@/lib/monitoring/sentry';

/**
 * SentryMonitor
 *
 * Consent-gated, client-only initializer for Sentry error monitoring. Mirrors
 * the GoogleAnalytics pattern: initializes Sentry only after analytics consent
 * is granted, and shuts it down if consent is withdrawn. Renders nothing.
 *
 * No-ops entirely when `NEXT_PUBLIC_SENTRY_DSN` is unset, so the integration
 * ships inert until a DSN is configured.
 *
 * @category atomic
 */
export default function SentryMonitor() {
  const { consent } = useConsent();

  useEffect(() => {
    if (!SENTRY_DSN) return;

    if (consent.analytics) {
      initSentry();
    } else {
      void closeSentry();
    }
  }, [consent.analytics]);

  return null;
}
