import { describe, it, expect } from 'vitest';
import { generateMetadata } from '../metadata';
import { projectConfig } from '@/config/project.config';

/**
 * The canonical contract (#668).
 *
 * `path` used to default to `'/'`, and Next's App Router inherits
 * `alternates.canonical` down the whole route tree — so the root layout's claim
 * became every page's claim. **83 of 100 routes shipped the homepage as their
 * canonical**, each asking a search engine to index the front page instead of
 * itself, with `og:url` along for the ride so `/pricing` unfurled as the homepage.
 *
 * The rule is now: no path, no claim. `scripts/ci/check-canonicals.mjs` proves it
 * against the real export; these pin the helper that decides it, because a default
 * is exactly the kind of thing a later refactor restores "for convenience".
 */
describe('generateMetadata — the canonical claim', () => {
  it('emits NO canonical when no path is given', () => {
    const meta = generateMetadata({ title: 'X', description: 'Y' });

    // Absent, not undefined: Next treats a present-but-undefined `alternates` as
    // inherit, which is the behaviour this whole fix exists to stop.
    expect(meta.alternates).toBeUndefined();
    expect(meta.openGraph).toBeDefined();
    expect(
      (meta.openGraph as Record<string, unknown>).url,
      'og:url must be absent too — it is the share-card half of the same defect'
    ).toBeUndefined();
  });

  it('claims exactly the path it was given', () => {
    const meta = generateMetadata({ path: '/pricing/' });
    const want = `${projectConfig.deployUrl}/pricing/`;

    expect(meta.alternates?.canonical).toBe(want);
    expect((meta.openGraph as Record<string, unknown>).url).toBe(want);
  });

  it('never silently claims the homepage', () => {
    // The regression in one line: any call that does not name a route must not
    // end up pointing at `/`.
    for (const options of [{}, { title: 'A' }, { description: 'B' }]) {
      const meta = generateMetadata(options);
      expect(
        meta.alternates?.canonical,
        `generateMetadata(${JSON.stringify(options)}) claimed a canonical it was never given`
      ).toBeUndefined();
    }
  });

  it('still emits the site-wide tags a page inherits legitimately', () => {
    // The fix must not throw out the baby: title, description, og:image and
    // twitter are meant to be inherited from the root layout.
    const meta = generateMetadata({ title: 'X', description: 'Y' });
    expect(meta.title).toContain('X');
    expect(meta.description).toBe('Y');
    expect(meta.metadataBase).toBeInstanceOf(URL);
    expect((meta.openGraph as { images?: unknown[] }).images?.length).toBe(1);
    expect(meta.twitter).toBeDefined();
  });
});
