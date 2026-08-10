'use client';

import React, { useId } from 'react';
import { RING_WORDMARK_GLYPHS, RING_WORDMARK_DIAMONDS } from './ringWordmark';

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
          d="M170.4,47.8 L172.7,5.9 L227.3,5.9 L229.6,47.8 A155,155 0 0 1 250.5,53.4L250.5,53.4 L273.4,18.3 L320.7,45.5 L301.7,83 A155,155 0 0 1 317,98.3L317,98.3 L354.5,79.3 L381.7,126.6 L346.6,149.5 A155,155 0 0 1 352.2,170.4L352.2,170.4 L394.1,172.7 L394.1,227.3 L352.2,229.6 A155,155 0 0 1 346.6,250.5L346.6,250.5 L381.7,273.4 L354.5,320.7 L317,301.7 A155,155 0 0 1 301.7,317L301.7,317 L320.7,354.5 L273.4,381.7 L250.5,346.6 A155,155 0 0 1 229.6,352.2L229.6,352.2 L227.3,394.1 L172.7,394.1 L170.4,352.2 A155,155 0 0 1 149.5,346.6L149.5,346.6 L126.6,381.7 L79.3,354.5 L98.3,317 A155,155 0 0 1 83,301.7L83,301.7 L45.5,320.7 L18.3,273.4 L53.4,250.5 A155,155 0 0 1 47.8,229.6L47.8,229.6 L5.9,227.3 L5.9,172.7 L47.8,170.4 A155,155 0 0 1 53.4,149.5L53.4,149.5 L18.3,126.6 L45.5,79.3 L83,98.3 A155,155 0 0 1 98.3,83L98.3,83 L79.3,45.5 L126.6,18.3 L149.5,53.4 A155,155 0 0 1 170.4,47.8 Z M200,104 A96,96 0 1 1 200,296 A96,96 0 1 1 200,104 Z"
        />
        <g id={id('tags')}>
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
          <g transform="rotate(42 200 200)">
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
        {/* Clear-space halo: keeps the mallet readable against the gear teeth
            down to ~18px. Pure stroked paths — no text. */}
        <mask id={id('cut')}>
          <rect width="400" height="400" fill="#fff" />
          <g
            transform="translate(200 200) scale(.28) translate(-200 -200)"
            stroke="#000"
            strokeWidth="46"
            strokeLinejoin="round"
            fill="#000"
          >
            <path
              transform="rotate(42 200 200)"
              d="M178,154 L222,154 L215,332 L185,332 Z"
            />
            <path
              transform="rotate(42 200 200)"
              d="M106,36 L294,36 L280,154 L120,154 Z"
            />
          </g>
        </mask>
      </defs>

      <g className={anim('sh-mark-jolt')}>
        <g mask={`url(#${id('cut')})`}>
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
              mask={wordmark ? `url(#${id('word')})` : undefined}
            />
          </g>
          <g className={anim('sh-mark-anvil')}>
            <g transform="translate(200 200) scale(.52) translate(-200 -200)">
              <use href={`#${id('tags')}`} />
            </g>
          </g>
        </g>

        {/* Sparks at the point of contact. Hidden entirely under reduced
            motion — frozen mid-flight they read as stray marks. */}
        <g className={anim('sh-mark-spark')} opacity={animated ? undefined : 0}>
          <g
            stroke="#FFE9A8"
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M150,236 L138,224" />
            <path d="M158,231 L156,215" />
            <path d="M167,240 L181,233" />
            <path d="M150,252 L136,259" />
          </g>
        </g>

        <g className={anim('sh-mark-swing')}>
          <g transform="translate(200 200) scale(.28) translate(-200 -200)">
            <use href={`#${id('mallet')}`} />
          </g>
        </g>
      </g>
    </svg>
  );
};

LayeredScriptHammerLogo.displayName = 'LayeredScriptHammerLogo';
