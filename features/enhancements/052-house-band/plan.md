# Implementation Plan: House Band (/band)

**Spec**: [spec.md](./spec.md) | **Issue**: #1408

## Shape

Static page, no server code, no database. Everything is a build-time import.

| Piece               | Path                                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| Roster data         | `src/lib/band/roster.ts`                                                         |
| Lyrics data         | `src/lib/band/songs.ts`                                                          |
| Kid-safe list       | `src/lib/privacy/kid-safe-routes.ts`                                             |
| Components (5-file) | `src/components/molecular/BandMemberCard`, `ThemeSongPlayer`, `BandRoster`       |
| Page                | `src/app/band/page.tsx` (+ `opengraph` image from `public/band/og-1200x630.jpg`) |
| Assets              | `public/band/{members,cover,audio}/`, `NOTICE.md`, `credits.json`                |

## Kid-safe route

One module exports `KID_SAFE_ROUTES` and `isKidSafeRoute(pathname)` (trailing-slash and basePath tolerant) and `isKidSafeLocation()` (reads `window.location`). Readers:

1. `GoogleAnalytics`: renders nothing and sets `window['ga-disable-<id>']` on a kid-safe route; the page-view effect returns early.
2. `OpenAIPixel`: renders nothing and clears the stored click id.
3. `SentryMonitor`: closes Sentry on a kid-safe route; `captureAppError` also checks the location.
4. `utils/analytics.ts`: `trackEvent`, `trackPageView`, `trackWebVital`, `trackError` drop calls on a kid-safe location, which covers a gtag already loaded before client-side navigation.

## Audio

Source MP3s are re-encoded to about 128 kbps in a container, then checked with ffprobe (duration, non-silent, peak at or under -1 dB). `public/sw.js` must not precache `.mp3` and must let `Range` requests through; a unit test pins both.

## Design pass

Built from the site's own components and fonts, night palette from the cover. Measured with Playwright at 1440 and 390 in every theme, then critiqued by a subagent that did not build it, before the PR opens.

## Tests

Unit (roster, assets, basePath, kid-safe list, tracker gates), a11y (one per component), `tests/e2e/band.spec.ts` (also in the `basepath` project), first-load budget check stays green.
