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
    <div className="relative h-[calc(100vh-4rem)] w-full">
      {loading && (
        <div className="bg-base-200 absolute inset-0 z-10 flex items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        title="Wireframe Viewer"
        className="h-full w-full border-0"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
