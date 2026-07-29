/**
 * The `/docs` rail (#380, 3a).
 *
 * Each entry points at markdown that ALREADY EXISTS in this repo. The comp
 * draws nine rail entries; seven of them are documents we already ship and
 * two — "Environment & secrets" and "Offline & PWA" — have never been written.
 * They are deliberately absent rather than listed as dead links: the previous
 * version of this page shipped links to `PWA.md` and `docs/spec-kit/`, neither
 * of which existed, and its own source comment records cutting them.
 *
 * Paths are repo-relative and read at BUILD time. `/docs` is a server
 * component and the site is a static export, so this costs nothing at runtime
 * and the markdown never reaches the browser as markdown.
 */
export interface DocEntry {
  slug: string;
  title: string;
  /** Rail grouping, matching the comp's three sections. */
  section: 'Getting started' | 'Modules' | 'Design';
  /** Repo-relative path to the source markdown. */
  file: string;
  /** One line under the title on the index. */
  hint: string;
}

export const DOCS: readonly DocEntry[] = [
  {
    slug: 'install-and-first-run',
    title: 'Install & first run',
    section: 'Getting started',
    file: 'README.md',
    hint: 'clone · env · docker compose up',
  },
  {
    slug: 'project-structure',
    title: 'Project structure',
    section: 'Getting started',
    file: 'docs/architecture/README.md',
    hint: 'where things live and why',
  },
  {
    slug: 'auth-and-sessions',
    title: 'Auth & sessions',
    section: 'Modules',
    file: 'docs/AUTH-SETUP.md',
    hint: 'sign-up, sign-in, OAuth, recovery',
  },
  {
    slug: 'payments',
    title: 'Payments',
    section: 'Modules',
    file: 'docs/features/payment-integration.md',
    hint: 'checkout wired end to end',
  },
  {
    slug: 'encrypted-messaging',
    title: 'Encrypted messaging',
    section: 'Modules',
    file: 'docs/messaging/QUICKSTART.md',
    hint: 'channels, read receipts, offline queue',
  },
  {
    slug: 'themes-and-tokens',
    title: 'Themes & tokens',
    section: 'Design',
    file: 'docs/CUSTOM-THEME.md',
    hint: 'the 34 themes and how to add one',
  },
  {
    slug: 'accessibility',
    title: 'Accessibility',
    section: 'Design',
    file: 'docs/ACCESSIBILITY.md',
    hint: 'WCAG AA, targets, font scaling',
  },
];

export const SECTIONS = ['Getting started', 'Modules', 'Design'] as const;

export function findDoc(slug: string): DocEntry | undefined {
  return DOCS.find((d) => d.slug === slug);
}

/** Previous/next in rail order, for the comp's footer pager. */
export function neighbours(slug: string): {
  prev?: DocEntry;
  next?: DocEntry;
} {
  const i = DOCS.findIndex((d) => d.slug === slug);
  if (i < 0) return {};
  return { prev: DOCS[i - 1], next: DOCS[i + 1] };
}
