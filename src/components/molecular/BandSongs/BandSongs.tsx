import React from 'react';
import { getAssetUrl } from '@/config/project.config';
import rankingFile from '../../../../public/data/band-ranking.json';
import weightsFile from '../../../../public/data/band-weights.json';
import tracksFile from '../../../../public/data/band-tracks.json';
import {
  dayLabel,
  newMark,
  playsPerDay,
  rankSongs,
  score,
  type BandRankingFile,
  type BandSong,
  type BandTrackInfo,
  type BandTracks,
  type BandWeights,
} from '@/lib/band/ranking';
import { PRIVACY_LINE } from '@/lib/band/vote';
import { SHOW_CHANNEL_URL } from '@/lib/band/show';
import BandSongVote from './BandSongVote';

export interface BandSongsProps {
  /** Pin the list and the weights (tests and stories). */
  ranking?: BandRankingFile;
  weights?: BandWeights;
  /** Card, hook line, full-song video and lyrics per song id (public/data/band-tracks.json). */
  tracks?: BandTracks;
  className?: string;
}

const LINK =
  'inline-flex min-h-11 items-center font-semibold text-[#f5b335] underline underline-offset-4 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#f6ecd0]';

const BRASS_SHADOW =
  'shadow-[0_6px_12px_-5px_rgb(0_0_0/0.6),0_2px_4px_-2px_rgb(0_0_0/0.4),inset_0_1px_0_rgb(246_236_208/0.12)]';

const fmt = (n: number) => n.toLocaleString('en-US');
const round = (n: number) => Math.round(n * 100) / 100;

/** A made-up pair of songs for the worked example, scored by the real rule. */
function workedExample(w: BandWeights) {
  const day = '2026-01-01';
  const make = (id: string, plays: number, daysAgo: number): BandSong => ({
    id,
    title: id,
    cover: '',
    posted: new Date(Date.parse(`${day}T00:00:00Z`) - daysAgo * 86_400_000)
      .toISOString()
      .slice(0, 10),
    shortUrl: null,
    youtube: { plays, up: 0, down: 0 },
    twitch: { up: 0, down: 0 },
    review: { up: 0, down: 0 },
    site: { up: 5, down: 0 },
  });
  const older = make('older', 300, 60);
  const newer = make('newer', 30, 3);
  return {
    s: score(older, w),
    older: { plays: 300, days: 60, perDay: round(playsPerDay(older, day, w)) },
    newer: { plays: 30, days: 3, perDay: round(playsPerDay(newer, day, w)) },
  };
}

/** Splits the lyrics into stanzas at blank lines. */
function stanzas(lines: readonly string[]): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  for (const l of lines) {
    if (l.trim() === '') {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(l);
  }
  if (cur.length) out.push(cur);
  return out;
}

function TrackBlock({ song, info }: { song: BandSong; info: BandTrackInfo }) {
  return (
    <div className="basis-full space-y-3" data-testid="band-track">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getAssetUrl(info.card)}
        width={600}
        height={600}
        alt={`Card for ${song.title}: ${info.hook}`}
        loading="lazy"
        className="h-auto w-full max-w-md rounded-lg border border-[#b5873a]"
      />
      {info.videoUrl ? (
        <p className="!m-0">
          <a
            href={info.videoUrl}
            rel="noopener noreferrer"
            className={LINK}
            data-testid="full-song-link"
          >
            Watch the full song on YouTube
            <span className="sr-only"> for {song.title}</span>
          </a>
        </p>
      ) : null}
      {info.note ? (
        <p className="!m-0 max-w-[68ch] text-base" data-testid="track-note">
          {info.note}
        </p>
      ) : null}
      {info.lyrics ? (
        <details data-testid="track-lyrics">
          <summary className="min-h-11 cursor-pointer py-2 text-lg font-semibold text-[#f5b335] underline underline-offset-4">
            Full lyrics
            <span className="sr-only"> for {song.title}</span>
          </summary>
          <div className="mt-2 max-w-[68ch] space-y-3 text-base leading-[1.6]">
            {stanzas(info.lyrics).map((s, k) => (
              <p key={k} className="!m-0">
                {s.map((line, j) => (
                  <React.Fragment key={j}>
                    {j > 0 ? <br /> : null}
                    {line}
                  </React.Fragment>
                ))}
              </p>
            ))}
            <p className="!m-0 text-sm italic">
              These are the words we gave the music model. The sung version may
              differ a little.
            </p>
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ScoreRules({ w }: { w: BandWeights }) {
  const ex = workedExample(w);
  return (
    <details className="mt-6 max-w-[68ch]" data-testid="score-rules">
      <summary className="min-h-11 cursor-pointer py-2 text-lg font-semibold text-[#f5b335] underline underline-offset-4">
        How the score works
      </summary>
      <div className="mt-2 space-y-4 text-lg leading-[1.65]">
        <div>
          <h3 className="sh-font-special-elite !mt-0 !mb-2 !text-xl text-[#f6ecd0]">
            What counts
          </h3>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              Votes on this page, from anyone. Anonymous, so they weigh the
              least.
            </li>
            <li>
              Twitch chat votes. One per Twitch account per song, and Twitch
              needs an account holder to be 13 or older.
            </li>
            <li>
              YouTube likes and dislikes. One per signed-in account per song, on
              a service that also needs 13 or older.
            </li>
            <li>
              The owner&apos;s review votes: the like and dislike buttons on the
              band&apos;s private review player. One listener, one vote per
              take.
            </li>
          </ul>
        </div>
        <div>
          <h3 className="sh-font-special-elite !mt-0 !mb-2 !text-xl text-[#f6ecd0]">
            The sum
          </h3>
          <p className="!m-0" data-testid="score-formula">
            S = {w.site} × site net (never more than {w.siteCap} either way) +{' '}
            {w.twitch} × Twitch net + {w.youtube} × YouTube net + {w.owner} ×
            the owner&apos;s review net. Net means up votes minus down votes.
          </p>
          <p className="!mt-3 !mb-0">
            Songs are listed with the highest S first. When S is tied, the song
            with more YouTube plays a day since it was first shown goes first
            (plays divided by days since posted, counted as at least {w.minDays}{' '}
            {w.minDays === 1 ? 'day' : 'days'}). Still tied: the fewest down
            votes, then the title from A to Z. Plays never lower a song&apos;s
            score. A song first shown in the last {w.newDays} days carries a New
            mark.
          </p>
          <p className="!mt-3 !mb-0" data-testid="score-example">
            Example with made-up numbers: two songs both have S = {ex.s}. One
            has {ex.older.plays} plays over {ex.older.days} days (
            {ex.older.perDay} a day); the other has {ex.newer.plays} plays over{' '}
            {ex.newer.days} days ({ex.newer.perDay} a day). The newer one is
            listed first. A song with a higher S is above both, however many
            plays it has.
          </p>
        </div>
        <div>
          <h3 className="sh-font-special-elite !mt-0 !mb-2 !text-xl text-[#f6ecd0]">
            The weights
          </h3>
          <p className="!m-0" data-testid="score-version">
            Version {w.version}, {w.dateLabel}.
          </p>
          <ul
            className="mt-2 list-disc space-y-1 pl-6"
            data-testid="score-weights"
          >
            <li>Site votes: {w.site}</li>
            <li>Twitch chat votes: {w.twitch}</li>
            <li>YouTube likes and dislikes: {w.youtube}</li>
            <li>The owner&apos;s review votes: {w.owner}</li>
            <li>
              Most a song&apos;s site votes can add or take away: {w.siteCap}
            </li>
          </ul>
          <p className="!mt-3 !mb-1 font-semibold">Changes, newest first</p>
          <ul
            className="list-disc space-y-1 pl-6"
            data-testid="score-changelog"
          >
            {w.changelog.map((c) => (
              <li key={`${c.version}-${c.date}`}>
                {c.dateLabel}, version {c.version}: {c.change}
              </li>
            ))}
          </ul>
        </div>
        <p className="!m-0 font-semibold" data-testid="privacy-line">
          {PRIVACY_LINE}
        </p>
      </div>
    </details>
  );
}

/**
 * The ranked Songs part of /band. Static: the list is one JSON file refreshed by a
 * commit (public/data/band-ranking.json), the order comes from the one score rule in
 * src/lib/band/ranking.ts, and the page makes no request of its own. The only live
 * call is the vote write inside BandSongVote.
 */
export default function BandSongs({
  ranking = rankingFile as BandRankingFile,
  weights = weightsFile as BandWeights,
  tracks = tracksFile as BandTracks,
  className,
}: BandSongsProps) {
  const songs = rankSongs(ranking.songs, ranking.asOf, weights);

  return (
    <section
      aria-labelledby="songs"
      data-testid="band-songs"
      className={className}
    >
      <h2
        id="songs"
        className="sh-font-special-elite !mt-0 !mb-2 !text-3xl text-[#f6ecd0] md:!text-4xl"
      >
        Songs
      </h2>
      <p className="!mt-0 !mb-2 max-w-[68ch] text-lg leading-[1.65]">
        The most liked songs are at the top. Every song here was made with an AI
        music model. Counts as of{' '}
        <span data-testid="counts-as-of">{dayLabel(ranking.asOf)}</span>.
      </p>
      <p className="!mt-0 !mb-6 max-w-[68ch] text-lg leading-[1.65]">
        {PRIVACY_LINE}
      </p>
      <ol className="m-0 grid list-none gap-4 p-0">
        {songs.map((song, i) => {
          const mark = newMark(song, ranking.asOf, weights);
          return (
            <li
              key={song.id}
              data-testid="band-song"
              data-song-id={song.id}
              className={`flex flex-wrap items-start gap-4 rounded-2xl border-2 border-[#b5873a] bg-[#2b1f19] p-4 text-[#f6ecd0] sm:p-5 ${BRASS_SHADOW}`}
            >
              <span
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-[#b5873a] bg-[#14172b] text-xl font-bold text-[#f5b335] shadow-[inset_0_2px_6px_rgb(0_0_0/0.7)]"
              >
                {i + 1}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getAssetUrl(song.cover)}
                width={64}
                height={64}
                alt={`Cover for ${song.title}`}
                loading="lazy"
                className="h-16 w-16 shrink-0 rounded-lg border border-[#b5873a]"
              />
              <div className="min-w-0 flex-1 basis-64 space-y-2">
                <h3 className="!m-0 !text-xl text-[#f6ecd0]">
                  <span className="sr-only">Number {i + 1}: </span>
                  {song.title}
                  {mark ? (
                    <span className="ml-3 inline-block rounded-md bg-[#f5b335] px-2 py-0.5 align-middle text-sm font-bold text-[#14172b]">
                      {mark}
                    </span>
                  ) : null}
                </h3>
                <p
                  className="!m-0 text-base leading-snug"
                  data-testid="song-counts"
                >
                  <strong>Score {score(song, weights)}</strong>
                  {' · '}
                  YouTube: {fmt(song.youtube.plays)} plays,{' '}
                  {fmt(song.youtube.up)} likes
                  {' · '}
                  Twitch: {fmt(song.twitch.up)} up, {fmt(song.twitch.down)} down
                  {' · '}
                  This page: {fmt(song.site.up)} up, {fmt(song.site.down)} down
                  {' · '}
                  Owner&apos;s review: {fmt(song.review.up)} up,{' '}
                  {fmt(song.review.down)} down
                </p>
                <p className="!m-0 flex flex-wrap gap-x-6">
                  {song.shortUrl ? (
                    <a
                      href={song.shortUrl}
                      rel="noopener noreferrer"
                      className={LINK}
                    >
                      Watch the Short on YouTube
                      <span className="sr-only"> for {song.title}</span>
                    </a>
                  ) : null}
                  <a
                    href={SHOW_CHANNEL_URL}
                    rel="noopener noreferrer"
                    className={LINK}
                  >
                    ScriptHammer on Twitch
                  </a>
                </p>
                <BandSongVote songId={song.id} title={song.title} />
              </div>
              {tracks[song.id] ? (
                <TrackBlock song={song} info={tracks[song.id]} />
              ) : null}
            </li>
          );
        })}
      </ol>
      <ScoreRules w={weights} />
    </section>
  );
}
