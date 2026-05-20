import React from 'react';

export interface LoaderProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loader component
 *
 * Feature 047 — Three.js Game (T011)
 *
 * DaisyUI-styled Suspense fallback that displays while the Three.js scene's
 * dynamic import resolves. Mirrors the inline loader from `src/app/game/page.tsx`.
 *
 * Pa11y-auditable (no canvas inside).
 *
 * @category game
 */
export default function Loader({ className = '' }: LoaderProps) {
  return (
    <div
      role="status"
      aria-label="Loading 3D scene"
      className={`loader bg-base-200 card flex h-96 items-center justify-center${className ? ` ${className}` : ''}`}
    >
      <span className="loading loading-spinner loading-lg" aria-hidden="true" />
      <p className="ml-4 text-sm">Loading 3D scene...</p>
    </div>
  );
}
