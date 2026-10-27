# Feature Specification: House Band (/band)

**Feature Branch**: `feat/052-house-band`
**Created**: 2026-10-27
**Status**: In progress
**Issue**: #1408
**Input**: "just add them to the open source template for now ... free advertising, free music to sell the drinks (Service in SaaS at a premium) putting the art, culture and music back into mass produced AI slop" (owner, 2026-10-25)

ScriptHammer's house band is seven animatronic bots. They look a little scary and play for everyone: **LOOKS SCARY. PLAYS NICE.** `/band` is a free page of music and art that points visitors to the paid services (the "drinks": `/pricing` and `/schedule`).

No wireframe gate: feature 051 is the precedent. The pull request carries real screenshots of the running page instead.

## User Scenarios

### US1 - Meet the band (P1)

A visitor opens `/band`, sees the cover, the tagline and seven member cards (portrait, name, instrument, role), and understands who the band is without reading anything else.

- **Given** a visitor on `/band`, **then** exactly seven cards render, each with a portrait that has alt text, a name, an instrument and a role.
- Member names and roles come from one list (`src/lib/band/roster.ts`) that also feeds later features.

### US2 - Hear the theme (P1)

A visitor presses play on the theme song or the hook and hears it. Nothing plays by itself.

- **Given** the page has loaded, **then** no audio request has been made (`preload="none"`) and nothing autoplays.
- Each player is a native `<audio controls>`; the lyrics sit under it in a closed `<details>`.
- The MP3 is served as `audio/mpeg`, supports range requests, and is not precached by the service worker.

### US3 - Book or buy (P2)

A visitor who likes the band can follow plain links to `/schedule` ("Book the band") and `/pricing` ("Keep your site playing"). Neither is a checkout.

### US4 - A kid-safe route (P1)

A child may be the visitor. `/band` is **directed to children** in COPPA's sense (16 CFR 312.2), so every visitor is treated as under 13, and a cookie banner is not a parent's consent.

- **Given** consent was granted on `/`, **when** the visitor navigates client-side to `/band`, **then** no request goes to Google Tag Manager, Google Analytics, the OpenAI pixel host or Sentry, and no `page_view` is sent.
- `/band` has no forms, accounts, comments, embeds or outside fonts.

## Requirements

- **FR-001** `src/app/band/page.tsx` is a server component and imports no three.js.
- **FR-002** `src/lib/band/roster.ts` holds seven members with unique slugs, and lives outside `src/twin`, stage, world and `lib/cod`.
- **FR-003** BandMemberCard, ThemeSongPlayer and BandRoster follow the 5-file pattern.
- **FR-004** Every asset URL goes through `getAssetUrl`.
- **FR-005** One shared list of kid-safe routes (`src/lib/privacy/kid-safe-routes.ts`) is read by GoogleAnalytics, OpenAIPixel, SentryMonitor and the gtag helpers.
- **FR-006** On a kid-safe route no tracker script is rendered, Sentry is closed, gtag calls are dropped, and `ga-disable-<id>` is set for a script already loaded elsewhere.
- **FR-007** GlobalNav has a Band leaf in Demos; `/band` is in the sitemap and in `config/pa11yci.json`.
- **FR-008** `/credits` has a Band section read from `public/band/credits.json`; `public/band/NOTICE.md` states the licenses.
- **FR-009** Music and art are CC BY-SA 4.0; the code stays MIT. The music is AI-generated (ACE-Step 1.5) and the art is AI-assisted (tool not recorded); both are said plainly in NOTICE.md and on `/credits`.
- **FR-010** If the page names the show: LIVE Thursday 29 October, opening set 6:00 to 7:30 PM and headline 8:00 to 10:00 PM Eastern; REPLAY Saturday 31 October (Halloween), same two slots. No other date appears on the page.
- **FR-011** Design numbers at 1440 and 390 wide: 0 widowed headings, body 17 px or more at line-height about 1.65 and a 60 to 75ch measure, 0 overlapping elements, 0 contrast failures in every theme, shadows from the site's `--sh-plate` scale.

## Out of scope

- The duet tracks (PR 2, "New for Halloween", merged on Sat 31 Oct 2026).
- The stage in `/chatt` (feature 053).
- Care Plan checkout links (both Care Plans are coming-soon, #1211).
