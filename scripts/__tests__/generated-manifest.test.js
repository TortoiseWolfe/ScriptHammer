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
const { deployedBasePath } = require('../lib/deployed-base-path');
const { execFileSync } = require('node:child_process');
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
 * The base path the DEPLOY build will produce, derived the same way
 * `scripts/detect-project.js` derives it.
 *
 * `src/config/project-detected.json` holds the real detected value but is
 * gitignored, so it cannot be the source of truth for a test that must pass on a
 * clean checkout. Replicating the rule is the next best thing -- and it has to
 * replicate ALL of it (#931).
 *
 * WHAT THIS GOT WRONG. It used to return `/<projectName>` unconditionally, which
 * ignored the CNAME clause at detect-project.js:132:
 *
 *     isGitHubActions && info.isGitHub && !cnameExists ? `/${projectName}` : ''
 *
 * A repo with `public/CNAME` deploys at the apex, so its base path is '' and its
 * manifest start_url is '/'. This test demanded `/ScriptHammer/` -- a value the
 * deploy has not produced since the custom domain was added, and which
 * scripthammer.com does not serve. The committed manifest was a fossil, and the
 * consequences compounded: every local build rewrote the file, so the working tree
 * was permanently dirty, and committing the CORRECT regenerated value failed this
 * test. Both symptoms, one stale expectation.
 *
 * `isGitHubActions` is deliberately NOT replicated. The committed artifact must
 * represent what the DEPLOY produces, and the deploy always runs in Actions --
 * keying off the local environment would make the expectation flip depending on
 * where the suite happened to run.
 */
/**
 * The SLUG, from the git remote — the same source detect-project.js uses.
 *
 * This used to read `projectName` out of src/config/project.config.ts. For this repo
 * the two coincide ("ScriptHammer" either way), so it passed here and broke in every
 * fork whose display name is not identical to its repository name: a fork called
 * "Grand Daze" made this expect `/Grand Daze/` — a path with a SPACE in it, which the
 * deploy never produces and no URL can contain.
 *
 * detect-project.js:87 takes `gitInfo.repo` and :133 builds `/${info.projectName}`
 * from it, so the deploy serves `/grand-daze/`. Measured against a real fork's live
 * manifest, which reads `start_url: "/grand-daze/"`. Reading the same source is the
 * only way this expectation can be right for a repo it was not written in (#985).
 */
// The rule lives in one place now (#1114): `generate-manifest.js` needs the same answer to
// decide whether writing would corrupt the tracked artifact, and two copies of a rule that
// must agree is the drift this repo keeps getting bitten by.
const defaultBasePath = () => deployedBasePath(ROOT);

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

test('running the generator for a test never writes to the tracked artifact', () => {
  // THE GUARD FOR THE THING THAT MADE THIS FILE DANGEROUS (#931).
  //
  // The generator resolved its output only against __dirname, so the test above
  // could not run it without overwriting public/manifest.json. It compensated with
  // `git checkout -- public/manifest.json` in a finally block -- which resets to
  // HEAD, not to the pre-test working state. Running the suite therefore DISCARDED
  // any uncommitted change to that file. It destroyed a fix in progress, which is
  // how the behaviour was found rather than reasoned about.
  //
  // MANIFEST_OUTPUT_DIR is what makes the generator testable in isolation. This
  // asserts it is honoured, because if it silently stopped being honoured the old
  // clobbering would return and the only symptom would be lost work.
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-isolation-'));
  fs.mkdirSync(path.join(fixture, 'public'), { recursive: true });
  const before = fs.readFileSync(MANIFEST_PATH, 'utf8');

  try {
    const result = spawnSync(process.execPath, [GENERATOR_PATH], {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        MANIFEST_OUTPUT_DIR: path.join(fixture, 'public'),
        NEXT_PUBLIC_BASE_PATH: '/Isolated',
        NEXT_PUBLIC_PROJECT_NAME: 'Isolated',
      },
    });
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);

    assert.ok(
      fs.existsSync(path.join(fixture, 'public', 'manifest.json')),
      'MANIFEST_OUTPUT_DIR was ignored — the generator wrote somewhere else'
    );
    assert.strictEqual(
      fs.readFileSync(MANIFEST_PATH, 'utf8'),
      before,
      'the generator modified the TRACKED public/manifest.json while writing to a ' +
        'fixture. That is what forced the destructive `git checkout` restore this ' +
        'change removed, and it silently discards uncommitted work.'
    );
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
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
        // Write into the fixture, never into public/ (#931).
        MANIFEST_OUTPUT_DIR: path.join(fixture, 'public'),
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

    // Read the FIXTURE's copy. This used to read the repo's own manifest, because
    // the generator could only write there -- see MANIFEST_OUTPUT_DIR (#931).
    const generated = JSON.parse(
      fs.readFileSync(path.join(fixture, 'public', 'manifest.json'), 'utf8')
    );
    assert.strictEqual(generated.start_url, '/Fixture/');
    assert.strictEqual(generated.scope, '/Fixture/');
    assert.ok(
      generated.icons.every((icon) => icon.src.startsWith('/Fixture/')),
      'an icon path ignored the configured base path'
    );
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    // Nothing to restore: the generator never touched public/ (#931). The previous
    // `git checkout -- public/manifest.json` here reset the file to HEAD, which
    // discarded uncommitted work every time the suite ran.
  }
});

/**
 * #982 — every fork's install prompt described this template.
 *
 * generate-manifest.js hardcoded the sentence and interpolated only the project NAME,
 * so the Android install sheet and the desktop install dialog read
 * "<Fork> - A production Next.js and Supabase platform with auth, payments, encrypted
 * messaging, and an accessible offline-capable PWA" whatever description the forker
 * passed. The manifest is regenerated by prebuild, so that string SHIPPED.
 *
 * #923 fixed og:description, twitter:description and the meta description to read
 * projectDescription, and its PR body claimed the manifest too. It did not: nothing
 * consulted the field. The sweep could not reach the sentence either, because it
 * carries no brand token — which is why #923 existed at all.
 */
test('the manifest description comes from the project, not from the template', () => {
  const manifest = readManifest();
  const src = fs.readFileSync(PROJECT_CONFIG_PATH, 'utf8');
  const match = /projectDescription:\s*'((?:[^'\\]|\\.)*)'/.exec(src);
  assert.ok(
    match,
    'could not read projectDescription from src/config/project.config.ts'
  );

  assert.strictEqual(
    manifest.description,
    match[1].replace(/\\'/g, "'"),
    'the manifest is not describing this project — run `pnpm run generate:manifest`'
  );
});

test('the description is not a hardcoded sentence with the name pasted in', () => {
  // The specific old shape: `${projectName} - A production Next.js and Supabase…`.
  // A fork whose projectDescription happens to be unset would still produce that via
  // the fallback, which is fine — what must not happen is the name being prefixed
  // onto a sentence nobody wrote.
  const manifest = readManifest();
  const src = fs.readFileSync(PROJECT_CONFIG_PATH, 'utf8');
  const name = /projectName:\s*'([^']+)'/.exec(src)[1];
  assert.ok(
    !manifest.description.startsWith(`${name} - A production Next.js`),
    'the manifest description is the template boilerplate with this project name pasted on'
  );
});

test('a divergent-base-path build does not touch the tracked artifact (#1114)', () => {
  // THE REGRESSION THIS FILE EXISTED TO CATCH, now prevented rather than detected.
  //
  // Every `git push` runs a production build through the pre-push gate
  // (.husky/pre-push:106 -> scripts/validate-ci.sh:139) in the `builder` container, which
  // takes `env_file: .env` and therefore inherits a base path that differs from the deployed
  // one. That rewrote start_url, scope and every icon in a TRACKED file, leaving the tree
  // dirty on every push — observed five times in one session, each a single `git add -A`
  // away from breaking PWA install in production.
  //
  // Driven end to end rather than asserted from the source, because the bug is entirely in
  // which path gets written.
  const before = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const divergent = defaultBasePath() === '/probe' ? '/other-probe' : '/probe';

  const res = spawnSync(
    process.execPath,
    [path.join(ROOT, 'scripts', 'generate-manifest.js')],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        NEXT_PUBLIC_BASE_PATH: divergent,
        MANIFEST_OUTPUT_DIR: '',
      },
    }
  );

  assert.strictEqual(
    fs.readFileSync(MANIFEST_PATH, 'utf8'),
    before,
    'A build with a base path that does not match the deployed site rewrote the TRACKED ' +
      'manifest. That is #1114: committing it ships start_url, scope and every icon path ' +
      'pointing at the wrong root, which breaks PWA install and offline.\n\n' +
      `generator output:\n${res.stdout}${res.stderr}`
  );

  assert.match(
    `${res.stdout}${res.stderr}`,
    /diverge/i,
    'the generator redirected silently — an operator needs to be told why public/manifest.json ' +
      'did not change, or they will assume the generator is broken'
  );
});
