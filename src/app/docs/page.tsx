import type { Metadata } from 'next';
import Link from 'next/link';
import { detectedConfig } from '@/config/project-detected';

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
  title: 'Documentation - ScriptHammer',
  description:
    'Documentation index for ScriptHammer — fork, configure, build, ship.',
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
  { label: 'README',        hint: 'clone · env · docker compose up', href: gh('README.md') },
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
    { label: 'Auth Setup',         hint: 'Supabase · OAuth · magic links',      href: gh('docs/AUTH-SETUP.md') },
    { label: 'Accessibility',      hint: 'WCAG AA · skip links · font scaling', href: gh('docs/ACCESSIBILITY.md') },
    { label: 'Security',           hint: 'RLS · Vault · secrets',               href: gh('docs/project/SECURITY.md') },
    { label: 'Auto-configuration', hint: 'project detection · defaults',        href: '/blog/auto-configuration-system', internal: true },
  ]},
  { when: 'Contributing back', docs: [
    { label: 'Contributing',  hint: 'PR workflow · code style',           href: gh('docs/project/CONTRIBUTING.md') },
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
      <span
        aria-hidden="true"
        className="text-base-content/30 group-hover:text-base-content transition-all group-hover:translate-x-1"
      >
        {doc.internal ? '→' : '↗'}
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
        <p className="text-base-content mb-10 text-base sm:text-lg">
          Just forked? The first two links get you to{' '}
          <code className="font-mono text-sm">docker compose up</code>.
        </p>

        {/* Tier 1 — first hour. Hierarchy is purely typographic: bigger
            rows, no section label, sits directly under the h1. No box —
            same flat-ledger discipline as the landing page. */}
        <ul className="divide-base-300 divide-y">
          {START_HERE.map((doc) => (
            <li key={doc.href}>
              <DocRow doc={doc} large />
            </li>
          ))}
        </ul>

        {/* Tier 2 — reference shelf. Grouped by WHEN, not by topic. */}
        {REFERENCE.map((group) => (
          <section key={group.when} className="mt-12">
            <h2 className="text-base-content mb-3 font-mono text-xs tracking-wider uppercase">
              {group.when}
            </h2>
            <ul className="divide-base-300 divide-y">
              {group.docs.map((doc) => (
                <li key={doc.href}>
                  <DocRow doc={doc} />
                </li>
              ))}
            </ul>
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
