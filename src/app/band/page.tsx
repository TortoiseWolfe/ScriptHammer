import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { routeMetadata } from '@/utils/metadata';
import { projectConfig, getAssetUrl } from '@/config/project.config';
import { BAND_NAME } from '@/lib/band/roster';
import { THEME_SONG, HOOK } from '@/lib/band/songs';
import BandRoster from '@/components/molecular/BandRoster';
import ThemeSongPlayer from '@/components/molecular/ThemeSongPlayer';

const TITLE = 'ScriptHammer, the house band - free music and art';
const DESCRIPTION =
  'Seven animatronic bots play free music for everyone. Listen to the theme song, meet the band, and keep your own site playing.';
const OG_IMAGE = `${projectConfig.deployUrl}/band/og-1200x630.jpg`;

export const metadata: Metadata = {
  // This route claims its own URL and keeps the social card (#668, #990).
  ...routeMetadata('/band/'),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

/**
 * /band: the house band's free page (#1408).
 *
 * A kid-safe route (src/lib/privacy/kid-safe-routes.ts): no analytics, no pixel,
 * no error reporting loads here. So, on purpose: no forms, accounts, comments,
 * embeds or outside fonts. Colours are fixed to the cover's night palette, so
 * contrast does not change with the visitor's theme.
 */
const BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-xl px-6 py-3 text-lg font-bold focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#f6ecd0]';

export default function BandPage() {
  return (
    <main
      id="band"
      className="bg-[#14172b] text-[#f6ecd0]"
      data-testid="band-page"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 md:py-16">
        <header className="grid grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] md:gap-12">
          <div className="min-w-0">
            <p className="!m-0 text-lg font-bold tracking-widest text-[#f5b335] uppercase">
              Looks scary. Plays nice.
            </p>
            <h1 className="sh-font-special-elite !my-4 !text-3xl text-balance text-[#f6ecd0] min-[400px]:!text-4xl sm:!text-5xl">
              {`${BAND_NAME}, the house band`}
            </h1>
            <p className="!m-0 max-w-[68ch] text-lg leading-[1.65]">
              Seven animatronic bots, a little scary to look at, who play for
              everyone. The music and the art are free to listen to, share and
              remix. Press play on the theme song and stay a while.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/schedule"
                className={`${BUTTON} bg-[#f5b335] text-[#14172b] hover:bg-[#f6ecd0]`}
              >
                Book the band
              </Link>
              <Link
                href="/pricing"
                className={`${BUTTON} border-2 border-[#f5b335] text-[#f6ecd0] hover:bg-[#1c1f34]`}
              >
                Keep your site playing
              </Link>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getAssetUrl('/band/cover/band-wagon-600.webp')}
            width={600}
            height={600}
            alt="The Band Wagon album cover: seven friendly robots in a night-time wagon, lit by lanterns."
            className="w-full rounded-2xl shadow-[0_10px_20px_-6px_rgb(0_0_0/0.7),0_4px_8px_-3px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(246_236_208/0.12)]"
          />
        </header>

        <section aria-labelledby="listen" className="mt-14 md:mt-20">
          <h2
            id="listen"
            className="sh-font-special-elite !mt-0 !mb-6 !text-3xl text-[#f6ecd0] md:!text-4xl"
          >
            Listen
          </h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <ThemeSongPlayer song={THEME_SONG} />
            <ThemeSongPlayer song={HOOK} />
          </div>
        </section>

        <section aria-labelledby="meet" className="mt-14 md:mt-20">
          <h2
            id="meet"
            className="sh-font-special-elite !mt-0 !mb-2 !text-3xl text-[#f6ecd0] md:!text-4xl"
          >
            Meet the band
          </h2>
          <p className="!mt-0 !mb-6 max-w-[68ch] text-lg leading-[1.65]">
            Seven players, one wagon. None of them bites.
          </p>
          <BandRoster />
        </section>

        <section
          aria-labelledby="licence"
          className="mt-14 border-t border-[#3a3f66] pt-8 md:mt-20"
        >
          <h2
            id="licence"
            className="sh-font-special-elite !mt-0 !mb-3 !text-2xl text-[#f6ecd0]"
          >
            Free to share
          </h2>
          <p className="!m-0 max-w-[68ch] text-lg leading-[1.65]">
            The music and art are CC BY-SA 4.0 and the site&apos;s code is MIT.
            The music was made with an AI model and the art with AI help; the{' '}
            <Link
              href="/credits"
              className="font-semibold text-[#f5b335] underline underline-offset-4"
            >
              credits page
            </Link>{' '}
            says exactly how.
          </p>
        </section>
      </div>
    </main>
  );
}
