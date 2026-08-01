'use client';

import React from 'react';
import { useConsent } from '../../../contexts/ConsentContext';
import Icon from '../../atomic/Icon';

export interface CookieConsentProps {
  position?: 'top' | 'bottom';
  className?: string;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  onCustomize?: () => void;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
  customContent?: React.ReactNode;
}

/**
 * Cookie Consent Banner Component
 * Displays a GDPR-compliant cookie consent banner
 */
export function CookieConsent({
  position = 'bottom',
  className = '',
  onAcceptAll,
  onRejectAll,
  onCustomize,
  privacyPolicyUrl,
  // cookiePolicyUrl is reserved for future use - omitting from destructuring
  customContent,
}: CookieConsentProps) {
  const { showBanner, isLoading, acceptAll, rejectAll, openModal } =
    useConsent();

  // Keep the spacer the same height as the banner. `56` is only the
  // server-rendered starting value — the effect replaces it as soon as the
  // banner has a measured height, and a ResizeObserver keeps it correct when
  // the message rewraps on rotation or a font-scale change.
  const bannerRef = React.useRef<HTMLDivElement>(null);
  const [spacerHeight, setSpacerHeight] = React.useState(56);

  React.useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;
    const sync = () => setSpacerHeight(el.getBoundingClientRect().height);
    sync();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
    // `showBanner` is the gate on whether the banner is in the DOM at all, so
    // the observer has to be re-attached when it flips.
  }, [showBanner, isLoading]);

  // Don't render if banner shouldn't be shown or still loading
  if (!showBanner || isLoading) {
    return null;
  }

  const handleAcceptAll = () => {
    acceptAll();
    onAcceptAll?.();
  };

  // handleRejectAll is defined but not currently used in the UI
  // Keeping it for potential future use
  const _handleRejectAll = () => {
    rejectAll();
    onRejectAll?.();
  };
  // Suppress unused variable warning
  void _handleRejectAll;

  const handleCustomize = () => {
    openModal();
    onCustomize?.();
  };

  const positionClasses = position === 'top' ? 'top-0' : 'bottom-0';

  return (
    <>
      {/* The spacer must be as tall as the banner, so it MEASURES it (#457).
          It was a fixed `h-14` (56px) while the banner rendered 117px at
          320px, 119px at 390px and 120px at 428px — so roughly 61px of page
          content sat underneath the banner already, and raising the buttons to
          the 44px touch floor above would have widened that gap rather than
          created it. A fixed height cannot be right for a fixed-position
          element whose height depends on how the message wraps. */}
      <div style={{ height: spacerHeight }} aria-hidden="true" />
      <div
        ref={bannerRef}
        role="region"
        aria-label="Cookie consent banner"
        aria-live="polite"
        className={`fixed right-0 left-0 ${positionClasses} bg-base-100 border-base-300 z-[60] border-t-2 shadow-lg backdrop-blur-md ${className}`}
      >
        <div className="container mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {/* Message Section - Compact */}
            {/* `min-w-0` is load-bearing. A flex item will not shrink below its
                MIN-CONTENT width without it, so at 320px this block held its
                ground and pushed the actions group 11px past the viewport —
                measured on live production on 41 of 42 routes, in the
                first-time-visitor state that every touch-target spec dismisses
                before it measures anything (#457). */}
            <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto">
              {/* Decorative (#385): the sentence beside it already says
                  "We use cookies". The emoji carried aria-label="Cookie", so
                  a screen reader announced "Cookie, We use cookies to enhance
                  your experience" — the name repeated the copy. */}
              <span className="text-lg">
                <Icon name="cookie" decorative />
              </span>
              {customContent || (
                <p className="text-sm sm:text-base">
                  We use cookies to enhance your experience.
                  {privacyPolicyUrl && (
                    <>
                      {' '}
                      <a
                        href={privacyPolicyUrl}
                        className="link link-primary text-xs"
                        aria-label="Privacy Policy"
                      >
                        Learn more
                      </a>
                    </>
                  )}
                </p>
              )}
            </div>

            {/* Actions Section - Compact */}
            <div
              className="flex shrink-0 gap-2"
              role="group"
              aria-label="Consent actions"
            >
              {/* `min-h-11` is the 44px touch floor (#457). `btn-sm` is 2rem =
                  32px, so these two rendered 32x87 and 32x77 at 320/390/428 —
                  and they are the FIRST control a mobile visitor is asked to
                  hit. No gate caught it because every test in
                  mobile-touch-targets.spec.ts calls dismissCookieBanner()
                  before it measures, which is correct for the page underneath
                  and makes this banner the one surface the suite structurally
                  cannot see. There is now a spec that measures with the banner
                  present; see mobile-touch-targets.spec.ts. */}
              <button
                onClick={handleAcceptAll}
                className="btn btn-primary btn-sm min-h-11"
                aria-label="Accept all cookies"
              >
                Accept All
              </button>
              <button
                onClick={handleCustomize}
                className="btn btn-ghost btn-sm min-h-11"
                aria-label="Customize cookie preferences"
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
