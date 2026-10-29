import React from 'react';
import type { Metadata } from 'next';
import { getAssetUrl } from '@/config/project.config';

/**
 * /HouseBand and /houseband go to /band (#1416).
 *
 * GitHub Pages is case-sensitive, so /HouseBand returned a 404. Next's `redirects()`
 * config does not run under `output: 'export'`, and `redirect()` in a page only leaves a
 * script-driven hint in the page data, so each spelling is a small static page with a
 * plain meta refresh (works with no script, which a crawler or a locked-down browser may
 * have) and a visible link. `dynamicParams = false` keeps every other single-segment
 * address a 404 exactly as before; the real routes (/band, /blog ...) win over this one.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ houseband: 'HouseBand' }, { houseband: 'houseband' }];
}

export const metadata: Metadata = {
  title: 'ScriptHammer, the house band',
  robots: { index: false, follow: true },
};

export default function HouseBandRedirect() {
  const target = getAssetUrl('/band/');
  return (
    <div className="mx-auto max-w-2xl p-8 text-lg">
      <meta httpEquiv="refresh" content={`0; url=${target}`} />
      <p data-testid="houseband-redirect">
        The house band&apos;s page is at{' '}
        <a href={target} className="underline">
          /band
        </a>
        .
      </p>
    </div>
  );
}
