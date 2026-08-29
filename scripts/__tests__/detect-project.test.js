/**
 * `scripts/detect-project.js` decides `basePath` — whether every asset URL in the deployed
 * site is `/` or `/RepoName/`. Getting it wrong 404s the entire site.
 *
 * THIS FILE USED TO TEST NOTHING. It never required the script. It re-implemented
 * `parseGitUrl` and the basePath rule inline and asserted against its own copies, so the
 * executable body of the real script had zero coverage — any rewrite of it would have left
 * the suite green. The copy had already drifted: it hardcoded `isGitHub: false` for the
 * generic-host branch where the script computes `genericMatch[1].includes('github')`, so a
 * GitHub Enterprise remote was described one way by the test and another by the code.
 *
 * WHY IT DRIFTED, and what this file does about it. The script resolves every path from
 * `__dirname`, not `cwd`, and it WRITES — `src/config/project-detected.{json,ts}` and
 * `.env.local`. Requiring it, or running it with a different `cwd`, mutates the real
 * repository. That is what pushed the original into re-implementation.
 *
 * The fix is a fixture tree: copy the script to `<tmp>/scripts/detect-project.js`, so its
 * own `__dirname/..` resolves to the fixture root, and run it as a child process with a
 * controlled environment. It writes into the fixture and cannot reach this checkout.
 */
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'detect-project.js');

const fixtures = [];

after(() => {
  for (const dir of fixtures) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * A throwaway repository with a copy of the script in it.
 * `remote: null` leaves the repo with no origin, which is the "not a git repository or no
 * remote" path.
 */
function makeFixture({
  remote = 'https://github.com/acme/Widget.git',
  cname,
} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-project-'));
  fixtures.push(dir);

  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(dir, 'scripts', 'detect-project.js'));

  execFileSync('git', ['init', '-q'], { cwd: dir });
  if (remote)
    execFileSync('git', ['remote', 'add', 'origin', remote], { cwd: dir });

  if (cname !== undefined) {
    fs.mkdirSync(path.join(dir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'public', 'CNAME'), cname);
  }
  return dir;
}

/**
 * The environment is built from a whitelist rather than inherited. GITHUB_ACTIONS is set in
 * CI, and letting it leak in would make these assertions mean something different depending
 * on where the suite ran — the exact hazard `generated-manifest.test.js:67-71` documents.
 */
function run(dir, env = {}) {
  execFileSync(process.execPath, ['scripts/detect-project.js'], {
    cwd: dir,
    env: { PATH: process.env.PATH, HOME: os.tmpdir(), ...env },
    stdio: 'pipe',
  });
  return JSON.parse(
    fs.readFileSync(
      path.join(dir, 'src', 'config', 'project-detected.json'),
      'utf8'
    )
  );
}

describe('detect-project.js — the real script, executed', () => {
  it('runs at all and writes both artifacts', () => {
    // Non-vacuity. Every assertion below reads project-detected.json; if the script
    // stopped writing it they would all error rather than fail, which is a worse signal.
    const dir = makeFixture();
    const config = run(dir);
    assert.strictEqual(config.projectName, 'Widget');
    assert.strictEqual(config.projectOwner, 'acme');
    assert.ok(
      fs.existsSync(path.join(dir, 'src', 'config', 'project-detected.ts'))
    );
  });

  describe('basePath', () => {
    it('is /RepoName on a GitHub Pages deploy with no custom domain', () => {
      const dir = makeFixture();
      assert.strictEqual(
        run(dir, { GITHUB_ACTIONS: 'true' }).basePath,
        '/Widget'
      );
    });

    it('is empty when a CNAME exists — the rule this whole issue is about', () => {
      // The file's EXISTENCE is the signal; its contents are never read. A repo with a
      // custom domain serves from the apex, so there is no prefix to add.
      const dir = makeFixture({ cname: 'widget.example' });
      assert.strictEqual(run(dir, { GITHUB_ACTIONS: 'true' }).basePath, '');
    });

    it('ignores CNAME CONTENTS — an empty file still counts as present', () => {
      // Why #961 had to delete rather than blank it, and why this is configuration
      // masquerading as a filesystem check.
      const dir = makeFixture({ cname: '' });
      assert.strictEqual(run(dir, { GITHUB_ACTIONS: 'true' }).basePath, '');
    });

    it('is empty outside GitHub Actions, even with no CNAME', () => {
      const dir = makeFixture();
      assert.strictEqual(run(dir).basePath, '');
    });

    it('is empty for a non-GitHub remote even inside Actions', () => {
      const dir = makeFixture({ remote: 'git@gitlab.com:acme/Widget.git' });
      const config = run(dir, { GITHUB_ACTIONS: 'true' });
      assert.strictEqual(config.isGitHub, false);
      assert.strictEqual(config.basePath, '');
    });

    it('treats a GitHub Enterprise host as GitHub — the drift the old copy had backwards', () => {
      const dir = makeFixture({
        remote: 'git@github.acme.com:acme/Widget.git',
      });
      const config = run(dir, { GITHUB_ACTIONS: 'true' });
      assert.strictEqual(
        config.isGitHub,
        true,
        'host containing "github" is GitHub'
      );
      assert.strictEqual(config.basePath, '/Widget');
    });

    it('honours an explicit NEXT_PUBLIC_BASE_PATH over auto-detection', () => {
      const dir = makeFixture({ cname: 'widget.example' });
      assert.strictEqual(
        run(dir, { GITHUB_ACTIONS: 'true', NEXT_PUBLIC_BASE_PATH: '/Explicit' })
          .basePath,
        '/Explicit'
      );
    });

    it('lets DISABLE_BASE_PATH beat even an explicit base path', () => {
      // Load-bearing for the E2E lane, which serves the export from the root.
      const dir = makeFixture();
      assert.strictEqual(
        run(dir, {
          GITHUB_ACTIONS: 'true',
          NEXT_PUBLIC_BASE_PATH: '/Explicit',
          DISABLE_BASE_PATH: 'true',
        }).basePath,
        ''
      );
    });
  });

  describe('identity', () => {
    it('prefers the env override pair, and needs BOTH halves', () => {
      const dir = makeFixture();
      const both = run(dir, {
        NEXT_PUBLIC_PROJECT_NAME: 'Override',
        NEXT_PUBLIC_PROJECT_OWNER: 'someone',
      });
      assert.strictEqual(both.detectionSource, 'env');
      assert.strictEqual(both.projectName, 'Override');

      // One half alone is ignored entirely — it falls through to git.
      const half = run(dir, { NEXT_PUBLIC_PROJECT_NAME: 'Override' });
      assert.strictEqual(half.detectionSource, 'git');
      assert.strictEqual(half.projectName, 'Widget');
    });

    it('falls back to the template defaults with no remote', () => {
      const dir = makeFixture({ remote: null });
      const config = run(dir);
      assert.strictEqual(config.detectionSource, 'default');
      assert.strictEqual(config.projectName, 'ScriptHammer'); // rebrand:keep
    });

    it('parses SSH remotes as well as HTTPS', () => {
      const dir = makeFixture({ remote: 'git@github.com:acme/Widget.git' });
      const config = run(dir, { GITHUB_ACTIONS: 'true' });
      assert.strictEqual(config.projectOwner, 'acme');
      assert.strictEqual(config.basePath, '/Widget');
    });
  });

  describe('writes', () => {
    it('creates .env.local once and never overwrites it', () => {
      // Write-once by design. A test that missed this would let a change silently start
      // clobbering a developer's local configuration.
      const dir = makeFixture();
      run(dir);
      const envPath = path.join(dir, '.env.local');
      assert.ok(fs.existsSync(envPath));

      fs.writeFileSync(envPath, 'HAND_EDITED=1\n');
      run(dir, { GITHUB_ACTIONS: 'true' });
      assert.strictEqual(fs.readFileSync(envPath, 'utf8'), 'HAND_EDITED=1\n');
    });

    it('is safe to run repeatedly — only the timestamp moves', () => {
      const dir = makeFixture();
      const first = run(dir, { GITHUB_ACTIONS: 'true' });
      const second = run(dir, { GITHUB_ACTIONS: 'true' });
      delete first.generatedAt;
      delete second.generatedAt;
      assert.deepStrictEqual(second, first);
    });
  });
});
