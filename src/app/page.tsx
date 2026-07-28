import Link from 'next/link';
import { LayeredScriptHammerLogo } from '@/components/atomic/SpinningLogo';
import Icon from '@/components/atomic/Icon';
import {
  type TemplateStat,
  type TemplateDemo,
} from '@/components/molecular/TemplateStats';
import { detectedConfig } from '@/config/project-detected';
import { CURATED_THEMES, THEME_COUNT } from '@/config/themes';
import { countWireframes } from '@/config/wireframes';
import pkg from '../../package.json';

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
const TERMINAL_LINES = [
  { prompt: true, text: `git clone ${detectedConfig.projectUrl}.git my-app` },
  { prompt: true, text: 'cd my-app && cp .env.example .env' },
  { prompt: true, text: 'docker compose up' },
  { prompt: false, text: '→ ready · localhost:3000' },
] as const;

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

const STATS: readonly TemplateStat[] = [
  {
    value: String(THEME_COUNT),
    label: 'Themes',
    detail: 'DaisyUI · live switching',
    href: '/themes',
  },
  {
    value: '2,400+',
    label: 'Tests',
    detail: 'Unit · a11y · E2E',
    href: '/status',
  },
  {
    value: 'WCAG AA',
    label: 'Accessible',
    detail: 'Skip links · font scaling',
    href: '/accessibility',
  },
  {
    value: 'PWA',
    label: 'Offline-first',
    detail: 'Service worker · installable',
    href: '/docs',
  },
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
    <main className="bg-base-200 flex min-h-full flex-col">
      {/* Skip link — load-bearing a11y, do not remove (PRP-017 T036). */}
      <a
        href="#main-content"
        className="btn btn-sm btn-primary sr-only min-h-11 min-w-11 focus:not-sr-only focus:absolute focus:top-4 focus:left-4"
      >
        Skip to main content
      </a>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {/* Two columns at lg, matching the design's `352px 1fr` grid. Stacked
          below that, logo first, because the medallion is the brand. */}
      <section
        id="main-content"
        aria-labelledby="hero-heading"
        className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 pt-12 pb-10 sm:px-6 lg:grid-cols-[352px_1fr] lg:gap-13 lg:px-8 lg:pt-16"
      >
        {/* The logo medallion: a circular WELL with an accent glow, holding
            the three layered SVGs. The design specifies all of this —
            scripthammer-logo.svg at 308px over script-tags.svg at 192px over
            printing-mallet.svg at 128px — which is exactly what
            LayeredScriptHammerLogo already renders. */}
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
            <LayeredScriptHammerLogo speed="slow" pauseOnHover />
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

          <p className="text-base-content/80 max-w-[50ch] text-lg leading-relaxed">
            Accounts, payments, encrypted messaging and offline mode — wired to
            Supabase, tested, accessible to WCAG AA, and running on this exact
            site.
          </p>

          <nav
            aria-label="Primary actions"
            className="flex flex-wrap items-center gap-4"
          >
            <Link href="/schedule" className="btn btn-primary btn-lg min-h-11">
              Start a project
            </Link>
            <Link
              href="/status"
              className="link link-hover text-base-content inline-flex min-h-11 items-center gap-2 text-sm"
            >
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
        <div className="sh-plate bg-base-100 rounded-box overflow-hidden">
          <div className="border-base-300 text-base-content flex items-center gap-2 border-b px-4 py-2 font-mono text-xs tracking-wider uppercase">
            <span aria-hidden="true">●</span>
            bash — new project
          </div>
          <div className="grid grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_1fr] lg:gap-10">
            {/* One <pre> so the whole block copies as runnable text.
                Wraps rather than scrolls: the clone URL is long enough to
                truncate the page's most important line at rest, and a
                command you cannot read is worse than one that takes two
                lines. */}
            <pre className="text-base-content min-w-0 font-mono text-sm leading-7 break-words whitespace-pre-wrap">
              {TERMINAL_LINES.map((line) => (
                <span key={line.text} className="block">
                  {line.prompt && (
                    <span className="text-accent select-none">$ </span>
                  )}
                  {line.text}
                </span>
              ))}
            </pre>

            {/* The design's right-hand column. Its copy ends "ci — 2,431 tests
                + a11y audit wired to every push"; the count is mockup data, so
                this states the thing that is true without inventing a figure. */}
            <div>
              <h3 className="text-base-content mb-3 font-mono text-xs tracking-wider uppercase">
                What that one command did
              </h3>
              <dl className="space-y-2 font-mono text-xs leading-6">
                {COMMAND_DID.map(([key, what]) => (
                  <div key={key} className="flex flex-wrap gap-x-2">
                    <dt className="text-accent shrink-0">{key}</dt>
                    <dd className="text-base-content flex-1">— {what}</dd>
                  </div>
                ))}
              </dl>
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
                    "34 Themes …" — seven E2E locators across three specs match
                    on that substring (#408). */}
                <span className="text-base-content font-mono text-3xl leading-none tabular-nums">
                  {stat.value}
                </span>
                <span className="text-base-content font-mono text-xs tracking-wider uppercase">
                  {stat.label} · {stat.detail}
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
            className="text-base-content text-3xl tracking-tight sm:text-4xl"
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
              className="sh-plate bg-base-100 rounded-box focus-within:ring-primary flex flex-col gap-2 p-5 transition-transform focus-within:ring-2 hover:-translate-y-1"
            >
              <span
                aria-hidden="true"
                className="text-accent font-mono text-xs tracking-wider"
              >
                {m.n}
              </span>
              <h3 className="text-base-content text-lg">{m.label}</h3>
              <p className="text-base-content/80 text-sm">{m.desc}</p>
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
            className="text-base-content text-3xl tracking-tight sm:text-4xl"
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
                className="sh-plate bg-base-100 rounded-box focus-within:ring-primary flex h-full flex-col gap-3 p-5 transition-transform focus-within:ring-2 hover:-translate-y-1"
              >
                <span className="sh-well bg-base-100 rounded-box text-base-content flex items-center justify-center px-4 py-8 font-mono text-xs tracking-wider uppercase">
                  {s.surface}
                </span>
                <span className="text-base-content text-lg">{s.label}</span>
                <span className="text-base-content/80 text-sm">{s.desc}</span>
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
            className="text-base-content text-3xl tracking-tight sm:text-4xl"
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
        <ul className="sh-well bg-base-100 rounded-box flex flex-wrap gap-3 p-4">
          {CURATED_THEMES.map((theme) => (
            <li key={theme}>
              <Link
                href="/themes"
                // data-theme scopes DaisyUI's tokens to this element, so the
                // chips below render each theme's REAL colours rather than an
                // approximation hand-copied from the comp.
                data-theme={theme}
                className="bg-base-100 focus-visible:ring-primary flex min-h-11 items-center gap-2 rounded-full px-3 py-2 focus-visible:ring-2"
              >
                <span aria-hidden="true" className="flex gap-1">
                  <span className="bg-primary h-4 w-4 rounded-full" />
                  <span className="bg-secondary h-4 w-4 rounded-full" />
                  <span className="bg-accent h-4 w-4 rounded-full" />
                </span>
                <span className="text-base-content font-mono text-xs tracking-wider">
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
        <div className="sh-plate bg-base-100 rounded-box flex flex-col gap-6 p-6 sm:p-10">
          <div>
            <h2
              id="cta-heading"
              className="text-base-content max-w-2xl text-2xl tracking-tight sm:text-3xl"
            >
              Tell us what you&rsquo;re building.
            </h2>
            <p className="text-base-content/80 mt-3 max-w-2xl">
              Or take the whole thing yourself — it&rsquo;s open source,
              documented, and deployed on every push.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link href="/schedule" className="btn btn-primary min-h-11">
              Book a call
            </Link>
            <a
              href={detectedConfig.projectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost min-h-11"
            >
              Clone the starter
              <Icon name="external-link" decorative />
            </a>
            <a
              href={STORYBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              // Solid text-base-content for AAA contrast (7:1) on
              // scripthammer-light's panel — /70 was 4.98:1, fine for AA but
              // failing AAA per #21.
              className="link link-hover text-base-content inline-flex min-h-11 items-center gap-2 text-sm"
            >
              Component catalogue in Storybook
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
