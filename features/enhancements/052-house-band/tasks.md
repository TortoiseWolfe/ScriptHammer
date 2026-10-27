# Tasks: House Band (/band)

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Issue**: #1408

## PR 1: the page, theme and hook

- [x] T001 Kid-safe route list `src/lib/privacy/kid-safe-routes.ts` + unit test
- [x] T002 Wire it into GoogleAnalytics, OpenAIPixel, SentryMonitor, `utils/analytics.ts`, `captureAppError` + tests
- [x] T003 Re-encode and check audio; encode portraits and cover to `public/band/`
- [x] T004 `src/lib/band/roster.ts`, `songs.ts` + unit tests (7 unique slugs, files exist, alt text, basePath)
- [x] T005 Generate BandMemberCard, ThemeSongPlayer, BandRoster (5-file each)
- [x] T006 `src/app/band/page.tsx`, metadata, OG image
- [x] T007 GlobalNav Demos leaf, sitemap, pa11y entry
- [x] T008 `public/sw.js`: no MP3 precache, range requests pass; test
- [x] T009 `/credits` Band section, `public/band/NOTICE.md`, `credits.json`
- [x] T010 `tests/e2e/band.spec.ts` (+ basepath project)
- [x] T011 Design pass at 1440 and 390, every theme; independent critique; fixes
- [x] T012 Format, lint, type-check, tests, gitleaks; PR "Closes #1408"; squash-merge on green
- [x] T013 Live check: assets 200, tracker-free network log, screenshots

## PR 2: Halloween release (open, merged by the hub on Sat 31 Oct 2026)

- [x] T014 Duet MP3s encoded and checked; two players, duet lyrics, two singers (Ivory and Chops), "Where the facts come from" note
- [ ] T015 Tests extended; every check green; leave open

## PR 3: the show block (Thu 29 Oct 2026)

- [x] T016 `src/lib/band/show.ts` (slots in UTC, city times from the tz database, state check, calendar file builder) + tests
- [x] T017 `BandShow` (5-file), a client component that stops saying "coming up" once the replay is over
- [x] T018 `public/band/the-band-wagon.ics` (4 slots), og:description and twitter:description name the show and date
- [x] T019 e2e: show block, calendar file 200, social text, "over" state with a pinned clock
