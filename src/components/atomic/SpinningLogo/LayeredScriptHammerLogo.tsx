'use client';

import React, { useId } from 'react';
import { RING_WORDMARK_GLYPHS, RING_WORDMARK_DIAMONDS } from './ringWordmark';

/**
 * Comic-ink keyline. The brand fills are fixed and do not follow the theme, so
 * on the ten pure-white themes the beech reads 1.57:1 and the steel 1.88:1 —
 * the mark dissolves. A dark keyline gives it definition that does not depend
 * on fill-versus-ground at all: 12.44:1 on white, and inert on dark themes
 * where the fills already carry ~9:1 and need no help.
 *
 * The INTERNAL lines are the part that works on all 35 themes, because they
 * separate shape from shape rather than shape from ground.
 *
 * This is a legibility decision, not a compliance one — WCAG exempts logotypes
 * and nothing in this repo gates the mark. See docs/design/brand-marks/PROVENANCE.md.
 */
const INK = '#2E353B';
const KEYLINE = 5;
const SILHOUETTE = 7;

export interface LayeredScriptHammerLogoProps {
  className?: string;
  /**
   * Cut "SCRIPTHAMMER.COM" out of the gear ring, as panel 8e does.
   *
   * Off by default and it should stay off below ~256px: the ring text is 38u
   * in a 400u viewBox, so at the 30px nav size it is roughly 3px tall and
   * reads as noise on the teeth. Switch it on for the hero and anywhere else
   * the mark is rendered large.
   *
   * Safe to use anywhere despite the source export needing Oswald — the glyphs
   * here are baked to paths, so there is no font dependency.
   */
  wordmark?: boolean;
  /**
   * Run the strike animation. Defaults to true — the mark animates everywhere
   * it appears, including the 30px nav instance.
   */
  animated?: boolean;
  /** Pause the whole mark while the pointer is over it. */
  pauseOnHover?: boolean;
  /**
   * Supply ONLY when the mark is not already inside a labelled element.
   * Omitted, it renders decorative (aria-hidden) — which is what all three
   * in-app call sites want, since each wraps it in a labelled link or heading.
   * Adding a second accessible name inside the nav Home link retargets the
   * `mobile-navigation` and `cross-page-navigation` locators (#378).
   */
  ariaLabel?: string;
}

/**
 * The ScriptHammer brand mark, animated.
 *
 * Ported from the Claude Design "ScriptHammer Logo v3" export, panel 8e
 * ("Motion — gear turns, mallet strikes the brackets"). Geometry comes from
 * docs/design/brand-marks/scripthammer-lockup.svg; timings live with the
 * keyframes in globals.css.
 *
 * ## Why this is inline SVG rather than three <Image> layers
 *
 * It used to stack printing-mallet.svg, scripthammer-logo.svg and
 * script-tags.svg as three absolutely-positioned next/image elements, spinning
 * only the middle one. That cannot express 8e: the mallet has to swing about
 * its own handle pivot, the brackets flash on the strike, and sparks appear at
 * the point of contact. Animating sub-parts requires them to be in one
 * document, so the mark is inlined.
 *
 * A side effect worth knowing: the three public/*.svg files are no longer on
 * the render path for this component. They remain the canonical standalone
 * assets (and favicon.svg is still the icon-matrix source), but editing them
 * will not change what this renders. The geometry below and those files both
 * derive from the same export.
 *
 * ## The wordmark is opt-in, by size
 *
 * 8e cuts "SCRIPTHAMMER.COM" out of the gear ring via `mask="url(#cut-word)"`,
 * using live Oswald text. Two separate problems came with that, and only one
 * of them still applies:
 *
 *   - The font dependency is GONE. `./ringWordmark` holds the same glyphs baked
 *     to paths, so `wordmark` is safe to use anywhere without Oswald present.
 *   - Legibility is not. The ring text is 38u in a 400u viewBox, so the 30px
 *     nav instance renders it about 3px tall, where it reads as noise on the
 *     teeth rather than as a word.
 *
 * So it is a prop rather than a default: on for the hero, off for the nav and
 * sign-in. Turn it on wherever the mark is drawn at roughly 256px or more.
 */
export const LayeredScriptHammerLogo: React.FC<
  LayeredScriptHammerLogoProps
> = ({
  className = '',
  animated = true,
  pauseOnHover = true,
  wordmark = false,
  ariaLabel,
}) => {
  // Unique per instance. The home page renders this twice (nav + hero), and
  // duplicate ids would make every <use href="#…"> and mask resolve to
  // whichever instance mounted first.
  const uid = useId().replace(/:/g, '');
  const id = (name: string) => `${name}-${uid}`;

  const naming = ariaLabel
    ? ({ role: 'img', 'aria-label': ariaLabel } as const)
    : ({ 'aria-hidden': true, focusable: false } as const);

  const anim = (utility: string) => (animated ? utility : undefined);

  return (
    <svg
      viewBox="0 0 400 400"
      className={[pauseOnHover && 'sh-mark-pause', className]
        .filter(Boolean)
        .join(' ')}
      style={{ width: '100%', height: '100%', aspectRatio: '1 / 1' }}
      data-testid="brand-mark"
      {...naming}
    >
      {ariaLabel ? <title>{ariaLabel}</title> : null}
      <defs>
        <path
          id={id('gear')}
          fillRule="evenodd"
          d="M170.4,35.6 L172.7,14 L227.3,14 L229.6,35.6 A167,167 0 0 1 256.6,42.9 L269.4,25.3 L316.6,52.5 L307.8,72.4 A167,167 0 0 1 327.6,92.2 L347.5,83.4 L374.7,130.6 L357.1,143.4 A167,167 0 0 1 364.4,170.4 L386,172.7 L386,227.3 L364.4,229.6 A167,167 0 0 1 357.1,256.6 L374.7,269.4 L347.5,316.6 L327.6,307.8 A167,167 0 0 1 307.8,327.6 L316.6,347.5 L269.4,374.7 L256.6,357.1 A167,167 0 0 1 229.6,364.4 L227.3,386 L172.7,386 L170.4,364.4 A167,167 0 0 1 143.4,357.1 L130.6,374.7 L83.4,347.5 L92.2,327.6 A167,167 0 0 1 72.4,307.8 L52.5,316.6 L25.3,269.4 L42.9,256.6 A167,167 0 0 1 35.6,229.6 L14,227.3 L14,172.7 L35.6,170.4 A167,167 0 0 1 42.9,143.4 L25.3,130.6 L52.5,83.4 L72.4,92.2 A167,167 0 0 1 92.2,72.4 L83.4,52.5 L130.6,25.3 L143.4,42.9 A167,167 0 0 1 170.4,35.6 Z M200,78 A122,122 0 1 1 200,322 A122,122 0 1 1 200,78 Z"
        />
        {/* Keyline weights are pre-divided by the scale of the group each
            symbol is instanced into, because stroke-width scales with the
            transform. `tags` renders at .68 and `mallet` at .46, so a nominal
            7.35 and 10.87 both land at KEYLINE (5u) on the canvas. Quoting the
            same number in all three places would give three different lines. */}
        <g
          id={id('tags')}
          stroke={INK}
          strokeWidth={KEYLINE / 0.68}
          strokeLinejoin="round"
        >
          <path
            fill="#EBB042"
            d="M143.8,64.3 L45.3,200 L94.7,200 L193.3,64.3 Z"
          />
          <path
            fill="#9A6418"
            d="M45.3,200 L143.8,335.7 L193.3,335.7 L94.7,200 Z"
          />
          <path
            fill="#EBB042"
            d="M256.2,64.3 L354.7,200 L305.3,200 L206.7,64.3 Z"
          />
          <path
            fill="#9A6418"
            d="M354.7,200 L256.2,335.7 L206.7,335.7 L305.3,200 Z"
          />
        </g>
        <g id={id('mallet')}>
          <g
            transform="rotate(42 200 200)"
            stroke={INK}
            strokeWidth={KEYLINE / 0.46}
            strokeLinejoin="round"
          >
            <path fill="#B08F5E" d="M178,154 L222,154 L215,332 L185,332 Z" />
            <path fill="#7E6038" d="M208,154 L222,154 L215,332 L206,332 Z" />
            <path fill="#E6CB99" d="M106,64 L132,36 L268,36 L294,64 Z" />
            <path fill="#8E7042" d="M186,40 L214,40 L216,60 L184,60 Z" />
            <path fill="#C9A470" d="M106,64 L294,64 L280,154 L120,154 Z" />
            <path fill="#9C7844" d="M252,64 L294,64 L280,154 L247,154 Z" />
          </g>
        </g>
        {/* The ring wordmark, as a cut-out. Black removes the gear beneath, so
            the letters read as negative space — which is why they must be a
            mask and not ink. Only built when asked for. */}
        {wordmark ? (
          <mask id={id('word')}>
            <rect width="400" height="400" fill="#fff" />
            <g fill="#000">
              {RING_WORDMARK_GLYPHS.map(([transform, d], i) => (
                <path key={i} transform={transform} d={d} />
              ))}
              {RING_WORDMARK_DIAMONDS.map((d, i) => (
                <path key={`d${i}`} d={d} />
              ))}
            </g>
          </mask>
        ) : null}
      </defs>

      <g className={anim('sh-mark-jolt')}>
        <g>
          <g className={anim('sh-mark-spin')}>
            <use
              href={`#${id('gear')}`}
              transform="translate(6,7)"
              fill="#2E353B"
            />
            {/* Only the steel face is cut — the offset shadow gear above stays
                solid, so the letters show dark against it. */}
            <use
              href={`#${id('gear')}`}
              fill="#B6BEC6"
              stroke={INK}
              strokeWidth={SILHOUETTE}
              strokeLinejoin="round"
              mask={wordmark ? `url(#${id('word')})` : undefined}
            />
          </g>
          <g className={anim('sh-mark-anvil')}>
            <g transform="translate(200 200) scale(.68) translate(-200 -200)">
              <use href={`#${id('tags')}`} />
            </g>
          </g>
        </g>

        {/* Sparks at the point of contact. Hidden entirely under reduced
            motion — frozen mid-flight they read as stray marks. */}
        <g className={anim('sh-mark-spark')} opacity={animated ? undefined : 0}>
          <g stroke={INK} strokeWidth="9.5" strokeLinecap="round" fill="none">
            <path d="M264.75,163.25 L252.75,151.25" />
            <path d="M272.75,158.25 L270.75,142.25" />
            <path d="M281.75,167.25 L295.75,160.25" />
            <path d="M264.75,179.25 L250.75,186.25" />
          </g>
          <g
            stroke="#FFE9A8"
            strokeWidth="5.5"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M264.75,163.25 L252.75,151.25" />
            <path d="M272.75,158.25 L270.75,142.25" />
            <path d="M281.75,167.25 L295.75,160.25" />
            <path d="M264.75,179.25 L250.75,186.25" />
          </g>
        </g>

        <g className={anim('sh-mark-swing')}>
          <g transform="translate(200 200) scale(.46) translate(-200 -200)">
            <use href={`#${id('mallet')}`} />
          </g>
        </g>
      </g>
    </svg>
  );
};

LayeredScriptHammerLogo.displayName = 'LayeredScriptHammerLogo';
