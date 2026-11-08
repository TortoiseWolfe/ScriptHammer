import React from 'react';
import { getAssetUrl } from '@/config/project.config';
import {
  JINGLES,
  JINGLE_CLIENT_CREDIT,
  JINGLE_INTRO,
} from '@/lib/band/jingles';

export interface BandJinglesProps {
  /** Additional CSS classes */
  className?: string;
}

const CARD =
  'rounded-2xl border border-[#3a3f66] bg-[#1c1f34] p-5 text-[#f6ecd0] shadow-[0_6px_12px_-5px_rgb(0_0_0/0.6),0_2px_4px_-2px_rgb(0_0_0/0.4),inset_0_1px_0_rgb(246_236_208/0.12)] sm:p-6';

const LINK =
  'inline-flex min-h-11 items-center font-semibold text-[#f5b335] underline underline-offset-4 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#f6ecd0]';

const CREDIT_LINK =
  'font-semibold text-[#f5b335] underline underline-offset-4 hover:text-[#f6ecd0] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#f6ecd0]';

/**
 * BandJingles component
 *
 * The band's client jingle sample on /band: what a jingle is, then each
 * approved take with a native audio player and a download link. No autoplay and
 * no preloading, like the house songs. Sits on the fixed night-stage colours.
 *
 * @category molecular
 */
export default function BandJingles({ className }: BandJinglesProps) {
  return (
    <section
      aria-labelledby="jingles"
      data-testid="band-jingles"
      className={`mt-14 md:mt-20${className ? ` ${className}` : ''}`}
    >
      <h2
        id="jingles"
        className="sh-font-special-elite !mt-0 !mb-2 !text-3xl text-[#f6ecd0] md:!text-4xl"
      >
        Jingles
      </h2>
      <p className="!mt-0 !mb-2 max-w-[68ch] text-lg leading-[1.65]">
        {JINGLE_INTRO}
      </p>
      <p
        data-testid="jingle-client-credit"
        className="!mt-0 !mb-6 max-w-[68ch] text-lg leading-[1.65]"
      >
        {JINGLE_CLIENT_CREDIT.map((segment) =>
          segment.href ? (
            <a
              key={segment.href}
              href={segment.href}
              rel="noopener noreferrer"
              className={CREDIT_LINK}
            >
              {segment.text}
            </a>
          ) : (
            <React.Fragment key={segment.text}>{segment.text}</React.Fragment>
          )
        )}
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {JINGLES.map((jingle) => (
          <article
            key={jingle.id}
            data-testid="jingle-player"
            data-jingle-id={jingle.id}
            className={CARD}
          >
            <h3 className="sh-font-special-elite !m-0 !text-2xl text-balance text-[#f5b335]">
              {jingle.title}{' '}
              <span className="mt-1 block font-sans text-lg font-normal text-[#f6ecd0]">
                ({jingle.length})
              </span>
            </h3>
            <p className="!mt-2 !mb-4 max-w-[68ch] text-lg leading-[1.65]">
              {jingle.description}
            </p>
            <audio
              controls
              preload="none"
              src={getAssetUrl(jingle.src)}
              aria-label={`${jingle.title}, ${jingle.length}`}
              className="w-full"
            >
              Your browser cannot play audio.
            </audio>
            <p className="!mt-3 !mb-0">
              <a
                href={getAssetUrl(jingle.src)}
                download={jingle.downloadName}
                className={LINK}
              >
                Download {jingle.downloadName}
              </a>
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
