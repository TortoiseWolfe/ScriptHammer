import Link from 'next/link';
import { LayeredScriptHammerLogo } from '@/components/atomic/SpinningLogo';
import { AnimatedLogo } from '@/components/atomic/AnimatedLogo';
import TemplateStats, {
  type TemplateStat,
  type TemplateDemo,
} from '@/components/molecular/TemplateStats';
import { detectedConfig } from '@/config/project-detected';

// ── Hosted-demo landing — audience is a developer deciding whether to
//     fork. Visual hierarchy: spinning logo + animated title draw the eye,
//     one `btn-primary` is the only filled button, proof numbers below. ──
//
// Server component: logo and animated-title are 'use client' internally,
// but this page itself ships zero client JS beyond those islands.

const STATS: readonly TemplateStat[] = [
  {
    value: '32',
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
  { label: 'Wireframes', href: '/wireframes' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Contact', href: '/contact' },
];

const STORYBOOK_URL = 'https://tortoisewolfe.github.io/ScriptHammer/storybook/';

// Promoted hero card — stands alone above the grouped grid.
const PRODUCTION_READY = {
  emoji: '🚀',
  label: 'Production Ready',
  desc: 'CI/CD pipeline, 2,400+ tests, Lighthouse monitoring, GitHub Pages deploy on every push',
  href: '/status',
  ariaLabel: 'Rocket launch',
} as const;

const FEATURES = [
  {
    emoji: '🎨',
    label: '32 Themes',
    desc: 'Light & dark with live switching',
    href: '/themes',
    ariaLabel: 'Artist palette',
  },
  {
    emoji: '📐',
    label: 'Wireframes',
    desc: '46 interactive SVG design specs',
    href: '/wireframes',
    ariaLabel: 'Triangular ruler',
  },
  {
    emoji: '📱',
    label: 'PWA Ready',
    desc: 'Installable with offline support',
    href: '/docs',
    ariaLabel: 'Mobile phone',
  },
  {
    emoji: '♿',
    label: 'Accessible',
    desc: 'WCAG compliant & customizable',
    href: '/accessibility',
    ariaLabel: 'Wheelchair accessibility symbol',
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

      {/* ── Tier 1: Hero ─────────────────────────────────────────────── */}
      <section
        id="main-content"
        aria-labelledby="hero-heading"
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
      >
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:gap-16">
          {/* Logo — responsive sizing, spins slowly, pauses on hover */}
          <div className="flex-shrink-0">
            <div className="h-48 w-48 sm:h-52 sm:w-52 md:h-56 md:w-56 lg:h-[350px] lg:w-[350px]">
              <LayeredScriptHammerLogo speed="slow" pauseOnHover />
            </div>
          </div>

          {/* Content — stacked below logo on mobile, beside it on desktop */}
          <div className="text-center lg:text-left">
            <h1 id="hero-heading" className="mb-4 sm:mb-6">
              <AnimatedLogo
                text={detectedConfig.projectName}
                className="!text-2xl font-bold sm:!text-3xl md:!text-5xl lg:!text-6xl"
                animationSpeed="normal"
              />
            </h1>

            <p className="text-base-content/80 mb-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              Auth, payments, messaging, and offline support are already wired
              to Supabase and tested. Fork it, change the theme, start on your
              features.
            </p>

            {/* Tech stack badges */}
            <div
              className="mb-8 flex flex-wrap justify-center gap-2 lg:justify-start"
              role="list"
              aria-label="Technology stack"
            >
              {[
                'Next.js 15.5',
                'React 19',
                'TypeScript',
                'Tailwind CSS',
                'PWA Ready',
              ].map((tech) => (
                <span
                  key={tech}
                  role="listitem"
                  className="badge badge-outline badge-sm sm:badge-md"
                >
                  {tech}
                </span>
              ))}
            </div>

            <nav
              aria-label="Primary actions"
              className="flex flex-col items-center gap-4 lg:items-start"
            >
              <a
                href={`${detectedConfig.projectUrl}/generate`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-lg min-h-11 min-w-11"
              >
                Use this template
              </a>
              <a
                href={STORYBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="link link-hover text-base-content/70 hover:text-base-content inline-flex min-h-11 items-center gap-2 text-sm"
              >
                or explore the component catalogue in Storybook
                <span aria-hidden="true">→</span>
              </a>
            </nav>
          </div>
        </div>
      </section>

      {/* ── Tiers 2 & 3: proof + demos ───────────────────────────────── */}
      <TemplateStats stats={STATS} demos={DEMOS} />

      {/* ── Gradient: base-100 → base-200 (smooth transition from TemplateStats) */}
      <div
        aria-hidden="true"
        className="h-16 sm:h-24"
        style={{
          background:
            'linear-gradient(to bottom, var(--color-base-100), var(--color-base-200))',
        }}
      />

      {/* ── Feature cards — 1 promoted + 4 grouped ───────────────────── */}
      <section
        aria-label="Key features"
        className="px-4 pt-4 pb-12 sm:px-6 lg:px-8"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <h2 className="sr-only">Key Features</h2>

          {/* Promoted: Production Ready. Full-width, primary border accent,
              horizontal layout on sm+ so the longer copy can breathe. Border
              uses the DaisyUI semantic token so it holds across all 32 themes. */}
          <Link
            href={PRODUCTION_READY.href}
            className="card bg-base-100 border-primary focus-within:ring-primary border-2 shadow-md transition-all focus-within:ring-2 hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="card-body flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
              <div
                className="shrink-0 text-5xl"
                role="img"
                aria-label={PRODUCTION_READY.ariaLabel}
              >
                {PRODUCTION_READY.emoji}
              </div>
              <div>
                <h3 className="card-title text-lg">{PRODUCTION_READY.label}</h3>
                <p className="text-base-content/85 text-sm">
                  {PRODUCTION_READY.desc}
                </p>
              </div>
            </div>
          </Link>

          {/* Grouped: remaining 4 in a 2×2 / 4-wide grid */}
          <div className="grid grid-cols-1 gap-4 min-[500px]:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="card bg-base-100 focus-within:ring-primary shadow-md transition-all focus-within:ring-2 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="card-body items-center p-4 text-center">
                  <div
                    className="mb-3 text-3xl"
                    role="img"
                    aria-label={f.ariaLabel}
                  >
                    {f.emoji}
                  </div>
                  <h3 className="card-title text-base">{f.label}</h3>
                  <p className="text-base-content/85 text-xs">{f.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
