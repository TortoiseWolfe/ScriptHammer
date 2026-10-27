'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { isKidSafeRoute } from '@/lib/privacy/kid-safe-routes';
import { isSentryEnabled } from '@/lib/monitoring/sentry';

/** Scripts a tracker leaves in the document once it has loaded. */
const TRACKER_SCRIPTS =
  'script[src*="googletagmanager.com"], script[src*="google-analytics.com"], script[src*="bzrcdn.openai.com"]';

/** True when a tracker has already loaded in this document. */
function trackerIsLoaded(): boolean {
  return (
    document.querySelector(TRACKER_SCRIPTS) !== null ||
    typeof (window as unknown as { oaiq?: unknown }).oaiq !== 'undefined' ||
    isSentryEnabled()
  );
}

/**
 * KidSafeRouteGuard
 *
 * Gives a kid-safe route (COPPA, see kid-safe-routes.ts) a document that never held a tracker.
 *
 * Each tracker component already switches itself off on a kid-safe route, but a third-party SDK
 * that finished loading on an earlier page cannot be reliably shut off in place: it keeps its own
 * listeners and queued beacons. So when a client-side navigation arrives at a kid-safe route from
 * an ordinary one AND a tracker is present, this reloads the page. The new document starts on the
 * kid-safe route, where nothing loads. A visitor who never consented has no tracker, so nothing
 * reloads for them.
 *
 * @category atomic
 */
export default function KidSafeRouteGuard() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const wasKidSafe =
      previous.current === null || isKidSafeRoute(previous.current);
    previous.current = pathname;
    if (wasKidSafe || !isKidSafeRoute(pathname)) return;
    if (trackerIsLoaded()) window.location.reload();
  }, [pathname]);

  return null;
}
