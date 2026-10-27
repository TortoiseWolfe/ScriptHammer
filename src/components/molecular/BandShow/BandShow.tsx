'use client';

import React, { useEffect, useState } from 'react';
import { getAssetUrl } from '@/config/project.config';
import {
  SHOW_TITLE,
  SHOW_CHANNEL,
  SHOW_CHANNEL_URL,
  SHOW_CITIES,
  SHOW_SLOTS,
  cityTime,
  showState,
  type ShowState,
} from '@/lib/band/show';

export interface BandShowProps {
  /** Pin "now" (tests and stories). Left out, the visitor's own clock decides. */
  now?: number;
  className?: string;
}

const STATUS: Record<ShowState, string> = {
  before: 'Coming up Thursday 29 October, free on Twitch.',
  live: 'The live show is on tonight.',
  between: 'The live show has played. The replay is Saturday 31 October.',
  replay: 'The replay is on tonight.',
  over: 'The show has played. Every song stays free to listen to below.',
};

const BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-xl px-6 py-3 text-lg font-bold focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#f6ecd0]';

/** Keeps "11:30 PM" together, so a line never ends on a lone "PM". */
const glue = (range: string) => range.replace(/ (AM|PM)/g, '\u00A0$1');

const THU_OPENING = SHOW_SLOTS[0];
const THU_HEADLINE = SHOW_SLOTS[1];

/**
 * The Band Wagon show block on /band. Server output says "coming up"; once the
 * page is in a browser it reads the visitor's clock, so it never says "coming
 * up" about a show that has finished.
 */
export default function BandShow({ now, className }: BandShowProps) {
  const [state, setState] = useState<ShowState>(
    now === undefined ? 'before' : showState(now)
  );

  useEffect(() => {
    setState(showState(now ?? Date.now()));
  }, [now]);

  return (
    <section
      aria-labelledby="show"
      data-testid="band-show"
      data-state={state}
      className={`rounded-2xl border border-[#3a3f66] bg-[#1c1f34] p-5 text-[#f6ecd0] shadow-[0_6px_12px_-5px_rgb(0_0_0/0.6),0_2px_4px_-2px_rgb(0_0_0/0.4),inset_0_1px_0_rgb(246_236_208/0.12)] sm:p-8${className ? ` ${className}` : ''}`}
    >
      <h2
        id="show"
        className="sh-font-special-elite !mt-0 !mb-3 !text-3xl text-balance text-[#f5b335] md:!text-4xl"
      >
        {SHOW_TITLE}
      </h2>
      <p
        data-testid="band-show-status"
        className="!m-0 max-w-[68ch] text-lg leading-[1.65] font-bold"
      >
        {STATUS[state]}
      </p>

      {state !== 'over' && (
        <>
          <div className="mt-6 grid gap-6 md:grid-cols-2 md:grid-rows-[auto_1fr]">
            <div className="md:row-span-2 md:grid md:grid-rows-subgrid">
              <h3 className="!m-0 text-xl font-bold text-balance text-[#f5b335]">
                LIVE Thursday 29 October
              </h3>
              <p className="!mt-2 !mb-0 max-w-[68ch] text-lg leading-[1.65]">
                Opening set 6:00 to 7:30 PM
                <br />
                Headline 8:00 to 10:00 PM
                <br />
                Eastern time
              </p>
            </div>
            <div className="md:row-span-2 md:grid md:grid-rows-subgrid">
              <h3 className="!m-0 text-xl font-bold text-balance text-[#f5b335]">
                REPLAY Saturday 31 October (Halloween)
              </h3>
              <p className="!mt-2 !mb-0 max-w-[68ch] text-lg leading-[1.65]">
                Opening set 6:00 to 7:30 PM
                <br />
                Headline 8:00 to 10:00 PM
                <br />
                Eastern time
              </p>
            </div>
          </div>

          <p className="!mt-6 !mb-0 max-w-[68ch] text-lg leading-[1.65]">
            Watch free on Twitch at{' '}
            <a
              href={SHOW_CHANNEL_URL}
              rel="noopener noreferrer"
              className="font-bold [overflow-wrap:anywhere] text-[#f5b335] underline underline-offset-4 hover:text-[#f6ecd0]"
            >
              {SHOW_CHANNEL}
            </a>
            . Twitch is for ages 13 and up, so younger fans, watch with a
            grown-up.
          </p>

          <div className="mt-6 flex flex-wrap gap-4">
            <a
              href={getAssetUrl('/band/the-band-wagon.ics')}
              download="the-band-wagon.ics"
              className={`${BUTTON} bg-[#f5b335] text-[#14172b] hover:bg-[#f6ecd0]`}
            >
              Add all four shows to your calendar
            </a>
          </div>

          <h3 className="!mt-8 !mb-2 text-xl font-bold text-balance text-[#f5b335]">
            The live night, on your city&apos;s clock
          </h3>
          <p className="!mt-0 !mb-4 max-w-[68ch] text-lg leading-[1.65]">
            The replay runs at the same clock times in every city below.
          </p>
          <ul
            aria-label="Show times by city"
            className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4"
          >
            {SHOW_CITIES.map((city) => {
              const a = cityTime(THU_OPENING, city.zone);
              const b = cityTime(THU_HEADLINE, city.zone);
              return (
                <li
                  key={city.name}
                  data-testid="show-city"
                  className="m-0 rounded-xl border border-[#3a3f66] bg-[#14172b] p-4 text-lg leading-[1.5]"
                >
                  <strong className="block text-[#f5b335]">{city.name}</strong>
                  Opening set {glue(a.range)}
                  {a.nextDay ? ' (next day)' : ''}
                  <br />
                  Headline {glue(b.range)}
                  {b.nextDay ? ' (next day)' : ''}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
