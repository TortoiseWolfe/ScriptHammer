'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useConsent } from '@/contexts/ConsentContext';
import { SENTRY_DSN, initSentry, closeSentry } from '@/lib/monitoring/sentry';
import { isKidSafeRoute } from '@/lib/privacy/kid-safe-routes';

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
  // Kid-safe routes (COPPA) send nothing to Sentry, even if it was started on
  // an earlier page: leaving for one closes the client, leaving it re-inits.
  const kidSafe = isKidSafeRoute(usePathname());

  useEffect(() => {
    if (!SENTRY_DSN) return;

    if (consent.analytics && !kidSafe) {
      initSentry();
    } else {
      void closeSentry();
    }
  }, [consent.analytics, kidSafe]);

  return null;
}
