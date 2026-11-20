#!/usr/bin/env node
/**
 * Bring the votes cast on /band into the ranking, at build time (#1527).
 *
 * THE GAP. A visitor's vote is stored by `cast_band_vote` in the table `band_site_votes`, and
 * nothing ever read it back. Every song's `site` count in public/data/band-ranking.json stayed 0,
 * so the votes changed nothing the page showed.
 *
 * WHAT THIS DOES. Before `pnpm run build`, deploy.yml runs this script. It reads the table with the
 * service role key, adds up the up and down counts for each song, and rewrites ONLY each song's
 * `site` counts in the build checkout's copy of the file. Nothing is committed: `main` is
 * protected and no job here pushes to it. The next deploy reads the table again, so the page is
 * as fresh as the last deploy.
 *
 * WHAT IT DOES NOT TOUCH. `asOf` stays as it is. It dates the YouTube, Twitch and review counts,
 * and `playsPerDay` divides by the days between a song's `posted` day and `asOf`, so moving it
 * would quietly change the tie-break order for reasons unrelated to votes.
 *
 * THE KEY. SUPABASE_SERVICE_ROLE_KEY comes from the environment and is never printed or written.
 * The table has its privileges revoked from anon and authenticated, so only the service role can
 * read it, and no migration is needed.
 *
 * NEVER GATES. A deploy that fails because a vote count could not be read is worse than a page
 * with older counts. With no key (a fork), no URL, or any read error, the file is left exactly as
 * it was and the script exits 0 and says which of those it was.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PAGE = 1000;

/**
 * @param {{asOf: string, songs: Array<{id: string, site: {up: number, down: number}}>}} ranking
 * @param {Array<{song_id: string, up: number, down: number}>} rows  rows of band_site_votes
 * @returns the ranking with each song's `site` set to the sum of its rows. A song with no rows
 *   gets 0 and 0. A row for an id the file does not list is ignored. The input is not changed.
 */
export function applySiteVotes(ranking, rows) {
  const totals = new Map();
  for (const row of rows) {
    const t = totals.get(row.song_id) ?? { up: 0, down: 0 };
    t.up += Number(row.up) || 0;
    t.down += Number(row.down) || 0;
    totals.set(row.song_id, t);
  }
  return {
    ...ranking,
    songs: ranking.songs.map((song) => ({
      ...song,
      site: totals.get(song.id) ?? { up: 0, down: 0 },
    })),
  };
}

/** Reads every row of band_site_votes, a page at a time. Throws on any non-200 answer. */
export async function readVoteRows(url, key, fetchImpl = fetch) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetchImpl(
      `${url}/rest/v1/band_site_votes?select=song_id,up,down&order=song_id,hour&limit=${PAGE}&offset=${offset}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) throw new Error(`band_site_votes answered HTTP ${res.status}`);
    const page = await res.json();
    if (!Array.isArray(page))
      throw new Error('band_site_votes did not answer a list');
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

async function main() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    console.log(
      `band ranking: left as committed (${!url ? 'no NEXT_PUBLIC_SUPABASE_URL' : 'no SUPABASE_SERVICE_ROLE_KEY'}).`
    );
    return;
  }
  const file = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'public',
    'data',
    'band-ranking.json'
  );
  try {
    const rows = await readVoteRows(url, key);
    const before = JSON.parse(readFileSync(file, 'utf8'));
    const after = applySiteVotes(before, rows);
    writeFileSync(file, `${JSON.stringify(after, null, 2)}\n`);
    const up = after.songs.reduce((n, s) => n + s.site.up, 0);
    const down = after.songs.reduce((n, s) => n + s.site.down, 0);
    console.log(
      `band ranking: ${rows.length} vote rows read; site votes now ${up} up, ${down} down across ${after.songs.length} songs.`
    );
  } catch (err) {
    // The message names the HTTP status or the parse problem, never the key or a header.
    console.log(`::warning::band ranking: left as committed (${err.message}).`);
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  await main();
}
