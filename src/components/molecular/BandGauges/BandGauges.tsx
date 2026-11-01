import React from 'react';
import {
  SCORE_MAX,
  SCORE_MIN,
  needleAngle,
  offScale,
  roundPerDay,
  signed,
} from '@/lib/band/gauges';

export interface BandGaugesProps {
  /** The song's score S (the one rule in src/lib/band/ranking.ts). */
  score: number;
  /** YouTube plays a day since the song was first shown. */
  perDay: number;
  /** The most plays a day any song in the list has; the right-hand end of that dial. */
  maxPerDay: number;
  /** Up votes minus down votes across every source, unweighted. */
  net: number;
  className?: string;
}

/** Shared gradients for every dial. Render once per page, before the first dial. */
export function BandGaugeDefs() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      className="absolute"
      data-testid="band-gauge-defs"
    >
      <defs>
        <radialGradient id="bg-brass" cx="32%" cy="28%" r="85%">
          <stop offset="0" stopColor="#fff0c0" />
          <stop offset=".35" stopColor="#d6a24c" />
          <stop offset=".75" stopColor="#8a5a1e" />
          <stop offset="1" stopColor="#4a2e0c" />
        </radialGradient>
        <radialGradient id="bg-face" cx="50%" cy="50%" r="55%">
          <stop offset="0" stopColor="#fffaea" />
          <stop offset=".55" stopColor="#fbe7b4" />
          <stop offset=".9" stopColor="#e8bd6a" />
          <stop offset="1" stopColor="#c98f35" />
        </radialGradient>
        <radialGradient id="bg-vignette" cx="50%" cy="50%" r="50%">
          <stop offset=".82" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".5" />
        </radialGradient>
      </defs>
    </svg>
  );
}

const ARC = 'M 66.56 233.44 A 118 118 0 1 1 233.44 233.44';

interface DialProps {
  title: string;
  readout: string;
  angle: number;
  scale?: readonly string[];
}

/** One brass dial. Decorative: the figure that holds it carries the words. */
function Dial({ title, readout, angle, scale }: DialProps) {
  const spots: Array<[number, number]> = [
    [84.9, 221],
    [59.1, 141],
    [240.9, 141],
    [215.1, 221],
  ];
  const at = [0, 1, 4, 5];
  return (
    <svg
      viewBox="0 0 300 300"
      aria-hidden="true"
      focusable="false"
      className="block h-auto w-full drop-shadow-[0_6px_5px_rgb(0_0_0/0.8)]"
    >
      <circle cx="150" cy="152" r="149" fill="#000" opacity=".55" />
      <circle cx="150" cy="150" r="147" fill="url(#bg-brass)" />
      <circle
        cx="150"
        cy="150"
        r="144.5"
        fill="none"
        stroke="#2a1a0c"
        strokeOpacity=".45"
        strokeWidth="4"
        strokeDasharray="1.4 2.2"
      />
      <circle cx="150" cy="150" r="138" fill="#0e0904" />
      <circle cx="150" cy="150" r="133" fill="url(#bg-face)" />
      <path
        d={ARC}
        fill="none"
        stroke="#a3261b"
        strokeWidth="3"
        pathLength="100"
        strokeDasharray="0 85 15 100"
      />
      <path
        d={ARC}
        fill="none"
        stroke="#24140a"
        strokeWidth="12"
        pathLength="101"
        strokeDasharray="0.45 9.55"
      />
      <path
        d={ARC}
        fill="none"
        stroke="#24140a"
        strokeWidth="6"
        pathLength="101"
        strokeDasharray="0.25 1.75"
      />
      {scale ? (
        <g
          fill="#24140a"
          fontFamily="Georgia, serif"
          fontSize="18"
          fontWeight="800"
          textAnchor="middle"
        >
          {spots.map(([x, y], k) => (
            <text key={at[k]} x={x} y={y}>
              {scale[at[k]]}
            </text>
          ))}
        </g>
      ) : null}
      <text
        x="150"
        y="104"
        textAnchor="middle"
        fill="#24140a"
        fontFamily="Georgia, serif"
        fontWeight="800"
        fontSize="16"
        letterSpacing="3"
      >
        {title}
      </text>
      <rect
        x="116"
        y="194"
        width="68"
        height="26"
        rx="3"
        fill="#0c0805"
        stroke="url(#bg-brass)"
        strokeWidth="2"
      />
      <text
        x="150"
        y="213"
        textAnchor="middle"
        fill="#ffcf7a"
        fontFamily="'Courier New', monospace"
        fontWeight="700"
        fontSize="17"
      >
        {readout}
      </text>
      <g
        className="band-needle"
        style={{ ['--needle-angle' as string]: `${angle}deg` }}
      >
        <path d="M 147 170 L 149 40 L 151 40 L 153 170 Z" fill="#5c160f" />
      </g>
      <circle
        cx="150"
        cy="150"
        r="14"
        fill="url(#bg-brass)"
        stroke="#2a1a0c"
        strokeWidth="1.5"
      />
      <circle cx="150" cy="150" r="4" fill="#2a1a0c" />
      <circle cx="150" cy="150" r="133" fill="url(#bg-vignette)" />
    </svg>
  );
}

const PLATE =
  'max-w-full whitespace-nowrap rounded-[3px] bg-gradient-to-b from-[#f0c878] to-[#d9a64f] px-2 pt-px pb-0.5 text-center text-base font-bold leading-[1.3] text-[#24140a] shadow-[inset_0_1px_0_#ffe8b0,0_2px_4px_rgb(0_0_0/0.6)]';

/**
 * The two dials on a ranked song: SCORE (the song's S on a -15 to +15 scale) and A DAY
 * (YouTube plays a day, against the busiest song in the list). Every number the
 * drawing shows is also written as text: a visible plate under each dial and a full
 * sentence for screen readers. A needle that would pass the end of its scale is
 * pinned there and the sentence says so.
 */
export default function BandGauges({
  score,
  perDay,
  maxPerDay,
  net,
  className = '',
}: BandGaugesProps) {
  const day = roundPerDay(perDay);
  const top = Math.max(1, maxPerDay);
  const scoreSays = `Score ${signed(score)} on a scale from minus ${-SCORE_MIN} to plus ${SCORE_MAX}${
    offScale(score, SCORE_MIN, SCORE_MAX)
      ? ', off the scale, needle at the end'
      : ''
  }.`;
  const daySays = `${day} YouTube plays a day, on a scale from 0 to ${roundPerDay(top)}, the busiest song in the list.`;

  return (
    <div
      role="group"
      aria-label="Score and plays a day"
      data-testid="band-gauges"
      className={`grid w-full grid-cols-[1.4fr_1fr] items-end gap-x-3 gap-y-1 ${className}`}
    >
      <figure className="m-0 grid justify-items-center gap-1">
        <Dial
          title="SCORE"
          readout={signed(score)}
          angle={needleAngle(score, SCORE_MIN, SCORE_MAX)}
          scale={['-15', '-9', '-3', '+3', '+9', '+15']}
        />
        <figcaption className={PLATE} data-testid="gauge-score">
          <span aria-hidden="true">score {signed(score)}</span>
          <span className="sr-only">{scoreSays}</span>
        </figcaption>
      </figure>
      <figure className="m-0 grid justify-items-center gap-1">
        <Dial
          title="A DAY"
          readout={String(day)}
          angle={needleAngle(perDay, 0, top)}
        />
        <figcaption className={PLATE} data-testid="gauge-per-day">
          <span aria-hidden="true">{day}/day</span>
          <span className="sr-only">{daySays}</span>
        </figcaption>
      </figure>
      <p
        className="col-span-2 !m-0 text-center text-base leading-[1.3] text-[#d3bf98]"
        data-testid="gauge-note"
      >
        S {score} · net {signed(net)}
      </p>
    </div>
  );
}
