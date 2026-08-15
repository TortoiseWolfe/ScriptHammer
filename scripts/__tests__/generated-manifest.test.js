/**
 * `public/manifest.json` is generated at build time and deliberately tracked (#392).
 *
 * WHY TRACKED, given it is a build output. Same reasoning as `public/robots.txt`
 * (#504): a committed copy is reviewable, so a local variant build that rewrites it
 * appears in a diff instead of shipping quietly. The alternative — untracking it —
 * would also mean a fresh clone's dev server 404s on the manifest, because `dev`
 * never runs the generators.
 *
 * WHAT ACTUALLY GOES WRONG. `DISABLE_BASE_PATH=true` is the documented recipe for a
 * local CI-matching E2E run, and running it rewrites this file:
 *
 *     -  "start_url": "/ScriptHammer/",      +  "start_url": "/",
 *     -  "scope":     "/ScriptHammer/",      +  "scope":     "/",
 *     -  "src": "/ScriptHammer/icon-72.svg"  +  "src": "/icon-72.svg"
 *
 * `git add -A` is the natural way to lose that, and the diff reads as harmless
 * config churn. On GitHub Pages under `/ScriptHammer/` it breaks PWA install and
 * offline. This test is what turns that into a failing check.
 *
 * WHAT THIS DOES **NOT** CLAIM. The committed copy is not what production serves.
 * scripthammer.com runs at the apex with no base path, and its deploy regenerates
 * the file — live values are `/`, while the committed copy is the default GitHub
 * Pages variant. So this pins the tracked artifact to the repo's DEFAULT
 * configuration, which is the thing a reviewer sees; production correctness is the
 * deploy's job, not this file's.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'public', 'manifest.json');
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate-manifest.js');
const PROJECT_CONFIG_PATH = path.join(
  ROOT,
  'src',
  'config',
  'project.config.ts'
);

/**
 * The default base path, read from the tracked config rather than hardcoded.
 *
 * `src/config/project-detected.json` holds the real detected value but is
 * gitignored, so it cannot be the source of truth for a test that must pass on a
 * clean checkout.
 */
function defaultBasePath() {
  const src = fs.readFileSync(PROJECT_CONFIG_PATH, 'utf8');
  const match = /projectName:\s*'([^']+)'/.exec(src);
  assert.ok(
    match,
    'could not read projectName from src/config/project.config.ts'
  );
  return `/${match[1]}`;
}

const readManifest = () => JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

test('the committed manifest is not a base-path-disabled build', () => {
  const manifest = readManifest();
  const base = defaultBasePath();

  assert.strictEqual(
    manifest.start_url,
    `${base}/`,
    `start_url is "${manifest.start_url}". A local build with DISABLE_BASE_PATH=true ` +
      `rewrites this file; committing that ships a manifest whose start_url, scope ` +
      `and icon paths all point at the wrong root, which breaks PWA install and offline.`
  );
  assert.strictEqual(
    manifest.scope,
    `${base}/`,
    `scope is "${manifest.scope}" — see start_url above, same cause`
  );
});

test('every icon in the committed manifest shares the manifest scope', () => {
  const manifest = readManifest();

  assert.ok(
    Array.isArray(manifest.icons) && manifest.icons.length > 0,
    'the manifest declares no icons, so this check would be vacuous'
  );

  // Internal consistency, independent of what the base path happens to be: an
  // icon that does not sit under the scope is unreachable to the installed app.
  const strays = manifest.icons
    .map((icon) => icon.src)
    .filter((src) => !src.startsWith(manifest.scope));

  assert.deepStrictEqual(
    strays,
    [],
    `icon path(s) outside the manifest scope "${manifest.scope}"`
  );
});

test('the generator applies the base path it is given, to every field', () => {
  // The companion to the pin above: the committed copy could be correct while the
  // generator that produces it is not, and a reviewer would never see it.
  const fixture = fs.mkdtempSync(
    path.join(os.tmpdir(), 'scripthammer-manifest-')
  );
  fs.mkdirSync(path.join(fixture, 'public'), { recursive: true });

  try {
    const result = spawnSync(process.execPath, [GENERATOR_PATH], {
      cwd: fixture,
      encoding: 'utf8',
      env: {
        ...process.env,
        NEXT_PUBLIC_BASE_PATH: '/Fixture',
        NEXT_PUBLIC_PROJECT_NAME: 'Fixture',
        NEXT_PUBLIC_PROJECT_OWNER: 'ExampleOwner',
      },
    });
    assert.strictEqual(
      result.status,
      0,
      `manifest generator failed:\n${result.stderr || result.stdout}`
    );

    // The generator writes relative to its own directory, not cwd, so read it back
    // from the repo and restore it afterwards — see the finally block.
    const generated = readManifest();
    assert.strictEqual(generated.start_url, '/Fixture/');
    assert.strictEqual(generated.scope, '/Fixture/');
    assert.ok(
      generated.icons.every((icon) => icon.src.startsWith('/Fixture/')),
      'an icon path ignored the configured base path'
    );
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    // Put the committed copy back: the generator overwrote it.
    const restore = spawnSync(
      'git',
      ['checkout', '--', 'public/manifest.json'],
      {
        cwd: ROOT,
        encoding: 'utf8',
      }
    );
    assert.strictEqual(
      restore.status,
      0,
      `could not restore public/manifest.json after the generator run:\n${restore.stderr}`
    );
  }
});
