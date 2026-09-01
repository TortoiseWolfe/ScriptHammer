#!/usr/bin/env node
/**
 * The complete list of what a fork must configure, DERIVED from deploy.yml.
 *
 * WHY DERIVED. `deploy.yml` reads 38 distinct `NEXT_PUBLIC_*` values. The fork docs
 * described 18 of them at best, and none of them said which of the two GitHub tabs a
 * value belongs in. A hand-typed table is stale the day someone adds a variable —
 * which is exactly how the docs got to 18.
 *
 * So the NAMES and the TAB come from the workflow, and only the consequence is
 * written by hand. A key in the workflow with no consequence recorded is an error,
 * because silently arriving is the defect this fixes.
 *
 * Usage:
 *   node scripts/ci/env-inventory.mjs            # print the table
 *   node scripts/ci/env-inventory.mjs --check    # fail if docs/deck disagree
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  '..'
);
const WORKFLOW = path.join(ROOT, '.github/workflows/deploy.yml');
const CHECKLIST = path.join(ROOT, 'docs/FORK-CHECKLIST.md');

export const START = '<!-- env-inventory:start -->';
export const END = '<!-- env-inventory:end -->';

/**
 * What breaks without each value, and which group it belongs to.
 *
 * Ordered by consequence, not alphabetically: the first group stops the app working,
 * the second makes it lie about its own address, and the rest are features that are
 * simply absent.
 *
 * THERE IS NO LONGER A "STOPS THE DEPLOY" GROUP, and that is the point of #987. It held
 * exactly one value — NEXT_PUBLIC_PAGESPEED_API_KEY — which stopped a site existing
 * while nothing in the repo read it. Every value here now degrades a feature; none of
 * them prevents publishing.
 */
export const GROUPS = [
  [
    'Stops the app working',
    [
      [
        'NEXT_PUBLIC_SUPABASE_URL',
        'No accounts, payments or messaging. The site builds and shows a "not configured" banner.',
      ],
      [
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'Same. Both are VARIABLES — put them in Secrets and they arrive empty, the deploy goes green, and the site ships with no backend.',
      ],
    ],
  ],
  [
    'Makes the site advertise the wrong address',
    [
      [
        'NEXT_PUBLIC_DEPLOY_URL',
        'Canonicals, sitemap, robots.txt and og:image fall back to a github.io origin. Also used as a fallback for asset retention when NEXT_PUBLIC_SITE_URL is unset.',
      ],
      [
        'NEXT_PUBLIC_SITE_URL',
        'Same family: the origin the app reports as its own. This is the one retain-previous-assets.mjs reads for asset retention; unset (and with no NEXT_PUBLIC_DEPLOY_URL either) each deploy carries nothing forward.',
      ],
      ['NEXT_PUBLIC_BASE_URL', 'Same family.'],
      [
        'NEXT_PUBLIC_PROJECT_NAME',
        'Overrides the name detect-project.js derives from the git remote. Usually unnecessary.',
      ],
      [
        'NEXT_PUBLIC_PROJECT_OWNER',
        'Overrides the owner detect-project.js derives from the git remote.',
      ],
      [
        'NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION',
        'The Search Console meta tag is skipped, so verification never ships and nothing says so (#917).',
      ],
    ],
  ],
  [
    'Author identity on posts and the about surface',
    [
      ['NEXT_PUBLIC_AUTHOR_NAME', 'Bylines fall back to the git owner.'],
      [
        'NEXT_PUBLIC_AUTHOR_EMAIL',
        'Contact link on author surfaces is omitted.',
      ],
      ['NEXT_PUBLIC_AUTHOR_AVATAR', 'No author image.'],
      ['NEXT_PUBLIC_AUTHOR_BIO', 'No author bio.'],
      ['NEXT_PUBLIC_AUTHOR_ROLE', 'No role line.'],
      ['NEXT_PUBLIC_AUTHOR_GITHUB', 'Social link omitted.'],
      ['NEXT_PUBLIC_AUTHOR_LINKEDIN', 'Social link omitted.'],
      ['NEXT_PUBLIC_AUTHOR_TWITTER', 'Social link omitted.'],
      ['NEXT_PUBLIC_AUTHOR_BLUESKY', 'Social link omitted.'],
      ['NEXT_PUBLIC_AUTHOR_MASTODON', 'Social link omitted.'],
      ['NEXT_PUBLIC_AUTHOR_TWITCH', 'Social link omitted.'],
      ['NEXT_PUBLIC_AUTHOR_WEBSITE', 'Social link omitted.'],
    ],
  ],
  [
    'Payments',
    [
      ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'Card checkout unavailable.'],
      ['NEXT_PUBLIC_PAYPAL_CLIENT_ID', 'PayPal button unavailable.'],
      ['NEXT_PUBLIC_CASHAPP_CASHTAG', 'Cash App option hidden.'],
      ['NEXT_PUBLIC_CHIME_SIGN', 'Chime option hidden.'],
    ],
  ],
  [
    'Contact and email',
    [
      [
        'NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY',
        'The contact form cannot deliver. Production shipped this empty once, leaving /contact/ with no working channel (#784).',
      ],
      ['NEXT_PUBLIC_EMAILJS_PUBLIC_KEY', 'EmailJS fallback disabled.'],
      ['NEXT_PUBLIC_EMAILJS_SERVICE_ID', 'EmailJS fallback disabled.'],
      ['NEXT_PUBLIC_EMAILJS_TEMPLATE_ID', 'EmailJS fallback disabled.'],
      [
        'NEXT_PUBLIC_SUPPORT_EMAIL',
        "No mailto is rendered when the form cannot deliver. Empty by default ON PURPOSE — a hardcoded address would put the template maintainer's inbox on every fork.",
      ],
    ],
  ],
  [
    'Analytics, monitoring and extras',
    [
      ['NEXT_PUBLIC_GA_MEASUREMENT_ID', 'No Google Analytics.'],
      [
        'NEXT_PUBLIC_PAGESPEED_API_KEY',
        "/status falls back to the unauthenticated PageSpeed quota, so its live scores may read 'over the anonymous quota'. It stopped the deploy until #987; it no longer does.",
      ],
      ['NEXT_PUBLIC_SENTRY_DSN', 'No error reporting.'],
      ['NEXT_PUBLIC_DISQUS_SHORTNAME', 'Blog comments disabled.'],
      ['NEXT_PUBLIC_CALENDAR_PROVIDER', 'Scheduling embed disabled.'],
      ['NEXT_PUBLIC_CALENDAR_URL', 'Scheduling embed disabled.'],
      ['NEXT_PUBLIC_CAPTCHA_SITE_KEY', 'Sign-up captcha disabled.'],
      ['NEXT_PUBLIC_SITE_TWITTER_HANDLE', 'twitter:site omitted from cards.'],
      ['NEXT_PUBLIC_SOCIAL_PLATFORMS', 'Share buttons fall back to defaults.'],
    ],
  ],
];

/** Names and tab come from the workflow — never from the table above. */
export function readWorkflow(file = WORKFLOW) {
  const yml = readFileSync(file, 'utf8');
  const grab = (kind) =>
    new Set(
      [
        ...yml.matchAll(new RegExp(`${kind}\\.(NEXT_PUBLIC_[A-Z0-9_]+)`, 'g')),
      ].map((m) => m[1])
    );
  return { secrets: grab('secrets'), vars: grab('vars') };
}

export function tabOf({ secrets, vars }, key) {
  if (secrets.has(key)) return 'Secret';
  if (vars.has(key)) return 'Variable';
  return null;
}

export function buildTable(wf = readWorkflow()) {
  const lines = [];
  for (const [heading, entries] of GROUPS) {
    lines.push(`#### ${heading}`, '');
    lines.push('| Value | Tab | Without it |');
    lines.push('| --- | --- | --- |');
    for (const [key, why] of entries) {
      const tab = tabOf(wf, key);
      lines.push(`| \`${key}\` | ${tab ?? '**not in deploy.yml**'} | ${why} |`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

/** Every key the workflow reads must appear exactly once in GROUPS. */
export function reconcile(wf = readWorkflow()) {
  const documented = new Map();
  for (const [, entries] of GROUPS)
    for (const [key] of entries)
      documented.set(key, (documented.get(key) ?? 0) + 1);

  const all = new Set([...wf.secrets, ...wf.vars]);
  return {
    undocumented: [...all].filter((k) => !documented.has(k)).sort(),
    stale: [...documented.keys()].filter((k) => !all.has(k)).sort(),
    duplicated: [...documented].filter(([, n]) => n > 1).map(([k]) => k),
    counts: { secrets: wf.secrets.size, vars: wf.vars.size, total: all.size },
  };
}

function writeChecklist(table) {
  const md = readFileSync(CHECKLIST, 'utf8');
  const i = md.indexOf(START);
  const j = md.indexOf(END);
  if (i === -1 || j === -1)
    throw new Error(`${CHECKLIST} has no ${START} / ${END} markers`);
  writeFileSync(
    CHECKLIST,
    `${md.slice(0, i + START.length)}\n\n${table}\n\n${md.slice(j)}`
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]).endsWith('env-inventory.mjs');

if (isMain) {
  const wf = readWorkflow();
  const r = reconcile(wf);
  const problems = [];
  if (r.undocumented.length)
    problems.push(`no consequence recorded for: ${r.undocumented.join(', ')}`);
  if (r.stale.length)
    problems.push(`documented but not in deploy.yml: ${r.stale.join(', ')}`);
  if (r.duplicated.length)
    problems.push(`listed twice: ${r.duplicated.join(', ')}`);

  if (problems.length) {
    for (const p of problems) console.error(`::error::${p}`);
    process.exit(1);
  }

  const table = buildTable(wf);
  if (process.argv.includes('--write')) {
    writeChecklist(table);
    console.log(
      `  wrote ${r.counts.total} value(s) (${r.counts.secrets} secrets, ${r.counts.vars} variables) into docs/FORK-CHECKLIST.md`
    );
  } else {
    console.log(table);
  }
}
