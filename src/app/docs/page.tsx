import type { Metadata } from 'next';
import Link from 'next/link';
import { detectedConfig } from '@/config/project-detected';
import Icon from '@/components/atomic/Icon';
import { DOCS, SECTIONS } from '@/lib/docs/registry';

// Docs index. Audience: someone who just clicked through from the landing
// page with a question. Hierarchy: first-hour path is larger and sits right
// under the h1 with no label; everything below is a reference shelf you scan
// by SITUATION, not by topic. No `card`, no `divider`, no `link-primary`
// flood, no `btn` — same ledger-row discipline as the landing page. Primary
// color appears nowhere (this is navigation, not conversion). Cut from the
// old 6-card grid: dead links (PWA.md, docs/spec-kit/ don't exist), dupes
// (README#anchor = README), "google it" (Next.js docs), Sprint roadmap.
// 13 hardcoded repo URLs → one detectedConfig.projectUrl base.

export const metadata: Metadata = {
  // This route claims its own URL (#668).
  alternates: { canonical: '/docs/' },
  openGraph: { url: '/docs/' },
  title: 'Documentation - ScriptHammer',
  description: 'Documentation index for ScriptHammer — configure, build, ship.',
};

const gh = (path: string) => `${detectedConfig.projectUrl}/blob/main/${path}`;

interface Doc {
  label: string;
  hint: string;
  href: string;
  /** Internal route — renders with <Link> + → instead of <a> + ↗ */
  internal?: boolean;
}

// Tabular data — one row per doc. prettier-ignore keeps each doc on one line
// so the table is scannable in source as well as rendered.

// prettier-ignore
const START_HERE: readonly Doc[] = [
  { label: 'Forking Guide', hint: 'rename · rebrand · deploy',       href: gh('docs/FORKING.md') },
];

// prettier-ignore
const REFERENCE: readonly { when: string; docs: readonly Doc[] }[] = [
  { when: 'Building your first feature', docs: [
    { label: 'Creating Components', hint: 'the 5-file pattern CI enforces', href: gh('docs/CREATING_COMPONENTS.md') },
    { label: 'CLAUDE.md',           hint: 'what the AI agent already knows', href: gh('CLAUDE.md') },
    { label: 'Testing',             hint: 'unit · a11y · E2E',               href: gh('docs/project/TESTING.md') },
  ]},
  { when: 'How the pieces work', docs: [
    { label: 'Security',           hint: 'RLS · Vault · secrets',               href: gh('.github/SECURITY.md') },
    { label: 'Auto-configuration', hint: 'project detection · defaults',        href: '/blog/auto-configuration-system', internal: true },
  ]},
  { when: 'Contributing back', docs: [
    { label: 'Contributing',  hint: 'PR workflow · code style',           href: gh('CONTRIBUTING.md') },
    { label: 'PRP / SpecKit', hint: 'spec → plan → tasks → implement',    href: gh('docs/prp-docs/SPECKIT-PRP-GUIDE.md') },
    { label: 'Changelog',     hint: 'release history',                    href: gh('docs/project/CHANGELOG.md') },
  ]},
];

/** One ledger row. `large` bumps text size + padding for the first-hour tier. */
function DocRow({ doc, large = false }: { doc: Doc; large?: boolean }) {
  // hover:bg-base-content/5 — the content color always contrasts with its
  // base, so 5% alpha gives a consistent ~Δ30 tint on every theme. base-300/50
  // is near-invisible on dracula (its base steps are only ~Δ16 apart).
  const row =
    'group hover:bg-base-content/5 focus-visible:bg-base-content/5 focus-visible:outline-primary flex min-h-11 flex-wrap items-baseline gap-x-4 gap-y-1 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2';
  const size = large ? 'py-5 text-lg sm:text-xl' : 'py-4 text-sm sm:text-base';
  const inner = (
    <>
      <span className="text-base-content font-semibold">{doc.label}</span>
      <span className="text-base-content order-last w-full text-sm sm:order-none sm:ml-auto sm:w-auto">
        {doc.hint}
      </span>
      <span className="text-base-content group-hover:text-base-content transition-all group-hover:translate-x-1">
        {/* Decorative: the row's own label is the accessible name, and every
            external row already announces itself via the visible hint. An
            unlabelled icon here would add noise, not information (#377). */}
        <Icon
          name={doc.internal ? 'chevron-right' : 'external-link'}
          decorative
        />
      </span>
    </>
  );
  return doc.internal ? (
    <Link href={doc.href} className={`${row} ${size}`}>
      {inner}
    </Link>
  ) : (
    <a
      href={doc.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${row} ${size}`}
    >
      {inner}
    </a>
  );
}

export default function DocsPage() {
  const repo = detectedConfig.projectUrl;
  return (
    <main className="bg-base-200 min-h-full">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <h1 className="text-base-content mb-2 text-4xl font-bold tracking-tight sm:text-5xl">
          Documentation
        </h1>

        {/* ── Read here (3a, #380) ────────────────────────────────────────────
          These seven render IN THE APP now, from the markdown already in this
          repo — the comp's rail, made real. Everything below still points at
          GitHub because it has no in-app route yet.

          README, Auth Setup and Accessibility were removed from those shelves
          rather than listed twice: the same document reachable by two routes
          is how a reader ends up on the stale one. */}
        <section aria-labelledby="in-app-heading" className="mb-10">
          <h2
            id="in-app-heading"
            className="text-base-content mb-3 font-mono text-xs tracking-wider uppercase"
          >
            Read here
          </h2>
          <div className="sh-well bg-base-100 rounded-box p-3">
            {SECTIONS.map((section) => {
              const items = DOCS.filter((d) => d.section === section);
              if (!items.length) return null;
              return (
                <div key={section} className="mb-3 last:mb-0">
                  <h3 className="text-base-content mb-1 px-2 font-mono text-[10.5px] tracking-[.14em] uppercase">
                    {section}
                  </h3>
                  <ul>
                    {items.map((d) => (
                      <li key={d.slug}>
                        <Link
                          href={`/docs/${d.slug}`}
                          className="hover:bg-base-200 flex min-h-11 flex-wrap items-baseline gap-x-3 rounded-lg px-3 py-2 transition-colors"
                        >
                          <span className="text-base-content font-semibold">
                            {d.title}
                          </span>
                          <span className="text-base-content text-sm">
                            {d.hint}
                          </span>
                          <span
                            aria-hidden="true"
                            className="text-base-content ml-auto"
                          >
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <p className="text-base-content mb-10 text-base sm:text-lg">
          New here? The first two links get you to{' '}
          {/* A command is an input, and inputs sit in grooves (#377). */}
          <code className="sh-groove bg-base-200 rounded-field px-2 py-1 font-mono text-sm whitespace-nowrap">
            docker compose up
          </code>
          .
        </p>

        {/* Tier 1 — first hour. The 2a treatment maps onto the hierarchy this
            page already had rather than replacing it: the first-hour path is
            the thing you act on, so it is a raised PLATE; the reference shelf
            below is data you scan, so each group is a cut WELL. The rows stay
            flat ledger rows inside them — no `card`, no `btn`, no primary
            colour, per the discipline documented at the top of this file. */}
        <div className="sh-plate bg-base-100 rounded-box px-4 py-2 sm:px-6">
          <ul className="divide-base-300 divide-y">
            {START_HERE.map((doc) => (
              <li key={doc.href}>
                <DocRow doc={doc} large />
              </li>
            ))}
          </ul>
        </div>

        {/* Tier 2 — reference shelf. Grouped by WHEN, not by topic. */}
        {REFERENCE.map((group) => (
          <section key={group.when} className="mt-12">
            <h2 className="text-base-content mb-3 font-mono text-xs tracking-wider uppercase">
              {group.when}
            </h2>
            <div className="sh-well bg-base-100 rounded-box px-4 py-2 sm:px-6">
              <ul className="divide-base-300 divide-y">
                {group.docs.map((doc) => (
                  <li key={doc.href}>
                    <DocRow doc={doc} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}

        {/* prettier-ignore */}
        <p className="text-base-content border-base-300 mt-16 border-t pt-8 text-sm">
          Stuck? Open
          an <a href={`${repo}/issues`} target="_blank" rel="noopener noreferrer" className="link text-base-content">issue</a> or
          start a <a href={`${repo}/discussions`} target="_blank" rel="noopener noreferrer" className="link text-base-content">discussion</a>.
        </p>
      </div>
    </main>
  );
}
