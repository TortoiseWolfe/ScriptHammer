/**
 * A published post may not send a reader to a repository they cannot open (#953).
 *
 * WHAT HAPPENED. `facebook-export-knowledge-graph.md` told readers to
 * `git clone https://github.com/TortoiseWolfe/fb-digital-twin`. That repository is **private**,
 * so every reader who followed the instruction got a 404 — two paragraphs after the post itself
 * warns that "a private repo is one bad `git remote` away from a public one".
 *
 * WHY IT IS WORTH A GUARD RATHER THAN A FIX. The identical defect shipped across twelve posts in
 * a sibling repository and was only discovered because a reader's AI assistant was instructed to
 * file a bug against a repo that also did not exist — so the report landed in ScriptHammer
 * instead (#953). Nobody noticed for the life of those posts. A broken clone in prose fails
 * silently: the build is green, the link is not a `<a href>` a link checker would follow, and
 * the only person who learns is a reader who then leaves.
 *
 * WHY AN ALLOWLIST AND NOT A NETWORK CHECK. Asking GitHub whether each repo is public would be
 * accurate and flaky — it needs auth for private repos to be distinguishable from missing ones,
 * and a rate limit would turn this red for reasons unrelated to the blog. The allowlist makes
 * adding a repository to a post a deliberate act: you cannot reference one without stating, in
 * this file, that it is public and meant to be.
 *
 * Placeholders are exempt by design. `YourUsername/your-new-repo` is instructional text, not a
 * destination, and treating it as one would make the guard noise.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const BLOG = path.resolve(__dirname, '..', '..', 'public', 'blog');

/**
 * Repositories a post may point a reader at.
 *
 * Every entry must be PUBLIC and intended to stay public. Adding one is a decision: you are
 * promising a stranger that the link works. Remove an entry the moment a repo goes private,
 * and fix the posts that referenced it — that is the whole point of the list.
 */
const PUBLIC_REPOS = new Set([
  'TortoiseWolfe/ScriptHammer',
  'TortoiseWolfe/RescueDogs',
  'mshumer/Claude-of-Duty',
  'safishamsi/graphify',
  'supabase/auth-helpers',
]);

/** Instructional stand-ins, not destinations. */
const PLACEHOLDER =
  /^(YourUsername|yourusername|user|owner|username|your-org)\//i;

/** Not a repository: github.com/settings/…, /features/…, and similar product paths. */
const NOT_A_REPO = new Set([
  'settings',
  'features',
  'about',
  'pricing',
  'orgs',
  'apps',
  'marketplace',
  'sponsors',
  'security',
  'readme',
]);

function posts() {
  return fs
    .readdirSync(BLOG)
    .filter((f) => f.endsWith('.md') && f !== 'CLAUDE.md')
    .map((f) => path.join(BLOG, f));
}

/** Every `github.com/<owner>/<repo>` a post points at, with the file it came from. */
function referencedRepos() {
  const out = [];
  for (const file of posts()) {
    const body = fs.readFileSync(file, 'utf8');
    for (const m of body.matchAll(
      /github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/g
    )) {
      const owner = m[1];
      const repo = m[2].replace(/\.git$/, '');
      if (NOT_A_REPO.has(owner.toLowerCase())) continue;
      const slug = `${owner}/${repo}`;
      if (PLACEHOLDER.test(slug)) continue;
      out.push({ slug, file: path.basename(file) });
    }
  }
  return out;
}

describe('published posts link nothing private (#953)', () => {
  it('finds repository references, so the sweep is not vacuous', () => {
    // ANTI-VACUITY. If the regex or the blog path broke, the assertion below would pass by
    // inspecting nothing — the same species of silent green this guard exists to prevent.
    const refs = referencedRepos();
    assert.ok(
      refs.length > 3,
      `only ${refs.length} repository reference(s) found across the blog — the sweep is ` +
        'broken, not the posts'
    );
  });

  it('every repository a post points at is on the public allowlist', () => {
    const offenders = [
      ...new Set(
        referencedRepos()
          .filter((r) => !PUBLIC_REPOS.has(r.slug))
          .map((r) => `${r.file} → ${r.slug}`)
      ),
    ].sort();

    assert.deepStrictEqual(
      offenders,
      [],
      'A published post points a reader at a repository that is not on the public ' +
        'allowlist in this file.\n\n' +
        'If it IS public and meant to stay so, add it to PUBLIC_REPOS — that addition is you ' +
        'promising a stranger the link works.\n' +
        'If it is private, the post must not send anyone there: #953 is what that costs, and ' +
        'a broken clone in prose fails silently — green build, no link checker, and the only ' +
        `person who finds out is the reader who leaves.\n\nOffenders:\n  ${offenders.join('\n  ')}`
    );
  });

  it('placeholders are not treated as destinations', () => {
    // Counterweight: proves the exemption works, so the guard cannot be "fixed" later by
    // widening PLACEHOLDER until real repositories slip through it.
    assert.ok(PLACEHOLDER.test('YourUsername/your-new-repo'));
    assert.ok(!PLACEHOLDER.test('TortoiseWolfe/fb-digital-twin'));
  });
});
