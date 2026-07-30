'use client';

import { useEffect, useRef, useState } from 'react';
import { getAssetUrl } from '@/config/project.config';

export default function WireframesPage() {
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeSrc = getAssetUrl('/wireframes/viewer.html');

  // Iframe's load event races with React hydration — if the iframe finishes
  // loading before React attaches onLoad, the spinner sticks forever.
  // After mount, check readyState directly to catch the already-loaded case.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (iframe.contentDocument?.readyState === 'complete') {
      setLoading(false);
    }
  }, []);

  return (
    // The route shipped with no `main` landmark and no h1 — this is the only
    // page in the app a screen-reader user could not orient on at all.
    //
    // A flex COLUMN, not a recomputed `calc()`. Adding a header above the
    // viewer eats into the old `h-[calc(100vh-4rem)]`, and subtracting the
    // header's height by hand is a number that drifts the moment the type
    // scale changes. `min-h-0 flex-1` lets the frame take exactly what is
    // left, so there is no second scrollbar and nothing to keep in sync.
    <main className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4">
        <p className="text-base-content mb-2 font-mono text-xs tracking-[.14em] uppercase">
          Design source
        </p>
        <h1 className="text-base-content font-display text-3xl tracking-[-0.025em] sm:text-4xl">
          Wireframes
        </h1>
        {/* Deliberately no count. `countWireframes()` is server-side (it reads
            `process.cwd()`), this page is `'use client'`, and a hardcoded
            number here would be the #422 failure. */}
      </div>

      {/* Padded WELL: `sh-well` is an inset shadow painted below child
          content, so the opaque iframe would hide it flush. The padding is
          what makes the cut visible. */}
      <div className="sh-well bg-base-100 rounded-box relative min-h-0 flex-1 p-3">
        {loading && (
          <div className="bg-base-200 absolute inset-3 z-10 flex items-center justify-center rounded-[14px]">
            <span className="loading loading-spinner loading-lg" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Wireframe Viewer"
          className="h-full w-full rounded-[14px] border-0"
          onLoad={() => setLoading(false)}
        />
      </div>
    </main>
  );
}
