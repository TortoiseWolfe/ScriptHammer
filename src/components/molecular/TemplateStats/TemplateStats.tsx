import Link from 'next/link';

export interface TemplateStat {
  /** Big number / short claim — rendered in monospace */
  value: string;
  /** What the number counts */
  label: string;
  /** One-line supporting detail */
  detail: string;
  /** Link to the proof page (internal route) */
  href: string;
}

export interface TemplateDemo {
  /** Link text */
  label: string;
  /** Route or URL */
  href: string;
  /** Open in new tab (external link) */
  external?: boolean;
}

export interface TemplateStatsProps {
  /** Headline capability numbers. Each links to its proof page. */
  stats: readonly TemplateStat[];
  /** Secondary demo links — low visual weight, for the curious. */
  demos?: readonly TemplateDemo[];
  /** Additional CSS classes for the outer wrapper */
  className?: string;
}

/**
 * TemplateStats — the "proof" ledger of a template landing page.
 *
 * Renders capability numbers as full-width link rows — number · label ·
 * detail — separated by hairline rules. Deliberately NOT the DaisyUI `stats`
 * widget: that component's boxed-cells-with-vertical-dividers silhouette is
 * the single most recognizable "this page used DaisyUI" tell. This is a
 * plain <ul> with tabular-figure mono numbers. Spec sheet, not dashboard.
 *
 * Numbers are `text-base-content`, NOT `text-primary`. The primary color is
 * reserved for the fork button in the hero — nothing else on the page gets
 * it. If big numbers down here are the same hue as the CTA up there, the
 * eye doesn't know where to land. Hierarchy through color discipline: one
 * primary-colored thing, one decision.
 *
 * Every color is a DaisyUI semantic token. Opacity floor is /70 — synthwave's
 * base-content is ~9:1 inherent contrast, so /60 drops to 3.96 (misses AA 4.5).
 * Verified: light / dracula / synthwave in TemplateStats.stories.tsx.
 *
 * @category molecular
 */
export default function TemplateStats({
  stats,
  demos,
  className = '',
}: TemplateStatsProps) {
  return (
    <section
      aria-label="Template capabilities"
      className={`border-base-300 bg-base-100 border-t${className ? ` ${className}` : ''}`}
    >
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/*
          Ledger rows. Each <li>'s entire width is the hit target — you
          click the row, not the number. `tabular-nums` keeps the digit
          column right-edge aligned across rows so "32" and "2,400+" read
          as a column even without drawing one.

          Mobile: number + label + arrow on line 1, detail wraps below.
          ≥sm:    number + label, detail pushed right by ml-auto, arrow.
        */}
        <ul className="divide-base-300 divide-y">
          {stats.map((stat) => (
            <li key={stat.href}>
              <Link
                href={stat.href}
                className="group hover:bg-base-content/5 focus-visible:bg-base-content/5 focus-visible:outline-primary flex min-h-11 flex-wrap items-baseline gap-x-4 gap-y-1 py-5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                <span className="text-base-content font-mono text-2xl tabular-nums sm:text-3xl">
                  {stat.value}
                </span>
                <span className="text-base-content font-semibold">
                  {stat.label}
                </span>
                <span className="text-base-content/70 order-last w-full text-sm sm:order-none sm:ml-auto sm:w-auto">
                  {stat.detail}
                </span>
                <span
                  aria-hidden="true"
                  className="text-base-content/30 group-hover:text-base-content transition-all group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Demos — tertiary nav, deliberately quiet */}
        {demos && demos.length > 0 && (
          <nav
            aria-label="Live demos"
            className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3"
          >
            <span className="text-base-content/70 font-mono text-xs tracking-wider uppercase">
              Live demos
            </span>
            {demos.map((demo) =>
              demo.external ? (
                <a
                  key={demo.href}
                  href={demo.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-hover text-base-content/80 hover:text-base-content inline-flex min-h-11 items-center text-sm"
                >
                  {demo.label}
                </a>
              ) : (
                <Link
                  key={demo.href}
                  href={demo.href}
                  className="link link-hover text-base-content/80 hover:text-base-content inline-flex min-h-11 items-center text-sm"
                >
                  {demo.label}
                </Link>
              )
            )}
          </nav>
        )}
      </div>
    </section>
  );
}
