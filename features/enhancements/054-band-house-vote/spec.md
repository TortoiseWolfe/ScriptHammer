# Feature Specification: Ranked songs and anonymous voting on /band

**Feature Branch**: `feat/band-house-vote`
**Created**: 2026-10-28
**Status**: In progress
**Issue**: #1416
**Input**: "start sorting my review list by most popular at the top and down votes at bottom, we'll make that public, we need a page for the house band at ScriptHammer.com anyways" and "the website should also be a voting surface, but with more weight to logged in viewers and public about how that algorithm is weighted" (owner, 2026-10-28). Full order: the hub's `house-band-page-spec.md` and `purge-button.md`.

Extends `/band` (feature 052) below the show block. It is not a new page.

## What visitors get

- **Songs**: every song in rank order, with a small cover (alt text), public counts (YouTube plays and likes, Twitch votes, votes on this page, the owner's review votes), a link to the song's Short on YouTube and a link to the ScriptHammer Twitch channel. Plain links, no embeds, no audio player.
- **Up and down buttons** on each song, anonymous (see Privacy). They appear only when the deploy turns voting on (`NEXT_PUBLIC_BAND_VOTE_OPEN=true`), which happens after the database function exists on the hosted project. Until then the list shows with no buttons.
- **"How the score works"**: a closed box with every input, the sum, the tie-break, a worked example, the current weights, a version and date, a change log and the privacy line.
- **/HouseBand and /houseband** lead to `/band` (GitHub Pages is case-sensitive; Next's `redirects()` does not run in a static export, so each is a small static page with a meta refresh).
- A "Counts as of Wed 28 Oct" date and a plain statement that the songs were made with an AI music model.

## The score (Version 1, 29 Oct 2026)

`S = 1 x site net (capped at 25 either way) + 3 x Twitch net + 3 x YouTube net + 3 x the owner's review net`, where net is up minus down.

Order: `S` highest first; then YouTube plays a day since the song was posted (at least 1 day); then fewest down votes in total; then title A to Z. Plays never lower a score. A song first shown in the last 14 days carries a "New, N days old" mark.

The weights live in one file, `public/data/band-weights.json`. The page text is rendered from it, and `BandSongs.test.tsx` fails when the text and the file disagree (it changes the weights and checks the text follows). The ranking code is `src/lib/band/ranking.ts`.

## The list

`public/data/band-ranking.json` is refreshed by a person committing a diff, never by a scheduled job. Takes of the same words show once, with their numbers added. A purged take or a song on the re-render list (n02, n04, n06, psy-3, psy-3b) never reaches the file: `buildRanking` drops them before grouping, so their numbers cannot add to a partner take. The list-builder script on the tower (OBS_MCP_bot) is a separate change.

## Privacy (every visitor counts as under 13)

- The only live call is one plain POST to `cast_band_vote` on the existing Supabase project (not the Supabase client library, so no session or token is stored). `credentials: omit`, no referrer, no store.
- The server keeps counters only: song id, hour (rounded down), up, down, requests. No row per voter, no account, cookie, device id or address kept by us.
- One vote per song per device is enforced by a flag in the browser's own storage that never leaves it. A visitor may change a vote once.
- Abuse limit with no identifier: 30 requests per song per hour and 300 overall; past a cap the function records nothing and answers "later".
- `band_site_votes` has row-level security with no policy and every table privilege revoked from `anon` and `authenticated`; `anon` may run `cast_band_vote` and nothing else.
- The platform's own gateway sees the visitor's address as any web host does. Treating that as fine rests on the Rule's internal-operations text (16 CFR 312.2); this is an inference, not a settled point.
- Content Security Policy: `connect-src` already allows `https://*.supabase.co`; nothing changes.

## Known limits (accepted, from the spec's own design)

- **A changed vote trusts the browser's word about the old vote.** With no account there is nothing to check it against. The harm is bounded: each request still counts against the caps, a changed vote moves a counter by at most 2, and a song's site votes are capped at 25 points either way in the score. The hourly counters may go negative; the sum stays right.
- **A flood can use up the hourly caps and show "later" to real visitors.** That is the price of having no address-based limit (the owner chose no identifiers). The signed-in sources (Twitch, YouTube, the owner's review votes) are unaffected, and the site's share of a score cannot pass 25 points.

## Content gate

Every public string passes `CONTENT-RULE.md`: nothing may read as a figure near a child or as an invitation aimed at children. `BandSongs.test.tsx` checks every title, every cover description and all page text against banned wording.

## Shipping

The migration block sits in `supabase/migrations/20251006_complete_monolithic_setup.sql` and must be applied to the hosted project by hand (no workflow applies it). After it is applied: set the repository variable `NEXT_PUBLIC_BAND_VOTE_OPEN` to `true` and re-run the Pages deploy. The daily production drift check reports `band_site_votes` until then.
