#!/usr/bin/env node
/**
 * Bring the votes cast on /band into the ranking, at build time (#1527).
 *
 * THE GAP. A visitor's vote is stored by `cast_band_vote` in the table `band_site_votes`, and
 * nothing ever read it back. Every song's `site` count in public/data/band-ranking.json stayed 0,
 * so the votes changed nothing the page showed.
 *
 * WHAT THIS DOES. Before `pnpm run build`, deploy.yml runs this script. It asks the database
 * function get_band_vote_totals for each song's up and down counts, and rewrites ONLY each song's
 * `site` counts in the build checkout's copy of the file. Nothing is committed: `main` is
 * protected and no job here pushes to it. The next deploy reads the table again, so the page is
 * as fresh as the last deploy.
 *
 * WHAT IT DOES NOT TOUCH. `asOf` stays as it is. It dates the YouTube, Twitch and review counts,
 * and `playsPerDay` divides by the days between a song's `posted` day and `asOf`, so moving it
 * would quietly change the tie-break order for reasons unrelated to votes.
 *
 * THE KEY. Only the public anon key is used (NEXT_PUBLIC_SUPABASE_ANON_KEY, the same one the page
 * ships). The table is closed to every client role, so the read goes through get_band_vote_totals,
 * a read-only SECURITY DEFINER function that anon may run and that returns only song id, up and
 * down (see the BAND PAGE VOTE TOTALS section of the monolithic migration). No service-role key is
 * involved, which keeps service-role-key-not-in-pr-ci.test.js (#575) green.
 *
 * NEVER GATES. A deploy that fails because a vote count could not be read is worse than a page
 * with older counts. With no key (a fork), no URL, or any read error, the file is left exactly as
 * it was and the script exits 0 and says which of those it was.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * @param {{asOf: string, songs: Array<{id: string, site: {up: number, down: number}}>}} ranking
 * @param {Array<{song_id: string, up: number, down: number}>} rows  rows from get_band_vote_totals
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

/**
 * Calls get_band_vote_totals() and returns its rows: one {song_id, up, down} per song with votes.
 * Throws on any non-200 answer or an answer that is not a list.
 */
export async function readVoteTotals(url, key, fetchImpl = fetch) {
  const res = await fetchImpl(`${url}/rest/v1/rpc/get_band_vote_totals`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!res.ok)
    throw new Error(`get_band_vote_totals answered HTTP ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows))
    throw new Error('get_band_vote_totals did not answer a list');
  return rows;
}

async function main() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) {
    console.log(
      `band ranking: left as committed (${!url ? 'no NEXT_PUBLIC_SUPABASE_URL' : 'no NEXT_PUBLIC_SUPABASE_ANON_KEY'}).`
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
    const rows = await readVoteTotals(url, key);
    const before = JSON.parse(readFileSync(file, 'utf8'));
    const after = applySiteVotes(before, rows);
    writeFileSync(file, `${JSON.stringify(after, null, 2)}\n`);
    const up = after.songs.reduce((n, s) => n + s.site.up, 0);
    const down = after.songs.reduce((n, s) => n + s.site.down, 0);
    console.log(
      `band ranking: ${rows.length} song totals read; site votes now ${up} up, ${down} down across ${after.songs.length} songs.`
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
