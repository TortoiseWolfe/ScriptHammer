/**
 * The ranked song list on /band, and the one score rule behind it.
 *
 * Score S = site x site net (capped) + twitch x Twitch net + youtube x YouTube net
 * + owner x the owner's review votes. Net is up votes minus down votes. Plays never
 * lower a score: ties on S go to plays a day since the song was posted, then to the
 * fewest down votes, then to the title.
 *
 * The weights live in public/data/band-weights.json and nowhere else; the page text
 * reads them from there and a test fails when the two disagree. The list lives in
 * public/data/band-ranking.json and is refreshed by a commit, never by a job.
 *
 * Pure functions only, no three.js and no browser APIs, so the kid-safe /band page
 * stays light.
 */

export interface Votes {
  up: number;
  down: number;
}

export interface BandSong {
  /** Stable id for the SONG (not one take). Also the id the vote function accepts. */
  id: string;
  title: string;
  /** Path under /public; run it through getAssetUrl before use. */
  cover: string;
  /** Day the song was first shown, as YYYY-MM-DD. */
  posted: string;
  /** The song's Short on YouTube, or null when it has none. */
  shortUrl: string | null;
  youtube: { plays: number; up: number; down: number };
  twitch: Votes;
  /** The owner's own votes on the private review player. */
  review: Votes;
  /** Anonymous votes cast on the page. */
  site: Votes;
}

export interface BandRankingFile {
  /** Day the numbers were taken, as YYYY-MM-DD. */
  asOf: string;
  songs: BandSong[];
}

export interface WeightsChange {
  version: number;
  date: string;
  dateLabel: string;
  change: string;
}

export interface BandWeights {
  version: number;
  date: string;
  dateLabel: string;
  site: number;
  twitch: number;
  youtube: number;
  owner: number;
  siteCap: number;
  minDays: number;
  newDays: number;
  changelog: WeightsChange[];
}

/** A take as the list builder sees it: a song plus the group of takes it belongs to. */
export interface BandTake extends BandSong {
  /** Takes of the same words share a group; the group becomes the song's id. */
  group: string;
}

export const net = (v: Votes): number => v.up - v.down;

const clamp = (n: number, cap: number): number =>
  Math.max(-cap, Math.min(cap, n));

/** The score S of one song. */
export function score(song: BandSong, w: BandWeights): number {
  return (
    w.site * clamp(net(song.site), w.siteCap) +
    w.twitch * net(song.twitch) +
    w.youtube * net({ up: song.youtube.up, down: song.youtube.down }) +
    w.owner * net(song.review)
  );
}

export function totalDown(song: BandSong): number {
  return (
    song.site.down + song.twitch.down + song.youtube.down + song.review.down
  );
}

const DAY_MS = 86_400_000;

/** Whole days between two YYYY-MM-DD days (UTC midnight to UTC midnight). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS
  );
}

/** YouTube plays divided by days since posted, never fewer than minDays. */
export function playsPerDay(
  song: BandSong,
  asOf: string,
  w: BandWeights
): number {
  const days = Math.max(w.minDays, daysBetween(song.posted, asOf));
  return song.youtube.plays / days;
}

/** Highest S first; then plays a day; then fewest down votes; then title. */
export function compareSongs(
  a: BandSong,
  b: BandSong,
  asOf: string,
  w: BandWeights
): number {
  return (
    score(b, w) - score(a, w) ||
    playsPerDay(b, asOf, w) - playsPerDay(a, asOf, w) ||
    totalDown(a) - totalDown(b) ||
    a.title.localeCompare(b.title, 'en')
  );
}

export function rankSongs<T extends BandSong>(
  songs: readonly T[],
  asOf: string,
  w: BandWeights
): T[] {
  return [...songs].sort((a, b) => compareSongs(a, b, asOf, w));
}

/** "New, 3 days old" for a song first shown in the last newDays days; otherwise null. */
export function newMark(
  song: BandSong,
  asOf: string,
  w: BandWeights
): string | null {
  const age = daysBetween(song.posted, asOf);
  if (age < 0 || age > w.newDays) return null;
  if (age === 0) return 'New, posted today';
  return `New, ${age} ${age === 1 ? 'day' : 'days'} old`;
}

const sum = (a: Votes, b: Votes): Votes => ({
  up: a.up + b.up,
  down: a.down + b.down,
});

/**
 * Takes of the same words show once: the better-ranked take supplies the Short, the
 * cover and the title; every take's numbers are added together; the earliest posting
 * day stands.
 */
export function mergeTakes(
  takes: readonly BandTake[],
  asOf: string,
  w: BandWeights
): BandSong {
  const best = rankSongs(takes, asOf, w)[0];
  const total = takes.reduce<BandSong>(
    (acc, t) => ({
      ...acc,
      posted: t.posted < acc.posted ? t.posted : acc.posted,
      youtube: {
        plays: acc.youtube.plays + t.youtube.plays,
        up: acc.youtube.up + t.youtube.up,
        down: acc.youtube.down + t.youtube.down,
      },
      twitch: sum(acc.twitch, t.twitch),
      review: sum(acc.review, t.review),
      site: sum(acc.site, t.site),
    }),
    {
      ...best,
      posted: best.posted,
      youtube: { plays: 0, up: 0, down: 0 },
      twitch: { up: 0, down: 0 },
      review: { up: 0, down: 0 },
      site: { up: 0, down: 0 },
    }
  );
  return {
    id: best.group,
    title: best.title,
    cover: best.cover,
    posted: total.posted,
    shortUrl: best.shortUrl,
    youtube: total.youtube,
    twitch: total.twitch,
    review: total.review,
    site: total.site,
  };
}

/**
 * Builds the list file from takes. A purged take, or one held back for a re-render,
 * is dropped BEFORE grouping: it never appears and its numbers never add to a partner
 * take's numbers.
 */
export function buildRanking(input: {
  takes: readonly BandTake[];
  /** Take ids on the tower's purged.json. */
  purged: readonly string[];
  /** Take ids held out until a re-render passes the content gate. */
  held: readonly string[];
  weights: BandWeights;
  asOf: string;
}): BandRankingFile {
  const out = new Set([...input.purged, ...input.held]);
  const groups = new Map<string, BandTake[]>();
  for (const take of input.takes) {
    if (out.has(take.id)) continue;
    groups.set(take.group, [...(groups.get(take.group) ?? []), take]);
  }
  const songs = [...groups.values()].map((g) =>
    mergeTakes(g, input.asOf, input.weights)
  );
  return {
    asOf: input.asOf,
    songs: rankSongs(songs, input.asOf, input.weights),
  };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** "Wed 28 Oct" from a YYYY-MM-DD day, the same on every machine. */
export function dayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
