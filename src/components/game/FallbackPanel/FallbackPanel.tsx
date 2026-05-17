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
 * Feature 047 — Three.js Game (T010 scaffold → T035 full impl)
 *
 * Rendered when WebGL is unavailable at mount OR when the canvas fires
 * `webglcontextlost` at runtime (per spec FR-008). Themed silhouette of the
 * canonical brand assets (cog ring + script-tag brackets + mallet) in
 * DaisyUI base-content color, plus headline + body copy explaining the
 * WebGL requirement and a 44×44 keyboard-focusable Retry button.
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
      {/* Themed silhouette: cog ring + script-tag brackets + mallet, all in
          DaisyUI base-content at low opacity. Decorative — the headline +
          body below carry the meaning for screen readers. */}
      <svg
        data-testid="brand-silhouette"
        aria-hidden="true"
        viewBox="0 0 400 400"
        className="h-32 w-32 opacity-40"
        fill="hsl(var(--bc) / 0.6)"
      >
        {/* Cog ring outline */}
        <circle
          cx="200"
          cy="200"
          r="160"
          fill="none"
          stroke="currentColor"
          strokeWidth="20"
        />
        {/* 12 gear teeth */}
        <g>
          {Array.from({ length: 12 }).map((_, i) => (
            <rect
              key={i}
              x="190"
              y="20"
              width="20"
              height="30"
              transform={`rotate(${i * 30} 200 200)`}
            />
          ))}
        </g>
        {/* Golden < > brackets inside */}
        <path
          d="M 140 140 L 100 200 L 140 260"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 260 140 L 300 200 L 260 260"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

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
