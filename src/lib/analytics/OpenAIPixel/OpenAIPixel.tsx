'use client';

import React, { useEffect } from 'react';
import Script from 'next/script';
import { useConsent } from '@/contexts/ConsentContext';
import { captureOppref, clearOppref } from '@/lib/analytics/ad-attribution';

/**
 * OpenAIPixel component
 *
 * Loads the OpenAI Ads measurement pixel, and only ever with MARKETING consent.
 *
 * WHY MARKETING AND NOT ANALYTICS. This reports to an advertising network so a campaign can
 * optimise on it — which is what the marketing category exists to describe. GoogleAnalytics next
 * door gates on `analytics` because it measures the site rather than feeding an ad platform, and
 * hard-disables `ad_storage` for exactly that reason.
 *
 * FR-026 — "consent before any third-party SDK" — is the requirement this satisfies. Note the
 * default consent state is DENIED (`consent-types.ts:272`) and the banner is dismissible, so a
 * real share of ad traffic will never load this. That undercount is the policy working.
 *
 * The click id itself is captured by our own code in `ad-attribution.ts`, not by waiting for this
 * script: the pixel only sees `oppref` once it has loaded, which is after consent, which may be
 * several navigations after the landing that carried the parameter.
 *
 * @category atomic
 */
export default function OpenAIPixel() {
  const { consent } = useConsent();
  const pixelId = process.env.NEXT_PUBLIC_OPENAI_PIXEL_ID;

  // Capture on every consent change, not only on mount: a visitor who lands on the ad URL and
  // accepts the banner a moment later must still be attributable. Withdrawing consent forgets
  // the value, so declining later is not merely "stop sending" but "stop holding".
  useEffect(() => {
    if (consent.marketing) {
      captureOppref(true);
    } else {
      clearOppref();
    }
  }, [consent.marketing]);

  if (!pixelId || !consent.marketing) {
    return null;
  }

  return (
    <Script id="openai-ads-pixel" strategy="afterInteractive">
      {`
        (function (w, d, s, u) {
          if (w.oaiq) return;
          var q = function () { q.q.push(arguments); };
          q.q = [];
          w.oaiq = q;
          var js = d.createElement(s);
          js.async = true;
          js.src = u;
          var f = d.getElementsByTagName(s)[0];
          f.parentNode.insertBefore(js, f);
        })(window, document, 'script', 'https://bzrcdn.openai.com/sdk/oaiq.min.js');

        oaiq('init', { pixelId: ${JSON.stringify(pixelId)} });
      `}
    </Script>
  );
}
