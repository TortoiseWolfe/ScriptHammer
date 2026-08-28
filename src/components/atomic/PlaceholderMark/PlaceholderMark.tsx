'use client';

import { getProjectConfig } from '@/config/project.config';

export interface PlaceholderMarkProps {
  /** Overrides the initials derived from the project name. */
  initials?: string;
  /** Accessible name. Defaults to the project name. */
  label?: string;
  className?: string;
}

/**
 * A DELIBERATELY GENERIC MARK, so a fork never publishes this template's logo.
 *
 * The hero used to render `LayeredScriptHammerLogo` unconditionally. That lockup is
 * this project's identity — a gear ring, a printing mallet, and "SCRIPTHAMMER.COM"
 * twice around the rim. A fork inherited all of it and put it on its own front page.
 *
 * NO STRING SUBSTITUTION COULD HAVE FIXED THAT. The rim lettering lives in
 * `ringWordmark.ts` as outlined glyph paths — mask cut-outs generated from a font by
 * a Python/fontTools pipeline, not text. There is no "ScriptHammer" anywhere in it to
 * replace, which is why the rebrand's sweep left a fork showing our brand while every
 * string around it changed.
 *
 * So this is what a project renders until it has a mark of its own: concentric rings
 * and the initials of its own name, in its own theme colours. It is meant to look like
 * a placeholder rather than a logo — the same honesty as the `hello-world` blog post
 * a fresh fork keeps.
 *
 * Deriving the initials rather than accepting artwork is the point: it cannot ship
 * anyone else's brand, and it needs nothing from the forker on day one.
 */
export default function PlaceholderMark({
  initials,
  label,
  className = '',
}: PlaceholderMarkProps) {
  const { projectName } = getProjectConfig();

  // An explicit override is used verbatim; only the project name is reduced.
  // Deriving from the override too turned initials="XY" into "X".
  const derived =
    initials ??
    // First letter of each of the first two words: "Grand Daze" -> GD,
    // "grand-daze" -> GD, "widget" -> W.
    projectName
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('');

  const text = derived.toUpperCase() || '?';
  const accessibleName = label ?? `${projectName} placeholder mark`;

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={accessibleName}
      className={`h-full w-full ${className}`}
    >
      <circle
        cx="100"
        cy="100"
        r="94"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.35"
      />
      <circle
        cx="100"
        cy="100"
        r="78"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.55"
      />
      <text
        x="100"
        y="100"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        // Live text, not outlines. The whole reason the old mark could not be
        // rebranded is that its letters were paths.
        fontSize={text.length > 1 ? 64 : 84}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        letterSpacing="2"
      >
        {text}
      </text>
    </svg>
  );
}
