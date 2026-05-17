import React from 'react';

export interface FallbackPanelProps {
  /** Callback fired when the user clicks the Retry button. */
  onRetry?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * FallbackPanel component
 *
 * Feature 047 — Three.js Game (T010 scaffold; full impl in Phase 8 / T035)
 *
 * Rendered when WebGL is unavailable at mount OR when the canvas fires
 * `webglcontextlost` at runtime (per spec FR-008). Phase 8 implements the
 * themed silhouette + Retry button; this scaffold is a minimal placeholder
 * so the test harness can import it.
 *
 * @category game
 */
export default function FallbackPanel({
  onRetry,
  className = '',
}: FallbackPanelProps = {}) {
  return (
    <div
      role="alert"
      className={`bg-base-200 card flex h-96 flex-col items-center justify-center gap-4 p-6${className ? ` ${className}` : ''}`}
    >
      <h2 className="text-xl font-bold">3D Content Unavailable</h2>
      <p className="text-center text-sm">
        3D content requires WebGL. Your browser does not support it, or the
        graphics context was lost.
      </p>
      <button
        type="button"
        onClick={onRetry}
        aria-label="Retry rendering 3D scene"
        className="btn btn-primary min-h-11 min-w-44"
      >
        Retry
      </button>
    </div>
  );
}
