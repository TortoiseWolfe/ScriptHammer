'use client';

import { useState } from 'react';
import { getAssetUrl } from '@/config/project.config';

export default function WireframesPage() {
  const [loading, setLoading] = useState(true);
  const iframeSrc = getAssetUrl('/wireframes/viewer.html');

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full">
      {loading && (
        <div className="bg-base-200 absolute inset-0 z-10 flex items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}
      <iframe
        src={iframeSrc}
        title="Wireframe Viewer"
        className="h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
