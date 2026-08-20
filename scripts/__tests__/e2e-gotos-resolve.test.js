/**
 * Every literal `page.goto('/path')` in the E2E suite must name a real route (#396).
 *
 * WHY. A spec that navigates to a path the app does not have lands on `not-found.tsx`
 * and keeps going. Nothing errors: assertions about chrome (nav, footer, theme, a
 * persisted setting) still pass there, so the spec stays green while measuring the
 * error page instead of the subject it names.
 *
 * THIS IS NOT HYPOTHETICAL, THREE TIMES OVER:
 *
 *   - `colorblind-toggle.spec.ts` navigated to `/about` — a route this app has never
 *     had — to prove a colour-vision setting survives navigation. It proved it
 *     survives navigating to the 404 page. Found by this check.
 *   - #425: PR #420 added `/docs/[slug]` with no INSTANCES entry, so the contrast
 *     sweep visited the literal path, 404'd, and reported a violation against
 *     `/docs/[slug]` when the real subject was `not-found.tsx`.
 *   - While investigating #842, three consecutive measurements were of the 404 page
 *     because `goto('/')` under a basePath BASE_URL resolves to the server root. A
 *     plausible `footer a = 3` was the 404 page's own footer.
 *
 * WHY STATIC AND NOT A RUNTIME FIXTURE. #396 asks for "fail loudly when an E2E test
 * lands on the 404 route". A fixture wrapping every navigation would catch more —
 * including computed paths this cannot see — but it changes behaviour for every spec
 * on the REQUIRED lane, and this sweep found only one real instance. The cheap,
 * zero-risk half is worth having first; the runtime half is recorded in #396.
 *
 * WHAT THIS CANNOT CHECK, so a green run is not over-read: computed paths
 * (`goto(\`/blog/${slug}\`)`), redirects that land on a 404, and routes that exist as
 * files but fail to build. It checks literal paths against the route table.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const APP = path.join(ROOT, 'src', 'app');
const E2E = path.join(ROOT, 'tests', 'e2e');

/**
 * Paths a spec navigates to ON PURPOSE to exercise the 404 template. Each needs a
 * reason, so the list cannot quietly become a dumping ground for real mistakes.
 */
const DELIBERATE_404 = {
  '/non-existent-page':
    'cross-page-navigation.spec.ts — the test IS "404 page handles non-existent routes"',
  '/__contrast-probe-unmatched-route__/':
    'color-contrast.spec.ts TEMPLATE_PROBES — not-found.tsx has no URL of its own, so the sweep must reach it deliberately (#425)',
};

/** Routes the app router actually serves, from `page.tsx` files. */
function routes(dir = APP, prefix = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      // `(group)` segments do not appear in the URL.
      const seg = /^\(.*\)$/.test(e.name) ? '' : `/${e.name}`;
      out.push(...routes(path.join(dir, e.name), prefix + seg));
    } else if (e.name === 'page.tsx') {
      out.push(prefix || '/');
    }
  }
  return out;
}

const norm = (p) => p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';

function resolves(p, table) {
  const t = norm(p);
  return table.some((r) => {
    const rr = norm(r);
    if (rr === t) return true;
    if (!rr.includes('[')) return false;
    const pat =
      '^' +
      rr
        .split('/')
        .map((s) =>
          /^\[\.\.\..+\]$/.test(s)
            ? '.+'
            : /^\[.+\]$/.test(s)
              ? '[^/]+'
              : s.replace(/[.*+?^${}()|\\]/g, '\\$&')
        )
        .join('/') +
      '$';
    return new RegExp(pat).test(t);
  });
}

/** Every literal `.goto('/...')` in the suite. Template literals are skipped. */
function gotos() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.ts$/.test(e.name)) {
        fs.readFileSync(p, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            for (const m of line.matchAll(/\.goto\(\s*['"](\/[^'"$`]*)['"]/g)) {
              out.push({
                file: path.relative(ROOT, p),
                line: i + 1,
                target: m[1],
              });
            }
          });
      }
    }
  };
  walk(E2E);
  return out;
}

describe('E2E navigations name real routes (#396)', () => {
  it('finds a real route table and real navigations', () => {
    // Non-vacuity, both sides. "Nothing 404s" is trivially true of an empty route
    // table (everything fails) or an empty goto list (nothing is checked) — and the
    // second would pass silently, which is the shape this file exists to catch.
    assert.ok(
      routes().length >= 20,
      `only ${routes().length} routes enumerated`
    );
    assert.ok(
      gotos().length >= 30,
      `only ${gotos().length} literal goto() calls found`
    );
  });

  it('no spec navigates to a path the app does not serve', () => {
    const table = routes();
    const bad = gotos()
      .filter((g) => !resolves(g.target, table))
      .filter(
        (g) => !(norm(g.target) in DELIBERATE_404 || g.target in DELIBERATE_404)
      );

    assert.deepEqual(
      bad.map((g) => `${g.file}:${g.line} -> ${g.target}`),
      [],
      'these navigations land on not-found.tsx. The spec keeps running and its ' +
        'assertions about chrome still pass, so it stays green while measuring the ' +
        'error page instead of its subject (#396). Point it at a real route, or add ' +
        'it to DELIBERATE_404 with a reason if the 404 IS the subject.'
    );
  });

  it('the detector can actually fail', () => {
    const table = ['/', '/blog', '/blog/[slug]', '/docs'];
    assert.equal(resolves('/blog', table), true);
    assert.equal(
      resolves('/blog/', table),
      true,
      'a trailing slash is the same route'
    );
    assert.equal(
      resolves('/blog/anything', table),
      true,
      'dynamic segment matches'
    );
    assert.equal(resolves('/about', table), false, 'the real bug this found');
    assert.equal(
      resolves('/blog/a/b', table),
      false,
      'one dynamic segment is not two'
    );
    assert.equal(
      resolves('/?x=1', table),
      true,
      'a query string is not part of the route'
    );

    // The allowlist must be reasons, not bare strings — otherwise it rots into a
    // place where real mistakes get parked.
    for (const [p, why] of Object.entries(DELIBERATE_404)) {
      assert.ok(why.length > 30, `DELIBERATE_404['${p}'] needs a real reason`);
    }
  });
});
