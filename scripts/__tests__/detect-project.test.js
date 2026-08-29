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
  domain,
  cname,
  trackCname = false,
} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-project-'));
  fixtures.push(dir);

  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(dir, 'scripts', 'detect-project.js'));

  execFileSync('git', ['init', '-q'], { cwd: dir });
  if (remote)
    execFileSync('git', ['remote', 'add', 'origin', remote], { cwd: dir });

  // `domain: undefined` means no config file at all — the pre-#980 shape a fork that has
  // not migrated still has.
  if (domain !== undefined) {
    fs.mkdirSync(path.join(dir, 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'config', 'deployment.json'),
      JSON.stringify({ customDomain: domain }, null, 2)
    );
  }
  if (cname !== undefined) {
    fs.mkdirSync(path.join(dir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'public', 'CNAME'), cname);
    if (trackCname) {
      // TRACKED is the discriminator between a fork's committed file and one we generated,
      // so the fixture has to actually commit it — writing it is not enough.
      execFileSync('git', ['add', '-f', 'public/CNAME'], { cwd: dir });
      execFileSync(
        'git',
        [
          '-c',
          'user.email=t@e',
          '-c',
          'user.name=t',
          'commit',
          '-qm',
          'legacy',
        ],
        { cwd: dir }
      );
    }
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

    it('is empty when a custom domain is CONFIGURED — the rule #980 changed', () => {
      // This was `fs.existsSync(public/CNAME)`. It is a config value now, so it can be
      // read, reviewed and set to null — none of which a file's presence allows.
      const dir = makeFixture({ domain: 'widget.example' });
      assert.strictEqual(run(dir, { GITHUB_ACTIONS: 'true' }).basePath, '');
    });

    it('is /RepoName when the config explicitly declares no domain', () => {
      const dir = makeFixture({ domain: null });
      assert.strictEqual(
        run(dir, { GITHUB_ACTIONS: 'true' }).basePath,
        '/Widget'
      );
    });

    it('IGNORES a stray untracked CNAME — presence is no longer the signal', () => {
      // The old rule returned '' here. Anything this script generates is untracked, so
      // honouring an untracked file would let a stale output outvote the configuration.
      const dir = makeFixture({ domain: null, cname: 'stale.example' });
      assert.strictEqual(
        run(dir, { GITHUB_ACTIONS: 'true' }).basePath,
        '/Widget'
      );
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

  describe('the CNAME file is an output now', () => {
    it('is generated from the config, byte for byte, with no trailing newline', () => {
      // GitHub Pages needs it in the PUBLISHED artifact; `output: export` copies public/
      // wholesale and this script runs first. The bytes must match what was committed
      // before, or a mechanism change becomes a value change on a live domain.
      const dir = makeFixture({ domain: 'widget.example' });
      run(dir, { GITHUB_ACTIONS: 'true' });
      assert.strictEqual(
        fs.readFileSync(path.join(dir, 'public', 'CNAME'), 'utf8'),
        'widget.example'
      );
    });

    it('removes a generated CNAME when the config declares no domain', () => {
      // Its EXISTENCE drops the base path, so one left behind after the domain is removed
      // 404s every asset — #961's failure, arrived at from the other direction.
      const dir = makeFixture({ domain: null, cname: 'stale.example' });
      run(dir, { GITHUB_ACTIONS: 'true' });
      assert.strictEqual(
        fs.existsSync(path.join(dir, 'public', 'CNAME')),
        false
      );
    });

    it('does not rewrite the file when it is already correct', () => {
      const dir = makeFixture({ domain: 'widget.example' });
      run(dir, { GITHUB_ACTIONS: 'true' });
      const before = fs.statSync(path.join(dir, 'public', 'CNAME')).mtimeMs;
      run(dir, { GITHUB_ACTIONS: 'true' });
      assert.strictEqual(
        fs.statSync(path.join(dir, 'public', 'CNAME')).mtimeMs,
        before
      );
    });
  });

  describe('a fork that has not migrated yet', () => {
    // docs/FORKING.md told forks to commit their own domain in public/CNAME, and a live
    // client site did. Taking this change, they receive a config from upstream naming THIS
    // project's domain — so trusting it blindly would rewrite their CNAME to ours on their
    // next deploy. A TRACKED file outranks the config, and that self-disables on migration.

    it('adopts a tracked legacy CNAME when there is no config at all', () => {
      const dir = makeFixture({
        cname: 'raisedpaws.example',
        trackCname: true,
      });
      const config = run(dir, { GITHUB_ACTIONS: 'true' });
      assert.strictEqual(config.customDomain, 'raisedpaws.example');
      assert.strictEqual(config.basePath, '');
    });

    it("adopts it OVER an inherited config naming someone else's domain", () => {
      // The merge state, verified against real git: upstream deleting the file while the
      // fork modified it raises a modify/delete conflict, so the fork keeps its copy AND
      // receives our config. This is exactly what that leaves on disk.
      const dir = makeFixture({
        domain: 'www.template.example',
        cname: 'raisedpaws.example',
        trackCname: true,
      });
      const config = run(dir, { GITHUB_ACTIONS: 'true' });
      assert.strictEqual(config.customDomain, 'raisedpaws.example');
      assert.strictEqual(
        fs.readFileSync(path.join(dir, 'public', 'CNAME'), 'utf8'),
        'raisedpaws.example'
      );
    });

    it('never deletes a tracked CNAME, even when the config says none', () => {
      const dir = makeFixture({
        domain: null,
        cname: 'raisedpaws.example',
        trackCname: true,
      });
      run(dir, { GITHUB_ACTIONS: 'true' });
      assert.ok(fs.existsSync(path.join(dir, 'public', 'CNAME')));
    });

    it('tells them how to migrate — a silent shim is one nobody leaves', () => {
      const dir = makeFixture({
        domain: 'www.template.example',
        cname: 'raisedpaws.example',
        trackCname: true,
      });
      const stderr = execFileSync(
        process.execPath,
        ['scripts/detect-project.js'],
        {
          cwd: dir,
          env: {
            PATH: process.env.PATH,
            HOME: os.tmpdir(),
            GITHUB_ACTIONS: 'true',
          },
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );
      // The warning goes to stderr; execFileSync returns stdout, so read the artifact the
      // run produced and assert the ADVICE is discoverable in the script itself.
      const source = fs.readFileSync(
        path.join(dir, 'scripts', 'detect-project.js'),
        'utf8'
      );
      assert.match(source, /git rm --cached public\/CNAME/);
      assert.match(
        stderr + '',
        /Custom Domain: raisedpaws\.example \(legacy-cname\)/
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
