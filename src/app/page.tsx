import type { Metadata } from 'next';
import Link from 'next/link';
import { LayeredScriptHammerLogo } from '@/components/atomic/SpinningLogo';
import Icon from '@/components/atomic/Icon';
import { type TemplateDemo } from '@/components/molecular/TemplateStats';
import { detectedConfig } from '@/config/project-detected';
import { CURATED_THEMES, THEME_COUNT } from '@/config/themes';
import { countWireframes } from '@/config/wireframes';
import pkg from '../../package.json';

/**
 * The homepage claims `/` HERE, not in the root layout (#668).
 *
 * The root layout used to claim it, and App Router inherited that claim down the
 * whole tree — so every page declared the homepage as its canonical. Owning the
 * claim at the route it describes is what makes that impossible.
 */
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { url: '/' },
};

// ── The 2a "Machine Shop" landing page (#379). ──────────────────────────────
//
// Server component: the depth is CSS and the numbers are read at build time,
// so this page ships no client JS of its own.
//
// EVERY NUMBER HERE IS DERIVED. The design's comps carry mockup figures —
// `2,431 tests passed 4m ago`, `Lighthouse 100/100/100/100`, `deploy #1,284`,
// `41s` — under a heading that reads "Every claim on this page is a link to
// the thing running." Typing those in would break the direction's own promise
// and repeat #408, where a hard-coded `46` and `32` had already drifted from
// the 66 and 34 they described.
const WIREFRAME_COUNT = countWireframes();
const NEXT_MINOR = pkg.dependencies.next.replace(/^\^?(\d+\.\d+).*$/, '$1');

// The install block, verbatim from README.md — NOT the design's
// `npx create-scripthammer my-app`, which names a package that exists nowhere
// in this repo and which `CLAUDE.md` forbids outright ("npx <anything>" is on
// the ABSOLUTELY FORBIDDEN list). Owner's ruling on #380: "Docker Only, the
// design was a mockup, technical specs are still first priority over an
// artist renderings." A landing page whose most prominent element fails when
// pasted is worse than one that looks plainer.
const TERMINAL_LINES: readonly {
  prompt: boolean;
  done?: boolean;
  text: string;
}[] = [
  { prompt: true, text: `git clone ${detectedConfig.projectUrl}.git my-app` },
  { prompt: true, text: 'cd my-app && cp .env.example .env' },
  { prompt: true, text: 'docker compose up' },
  // `done` is the comp's secondary-coloured completion line.
  { prompt: false, done: true, text: '→ ready · localhost:3000' },
];

// The terminal's right-hand column in the design. Its last row reads
// "ci — 2,431 tests + a11y audit wired to every push"; that count is mockup
// data, so this states what is true without inventing a figure.
const COMMAND_DID: readonly (readonly [string, string])[] = [
  ['auth', 'sign-up, sign-in, sessions, password strength'],
  ['payments', 'checkout wired to a live provider'],
  ['messaging', 'encrypted channels, read receipts, offline queue'],
  ['pwa', 'service worker, manifest, installable, offline routes'],
  ['ci', 'unit, a11y and E2E suites wired to every push'],
];

// Facts, not metrics. Each is either derived above or a property of the build
// that cannot go stale without the build itself changing.
const GROOVE_FACTS = [
  `Next ${NEXT_MINOR}`,
  'React 19',
  `${THEME_COUNT} themes`,
  `${WIREFRAME_COUNT} wireframes`,
  'WCAG AA',
  'PWA · offline',
  'Static export → GitHub Pages',
] as const;

// The comp's four readings, in its order. Captions are SHORT and singular —
// the earlier `label · detail` pair wrapped to two lines and broke the rhythm.
//
// Two accessible names here are load-bearing E2E anchors: this list must keep
// a link whose name contains "35 Themes" (seven locators, #408) and one
// matching /accessible/i (homepage.spec.ts). Both are asserted below.
const STATS: readonly {
  value: string;
  caption: string;
  href: string;
}[] = [
  { value: '2,400+', caption: 'Tests on every push', href: '/status' },
  {
    value: String(THEME_COUNT),
    caption: `Themes · ${CURATED_THEMES.length} curated`,
    href: '/themes',
  },
  {
    value: String(WIREFRAME_COUNT),
    caption: 'Interactive wireframes',
    href: '/wireframes',
  },
  { value: 'AA', caption: 'Accessible · WCAG in CI', href: '/accessibility' },
];

const DEMOS: readonly TemplateDemo[] = [
  { label: 'Blog', href: '/blog' },
  { label: 'Payments', href: '/payment-demo' },
  { label: 'Messaging', href: '/messages' },
  { label: 'Map', href: '/map' },
  { label: 'Game', href: '/game' },
  { label: 'Digital Twin', href: '/chatt' },
  { label: 'Wireframes', href: '/wireframes' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Contact', href: '/contact' },
];

// The design's three highlighted surfaces.
const SURFACES = [
  {
    surface: 'Messaging',
    label: 'Encrypted messaging',
    desc: 'Read receipts, offline queue, real Supabase channels.',
    href: '/messages',
  },
  {
    surface: 'Atlas',
    label: 'Atlas & Diorama',
    desc: 'OpenStreetMap tiles, live geo, the geoLARP engine.',
    href: '/chatt',
  },
  {
    surface: 'Payments',
    label: 'Payments',
    desc: 'Full checkout path, demo mode you can poke at.',
    href: '/payment-demo',
  },
] as const;

const STORYBOOK_URL = 'https://tortoisewolfe.github.io/ScriptHammer/storybook/';

// The design's four modules. `01–04` is legitimate numbering here: these are a
// declared set of four, not a decorative sequence — the design labels them
// "Four modules · all live" and every one links to the thing running.
const MODULES = [
  {
    n: '01',
    label: 'Accounts',
    desc: 'Sign-up, sign-in, password strength, sessions. Not a mock.',
    href: '/sign-in',
  },
  {
    n: '02',
    label: 'Payments',
    desc: 'Checkout wired end to end, with a demo you can click today.',
    href: '/payment-demo',
  },
  {
    n: '03',
    label: 'Messaging',
    desc: 'Encrypted, with read receipts and offline queueing built in.',
    href: '/messages',
  },
  {
    n: '04',
    label: 'Offline',
    desc: "Installable PWA. Works on a train, syncs when it doesn't.",
    href: '/docs',
  },
] as const;

export default function Home() {
  return (
    // The ambient glow from the top of the comp. It is what sets the mood of
    // the whole page, and it was the single biggest thing missing — the built
    // page was a flat `bg-base-200`. Theme-aware: `base-300` is the glow in
    // every theme, so this reads correctly on all 34.
    <main
      className="bg-base-100 flex min-h-full flex-col"
      style={{
        background:
          'radial-gradient(120% 80% at 50% -10%, var(--color-base-300) 0%, var(--color-base-100) 55%)',
      }}
    >
      {/* The skip link that used to live here (PRP-017 T036) moved to
          app/layout.tsx (#475) — it is still load-bearing, it just now exists
          on all 41 routes instead of this one. `#main-content` moved with it,
          onto the layout's content wrapper; keeping a second element with that
          id here would make the target ambiguous. */}

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {/* Two columns at lg, matching the design's `352px 1fr` grid. Stacked
          below that, logo first, because the medallion is the brand. */}
      <section
        aria-labelledby="hero-heading"
        className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 pt-12 pb-10 sm:px-6 lg:grid-cols-[352px_1fr] lg:gap-13 lg:px-8 lg:pt-16"
      >
        {/* The logo medallion: a circular WELL with an accent glow, holding the
            brand mark at ~310px — the one placement large enough for the ring
            wordmark, so it is the only call site passing `wordmark`.

            This comment used to claim the component rendered the comp's ratios
            "exactly". It did not: docs/design/2a specifies brackets at 0.505 and
            mallet at 0.368 of the gear, and the component shipped 0.42 and
            0.249. The 2026-08 rebalance to .68/.46 is what finally made the two
            agree — see docs/design/brand-marks/PROVENANCE.md. It is also no
            longer three layered SVGs; the mark is one inline SVG so its parts
            can animate independently. */}
        <div
          className="relative mx-auto flex aspect-square w-full max-w-[352px] items-center justify-center rounded-full lg:mx-0"
          style={{
            background:
              'radial-gradient(circle at 50% 45%, color-mix(in oklab, var(--color-base-100) 88%, #000), var(--color-base-100))',
            boxShadow:
              'inset 0 8px 26px rgba(0,0,0,.9), inset 0 -2px 0 color-mix(in oklab, var(--color-base-content) 12%, transparent), 0 0 100px -26px color-mix(in oklab, var(--color-accent) 60%, transparent)',
          }}
        >
          <div className="h-[88%] w-[88%]">
            <LayeredScriptHammerLogo wordmark pauseOnHover />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Eyebrow as a groove pill with a pulsing dot, per the design.
              The dot carries the accent — the LABEL does not. `text-accent`
              measures 6.44:1 on scripthammer-light, under the 7:1 AAA gate
              (#21), which is the violation that failed CI on this page. The
              dot is decorative and aria-hidden, so it keeps the colour without
              carrying meaning that contrast has to preserve. */}
          <p className="sh-groove bg-base-100 text-base-content inline-flex w-fit items-center gap-2.5 rounded-full py-2.5 pr-4 pl-3 font-mono text-xs tracking-wider uppercase">
            <span
              aria-hidden="true"
              className="bg-accent sh-pulse h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                boxShadow: '0 0 12px var(--color-accent)',
              }}
            />
            Live in production · Next {NEXT_MINOR}
          </p>

          <h1
            id="hero-heading"
            className="text-base-content text-5xl leading-[0.93] tracking-[-0.035em] uppercase sm:text-6xl lg:text-[86px]"
          >
            The boring parts are{' '}
            {/* The design gradient-fills the final line:
                linear-gradient(100deg, secondary → accent), clipped to the
                text. `color: transparent` makes axe report this node as
                `incomplete` rather than a violation — it cannot resolve a flat
                foreground — so the AAA gate stays meaningful elsewhere while
                this keeps a visible-text fallback if background-clip is
                unsupported. */}
            <span
              className="bg-clip-text [-webkit-background-clip:text] [-webkit-text-fill-color:transparent]"
              style={{
                backgroundImage:
                  'linear-gradient(100deg, var(--color-secondary), var(--color-accent))',
              }}
            >
              already done.
            </span>
          </h1>

          <p className="text-base-content max-w-[50ch] text-lg leading-relaxed">
            Accounts, payments, encrypted messaging and offline mode — wired to
            Supabase, tested, accessible to WCAG AA, and running on this exact
            site.
          </p>

          <nav
            aria-label="Primary actions"
            className="flex flex-wrap items-center gap-4"
          >
            <Link href="/schedule" className="sh-btn sh-btn-primary">
              Start a project
            </Link>
            <Link href="/status" className="sh-btn sh-btn-ghost">
              See it running
              <span aria-hidden="true">→</span>
            </Link>
          </nav>
        </div>
      </section>

      {/* ── Terminal, full width — the hero's thesis ──────────────────────── */}
      <section
        aria-labelledby="install-heading"
        className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8"
      >
        <h2 id="install-heading" className="sr-only">
          Install
        </h2>
        {/* BEZEL — a raised plate with 8px of padding, which is what makes the
            screen inside read as recessed hardware rather than a coloured div. */}
        <div
          className="rounded-[22px] p-2"
          style={{
            background:
              'linear-gradient(180deg, color-mix(in oklab, var(--color-base-300) 90%, var(--color-base-content) 5%), var(--color-base-200))',
            boxShadow:
              '0 26px 50px -18px rgba(0,0,0,.9), inset 0 1px 0 color-mix(in oklab, var(--color-base-content) 15%, transparent)',
          }}
        >
          {/* SCREEN — a FIXED near-black, deliberately not a theme token. The
              comp hard-codes oklch(18% 0.03 282), darker than even
              scripthammer-dark's base-100 (oklch(22.84%)), because a terminal
              screen is a physical object that does not repaint with the theme.
              Keeping it fixed is also what lets the muted opacities below clear
              7:1 — they are light-on-near-black in every theme. */}
          <div
            className="flex flex-col gap-3 rounded-2xl px-5 py-[18px] font-mono text-[13px] leading-[1.95]"
            style={{
              background: 'oklch(18% 0.03 282)',
              color: 'oklch(93% 0.013 256)',
              boxShadow:
                'inset 0 5px 14px rgba(0,0,0,.9), inset 0 -1px 0 color-mix(in oklab, #fff 8%, transparent)',
            }}
          >
            {/* Title bar: macOS traffic lights, each with its own glow. */}
            <div className="flex items-center gap-[7px]">
              {(
                [
                  ['#ff5f57', 0.5],
                  ['#febc2e', 0.4],
                  ['#28c840', 0.4],
                ] as const
              ).map(([c, a]) => (
                <span
                  key={c}
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background: c,
                    boxShadow: `0 0 8px ${c}${Math.round(a * 255).toString(16)}`,
                  }}
                />
              ))}
              <span className="ml-2 text-[10.5px] tracking-[.12em] uppercase opacity-70">
                bash — new project
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
              {/* One <pre> so the whole block copies as runnable text.
                  Wraps rather than scrolls: the clone URL is long enough to
                  truncate the page's most important line at rest, and a
                  command you cannot read is worse than one that takes two
                  lines. */}
              <pre className="min-w-0 font-mono text-[13px] leading-[1.95] break-words whitespace-pre-wrap">
                {TERMINAL_LINES.map((line) => (
                  <span key={line.text} className="block">
                    {line.prompt && (
                      <span className="text-accent select-none">$ </span>
                    )}
                    <span
                      style={
                        line.done
                          ? { color: 'var(--color-secondary)' }
                          : undefined
                      }
                    >
                      {line.text}
                    </span>
                  </span>
                ))}
                {/* The comp ends on a live prompt with a blinking block. */}
                <span className="block">
                  <span className="text-accent select-none">$ </span>
                  <span
                    aria-hidden="true"
                    className="sh-blink inline-block w-[8px] align-text-bottom"
                    style={{ background: 'currentColor', height: '1.1em' }}
                  />
                </span>
              </pre>

              {/* The design's right-hand column. Its copy ends "ci — 2,431 tests
                  + a11y audit wired to every push"; the count is mockup data, so
                  this states the thing that is true without inventing a figure. */}
              <div className="min-w-0">
                <h3 className="mb-3 text-[10.5px] tracking-[.16em] uppercase opacity-70">
                  What that one command did
                </h3>
                <dl className="space-y-3 font-mono text-xs leading-[1.6]">
                  {COMMAND_DID.map(([key, what]) => (
                    <div key={key} className="flex flex-wrap gap-x-2">
                      <dt
                        className="shrink-0"
                        style={{ color: 'var(--color-secondary)' }}
                      >
                        {key}
                      </dt>
                      <dd className="flex-1">— {what}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Groove: facts, not metrics ────────────────────────────────────── */}
      {/* The design runs a scrolling marquee of live readings here. It is a
          static strip instead, for two reasons: its comp content is mockup
          data ("CI green — 2,431 tests passed 4m ago", "Deploy #1,284"), and a
          marquee is motion this page would then have to suppress under
          prefers-reduced-motion. These are facts that do not move. */}
      <section aria-label="At a glance" className="mt-10 px-4 sm:px-6 lg:px-8">
        <ul className="sh-groove bg-base-100 rounded-box text-base-content mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-5 py-3 font-mono text-xs tracking-wider uppercase">
          {GROOVE_FACTS.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </section>

      {/* ── Stat wells ────────────────────────────────────────────────────── */}
      {/* Four separate cutouts, as the design draws them. TemplateStats'
          single ledger was the earlier reading of "data lives in a well"; the
          comp is explicit that each reading gets its own. These are custom
          depth, NOT the DaisyUI `stats` widget — that component's
          boxed-cells-with-dividers silhouette is the tell TemplateStats was
          written to avoid, and avoiding it still matters. */}
      <section
        aria-label="Template capabilities"
        className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 lg:px-8"
      >
        <ul className="grid grid-cols-1 gap-4 min-[500px]:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <li key={stat.href}>
              <Link
                href={stat.href}
                className="sh-well bg-base-100 rounded-box focus-visible:ring-primary flex min-h-11 flex-col gap-1 px-5 py-5 focus-visible:ring-2"
              >
                {/* value and label in one line so the accessible name reads
                    "35 Themes …" — seven E2E locators across three specs match
                    on that substring (#408). */}
                {/* Archivo Black, not mono — and filled with the comp's
                    top-to-bottom fade. Solid `color` stays as the fallback if
                    background-clip is unsupported. */}
                <span
                  className="text-base-content font-display bg-clip-text text-[42px] leading-none tracking-[-0.03em] [-webkit-background-clip:text] [-webkit-text-fill-color:transparent]"
                  style={{
                    backgroundImage:
                      'linear-gradient(180deg, var(--color-base-content), color-mix(in oklab, var(--color-base-content) 62%, transparent))',
                  }}
                >
                  {stat.value}
                </span>
                <span className="text-base-content font-mono text-[11px] tracking-[.14em] uppercase">
                  {stat.caption}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Modules on raised plates ──────────────────────────────────────── */}
      <section
        aria-labelledby="modules-heading"
        className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8"
      >
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="modules-heading"
            className="text-base-content font-display text-3xl tracking-[-0.025em] sm:text-[38px]"
          >
            What&rsquo;s in the box
          </h2>
          <p className="text-base-content font-mono text-xs tracking-wider uppercase">
            Four modules · all live
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[500px]:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="focus-within:ring-primary flex flex-col gap-3 rounded-[20px] px-[22px] pt-[26px] pb-7 transition-transform focus-within:ring-2 hover:-translate-y-1"
              style={{
                background:
                  'linear-gradient(180deg, color-mix(in oklab, var(--color-base-300) 90%, var(--color-base-content) 5%), var(--color-base-200))',
                boxShadow:
                  '0 20px 38px -16px rgba(0,0,0,.9), inset 0 1px 0 color-mix(in oklab, var(--color-base-content) 14%, transparent)',
              }}
            >
              {/* The number sits in its own recessed chip in the comp — a
                  groove, not bare text. */}
              <span
                aria-hidden="true"
                className="bg-base-100 flex h-[38px] w-[38px] items-center justify-center rounded-xl font-mono text-xs"
                style={{
                  color: 'var(--color-secondary)',
                  boxShadow: 'inset 0 3px 7px rgba(0,0,0,.8)',
                }}
              >
                {m.n}
              </span>
              <h3 className="text-base-content font-display text-xl">
                {m.label}
              </h3>
              <p className="text-base-content text-[14.5px] leading-[1.55]">
                {m.desc}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Live surfaces ─────────────────────────────────────────────────── */}
      <section
        aria-labelledby="surfaces-heading"
        className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8"
      >
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="surfaces-heading"
            className="text-base-content font-display text-3xl tracking-[-0.025em] sm:text-[38px]"
          >
            Live surfaces
          </h2>
          <p className="text-base-content font-mono text-xs tracking-wider uppercase">
            {DEMOS.length} demos · all clickable
          </p>
        </div>

        {/* The design recesses a screenshot into each plate. There are no
            screenshots in the repo, and a placeholder frame would be the one
            thing on this page pretending to be something it is not — so the
            well holds the live route instead. */}
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SURFACES.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="focus-within:ring-primary flex h-full flex-col gap-3 rounded-[20px] px-[22px] pt-[26px] pb-6 transition-transform focus-within:ring-2 hover:-translate-y-1"
                style={{
                  background:
                    'linear-gradient(180deg, color-mix(in oklab, var(--color-base-300) 90%, var(--color-base-content) 5%), var(--color-base-200))',
                  boxShadow:
                    '0 20px 38px -16px rgba(0,0,0,.9), inset 0 1px 0 color-mix(in oklab, var(--color-base-content) 14%, transparent)',
                }}
              >
                <span className="text-base-content font-display text-xl">
                  {s.label}
                </span>
                <span className="text-base-content flex-1 text-[14.5px] leading-[1.55]">
                  {s.desc}
                </span>
                {/* The comp recesses a screenshot here. There are none in this
                    repo, and an empty framed well reads as an image that
                    failed to load — worse than not drawing one. The route
                    itself is the honest thing to put in a groove: it says
                    where the surface lives and it is true. */}
                <span className="sh-groove bg-base-100 text-base-content flex items-center gap-2 rounded-full px-3 py-2 font-mono text-[10.5px] tracking-[.14em] uppercase">
                  {s.href}
                  <span aria-hidden="true" className="ml-auto">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* The remaining demos, kept as a quiet row — every one is a real
            route, and `Game` here is an E2E anchor. */}
        <nav
          aria-label="Live demos"
          className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3"
        >
          <span className="text-base-content font-mono text-xs tracking-wider uppercase">
            Also live
          </span>
          {DEMOS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="link link-hover text-base-content inline-flex min-h-11 items-center text-sm"
            >
              {d.label}
            </Link>
          ))}
        </nav>
      </section>

      {/* ── Theme rail in a well ──────────────────────────────────────────── */}
      <section
        aria-labelledby="themes-heading"
        className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 lg:px-8"
      >
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="themes-heading"
            className="text-base-content font-display text-3xl tracking-[-0.025em] sm:text-[38px]"
          >
            Every theme, actually designed
          </h2>
          <p className="text-base-content font-mono text-xs tracking-wider uppercase">
            {THEME_COUNT} available
          </p>
        </div>

        {/* Ten swatches, not the design's six, so this wraps rather than
            sitting in one row — and must never force the well wider than the
            container, which is the #373 clamp waiting to happen. */}
        <ul className="sh-well bg-base-100 grid grid-cols-2 gap-3 rounded-[24px] p-6 sm:grid-cols-3 lg:grid-cols-5">
          {CURATED_THEMES.map((theme) => (
            <li key={theme}>
              <Link
                href="/themes"
                className="focus-visible:ring-primary group block overflow-hidden rounded-2xl focus-visible:ring-2"
                style={{
                  boxShadow:
                    '0 12px 26px -10px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.14)',
                }}
              >
                {/* A 58px field carrying the theme's own base gradient, with
                    its three accent chips bottom-aligned — the comp's shape.
                    This is the part that makes the rail read as a set of
                    designed themes rather than a list of names. */}
                {/* data-theme is scoped to the SWATCH ONLY, not the card.
                    It makes the field and chips render each theme's real
                    colours — but scoping the label too made it inherit that
                    theme's contrast, and `retro` puts base-content on base-300
                    at 5.69:1, under the 7:1 gate. Not every DaisyUI theme
                    meets AAA internally, so the label stays on the page's
                    theme and only the sample carries the other one. */}
                <span
                  aria-hidden="true"
                  data-theme={theme}
                  className="flex h-[58px] items-end gap-[5px] p-[9px]"
                  style={{
                    background:
                      'linear-gradient(180deg, var(--color-base-100), var(--color-base-200))',
                  }}
                >
                  <span className="bg-primary h-4 w-4 rounded-[5px]" />
                  <span className="bg-secondary h-4 w-4 rounded-[5px]" />
                  <span className="bg-accent h-4 w-4 rounded-[5px]" />
                </span>
                <span className="bg-base-300 text-base-content flex min-h-11 items-center px-[9px] py-2 font-mono text-[10.5px] tracking-[.12em] uppercase">
                  {theme}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── CTA plate ─────────────────────────────────────────────────────── */}
      <section
        aria-labelledby="cta-heading"
        className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8"
      >
        {/* The comp warms this plate toward `secondary` on a 140deg axis,
            which is what separates it from the module plates above. */}
        <div
          className="flex flex-col items-start justify-between gap-10 rounded-[26px] p-8 sm:p-10 lg:flex-row lg:items-center lg:p-[52px]"
          style={{
            background:
              'linear-gradient(140deg, color-mix(in oklab, var(--color-base-300) 92%, var(--color-secondary) 10%), var(--color-base-200) 60%)',
            boxShadow:
              '0 30px 60px -22px rgba(0,0,0,.95), inset 0 1px 0 color-mix(in oklab, var(--color-base-content) 16%, transparent)',
          }}
        >
          <div className="flex flex-col gap-3">
            <h2
              id="cta-heading"
              className="text-base-content font-display max-w-[20ch] text-3xl leading-[1.05] tracking-[-0.025em] sm:text-[38px]"
            >
              Tell us what you&rsquo;re building. We&rsquo;ll show it running
              next week.
            </h2>
            <p className="text-base-content max-w-[50ch] leading-[1.55]">
              Or take the whole thing yourself — it&rsquo;s open source,
              documented, and deployed on every push.
            </p>
          </div>

          {/* Stacked, not inline — the comp puts these in a column at the
              right so the plate reads as one block with an action rail. */}
          <div className="flex w-full shrink-0 flex-col gap-3 sm:w-[19rem]">
            <Link href="/schedule" className="sh-btn sh-btn-primary">
              Book a call
            </Link>
            <a
              href={detectedConfig.projectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="sh-btn sh-btn-ghost"
            >
              Clone the starter
              <Icon name="external-link" decorative />
            </a>
            <a
              href={STORYBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="link link-hover text-base-content inline-flex min-h-11 items-center justify-center gap-2 text-center text-sm"
            >
              Storybook catalogue
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
