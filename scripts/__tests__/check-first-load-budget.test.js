/**
 * Tests for the first-load budget gate (#291).
 *
 * THERE WERE NONE. That is why a false failure shipped and blocked every deploy
 * for hours on 2026-08-07: the gate matched /WebGLRenderer|BufferGeometry/ against
 * minified output, an app module gained the log line "no WebGLRenderer available
 * yet", and the gate reported three.js on 125 routes. `common` actually held 0
 * BufferGeometry and 1 WebGLRenderer; the real three chunk held 42 and 37 and was
 * async-only.
 *
 * The pair that matters is the first two cases below: a real library leak must
 * FAIL, and an app module that merely mentions a three class name must PASS.
 * Neither could be expressed against the old implementation.
 */
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const SCRIPT = join(__dirname, '..', 'check-first-load-budget.mjs');

/**
 * Build a throwaway export + dist pair and run the gate against it.
 *
 * `routes` maps a route to the chunk refs its index.html loads, mirroring how a
 * real export writes them (`_next/static/chunks/...`). The gate reads the HTML
 * rather than app-build-manifest.json on purpose — see the note in the script.
 */
function run({ chunkModules, routes, omitMap = false }) {
  const root = mkdtempSync(join(tmpdir(), 'flb-'));
  const out = join(root, 'out');
  const map = join(root, '.chunk-modules.json');
  mkdirSync(out, { recursive: true });
  try {
    if (!omitMap) {
      writeFileSync(map, JSON.stringify(chunkModules ?? {}));
    }
    for (const [route, refs] of Object.entries(routes ?? {})) {
      const dir = join(out, ...route.split('/').filter(Boolean));
      mkdirSync(dir, { recursive: true });
      const tags = refs
        .map((r) => `<script src="/_next/static/${r}"></script>`)
        .join('');
      writeFileSync(
        join(dir, 'index.html'),
        `<html><body>${tags}</body></html>`
      );
    }
    try {
      const stdout = execFileSync('node', [SCRIPT, out, map], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, out: stdout };
    } catch (err) {
      return {
        code: err.status ?? 1,
        out: `${err.stdout ?? ''}${err.stderr ?? ''}`,
      };
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const THREE_CHUNK = { 'static/chunks/three.abc.js': ['three', 'three-stdlib'] };

test('FAILS when the three library is in a non-3D route initial chunk', () => {
  const r = run({
    chunkModules: {
      ...THREE_CHUNK,
      'static/chunks/common-x.js': ['react', 'three'],
    },
    routes: { '/blog': ['chunks/common-x.js'] },
  });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /ships in the initial payload/);
  assert.match(r.out, /\/blog/);
});

test('PASSES when non-3D app code merely mentions a three class name', () => {
  // The 2026-08-07 false failure, expressed. The gate sees module identity,
  // not minified strings, so a normal app module's log text cannot mimic three.
  const r = run({
    chunkModules: {
      ...THREE_CHUNK,
      'static/chunks/common-x.js': ['react', 'src/components/StatusCard.tsx'],
    },
    routes: { '/blog': ['chunks/common-x.js'] },
  });
  assert.strictEqual(r.code, 0);
  assert.doesNotMatch(r.out, /❌/);
});

test('FAILS on first-party 3D code in a non-3D initial chunk', () => {
  const r = run({
    chunkModules: {
      ...THREE_CHUNK,
      'static/chunks/common-x.js': ['src/lib/cod/sky/luts.js'],
    },
    routes: { '/blog': ['chunks/common-x.js'] },
  });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /first-party 3D code ships in the initial payload/);
  assert.match(r.out, /src\/lib\/cod/);
});

test('allows the pure renderer URL parser that GlobalNav loads on every route', () => {
  // This one `src/twin/` module has no renderer imports. GlobalNav uses it to
  // select the right map link state, so classifying it by directory would turn
  // every non-3D page into a false failure. The exception is intentionally exact.
  const r = run({
    chunkModules: {
      ...THREE_CHUNK,
      'static/chunks/app/layout-x.js': ['src/twin/renderer-select.ts'],
    },
    routes: { '/blog': ['chunks/app/layout-x.js'] },
  });
  assert.strictEqual(r.code, 0);
  assert.doesNotMatch(r.out, /❌ first-party 3D code ships/);
});

test('allows three on genuinely 3D routes', () => {
  const routes = {};
  for (const p of [
    '/chatt',
    '/twins/chatt',
    '/game/3d',
    '/game/cod-skeleton', // was MISSING from the allowlist — latent false positive
  ]) {
    routes[p] = ['chunks/three.abc.js'];
  }
  const r = run({ chunkModules: THREE_CHUNK, routes });
  assert.strictEqual(r.code, 0);
});

test('catches the drei/fiber ecosystem, not just the `three` package', () => {
  const r = run({
    chunkModules: {
      ...THREE_CHUNK,
      'static/chunks/common-x.js': ['@react-three/drei'],
    },
    routes: { '/docs': ['chunks/common-x.js'] },
  });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /@react-three\/drei/);
});

test('inspects EVERY chunk the HTML loads, including the shared layout chunk', () => {
  // Why the gate reads HTML and not app-build-manifest.json. Measured 2026-08-07:
  // the manifest lists 5 chunks per route where the HTML loads 8, omitting
  // app/layout-*.js, app/global-error-*.js and polyfills-*.js. The layout chunk
  // is on every page, so a manifest-driven gate would be blind exactly where a
  // leak hurts most. Here the leak is ONLY in layout — the manifest would pass.
  const r = run({
    chunkModules: {
      ...THREE_CHUNK,
      'static/chunks/main-app-x.js': ['react'],
      'static/chunks/app/layout-x.js': ['three'],
    },
    routes: { '/blog': ['chunks/main-app-x.js', 'chunks/app/layout-x.js'] },
  });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /layout-x\.js/);
});

test('matches percent-encoded dynamic-route chunks to their literal map keys', () => {
  // The export writes `chunks/app/blog/%5Bslug%5D/page-<hash>.js`; the chunk lives
  // on disk at `[slug]`. Without decoding, the lookup misses — and a miss that is
  // read as "no modules" is a silent pass on a route with a real leak.
  const r = run({
    chunkModules: {
      ...THREE_CHUNK,
      'static/chunks/app/blog/[slug]/page-x.js': ['three'],
    },
    routes: { '/blog/hello': ['chunks/app/blog/%5Bslug%5D/page-x.js'] },
  });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /ships in the initial payload/);
});

// ── refuse-to-pass-blind. Every one of these must EXIT 1, never 0. A gate that
// passes when it cannot see is worse than no gate, because it reads as evidence.

test('refuses when the chunk→module map is missing', () => {
  const r = run({
    routes: { '/blog': ['chunks/common-x.js'] },
    omitMap: true,
  });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /Refusing to pass blind/);
});

test('refuses when the export has no HTML', () => {
  const r = run({ chunkModules: THREE_CHUNK, routes: {} });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /no index\.html/);
});

test('refuses when NO chunk contains three — the map must be wrong', () => {
  // This is the guard that would have caught three.<hash>.js vs three-<hash>.js.
  const r = run({
    chunkModules: { 'static/chunks/common-x.js': ['react'] },
    routes: { '/blog': ['chunks/common-x.js'] },
  });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /Refusing to pass blind/);
});

test('refuses when a loaded chunk is absent from the module map', () => {
  // "Not described" must never read as "contains nothing". A stale map would
  // otherwise turn the whole gate green while seeing none of the payload.
  const r = run({
    chunkModules: THREE_CHUNK,
    routes: { '/blog': ['chunks/mystery-x.js'] },
  });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /absent from chunk-modules\.json/);
  assert.match(r.out, /mystery-x\.js/);
});
