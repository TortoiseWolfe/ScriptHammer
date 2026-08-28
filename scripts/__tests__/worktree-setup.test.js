/**
 * A git worktree must be usable with the Docker-first workflow CLAUDE.md recommends
 * (#932).
 *
 * WHY THIS EXISTS. CLAUDE.md says "prefer a sibling worktree for parallel
 * implementation". That did not work out of the box: in a worktree `.git` is a FILE
 * holding a `gitdir:` pointer into the parent repository, which lives outside the
 * Compose bind mount. The path does not resolve inside the container, husky's
 * `prepare` exits 1 during `pnpm install`, and the container crashloops — with nothing
 * in the output naming the worktree as the cause. An hour, twice, because the second
 * service (`builder`) needs the same mount and fails identically one step later.
 *
 * Exercised against a REAL `git worktree add` rather than a fixture with a
 * hand-written .git file, because the pointer's exact shape is the thing under test.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * A tiny repo with the two files the script reads, then a worktree of it. Building on
 * a scratch repo rather than adding a worktree of THIS one keeps the test from
 * leaving worktree registrations behind in the real repository.
 */
function scratchWorktree() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-'));
  const main = path.join(base, 'main');
  fs.mkdirSync(path.join(main, 'scripts', 'lib'), { recursive: true });
  git(['init', '-q', '-b', 'main', main], base);
  git(['config', 'user.email', 'test@example.com'], main);
  git(['config', 'user.name', 'test'], main);

  fs.copyFileSync(
    path.join(ROOT, 'scripts', 'worktree-setup.sh'),
    path.join(main, 'scripts', 'worktree-setup.sh')
  );
  fs.chmodSync(path.join(main, 'scripts', 'worktree-setup.sh'), 0o755);
  fs.copyFileSync(
    path.join(ROOT, 'scripts', 'lib', 'compose-service.sh'),
    path.join(main, 'scripts', 'lib', 'compose-service.sh')
  );
  // The service name is READ, never assumed: rebrand.sh renames it, and a hardcoded
  // one would write an override for a service the fork does not have (#957).
  fs.writeFileSync(
    path.join(main, 'docker-compose.yml'),
    'services:\n  widgetworks:\n    image: node\n  builder:\n    image: node\n'
  );
  fs.writeFileSync(
    path.join(main, '.env.example'),
    'NEXT_PUBLIC_X=placeholder\n'
  );
  git(['add', '-A'], main);
  git(['commit', '-qm', 'init'], main);

  const wt = path.join(base, 'wt');
  git(['worktree', 'add', '-q', '-b', 'side', wt], main);
  return { base, main, wt };
}

describe('worktree setup (#932)', () => {
  test('mounts the parent .git at the path the worktree pointer names', () => {
    const { base, wt } = scratchWorktree();
    try {
      // The premise. If .git stopped being a file, this test would pass while
      // covering nothing.
      assert.ok(
        fs.statSync(path.join(wt, '.git')).isFile(),
        "a worktree's .git must be a file for this test to mean anything"
      );
      const pointer = fs.readFileSync(path.join(wt, '.git'), 'utf8');
      const gitdir = pointer.replace(/^gitdir:\s*/, '').trim();

      execFileSync('bash', [path.join(wt, 'scripts', 'worktree-setup.sh')], {
        cwd: wt,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const override = fs.readFileSync(
        path.join(wt, 'docker-compose.override.yml'),
        'utf8'
      );

      // The mount has to cover the path the POINTER names, not merely mention the
      // parent repo somewhere. Both sides of the volume must be that path, or the
      // container looks in the right place and finds nothing.
      const mountedRoot = override.match(/^\s*- (\S+):(\S+)$/m);
      assert.ok(mountedRoot, `no volume mapping in:\n${override}`);
      assert.equal(
        mountedRoot[1],
        mountedRoot[2],
        'the mount must be at the same absolute path'
      );
      assert.ok(
        gitdir.startsWith(mountedRoot[1]),
        `the worktree points at ${gitdir}, which the mount ${mountedRoot[1]} does not cover`
      );
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  test('both services get the mount, not just the app one', () => {
    // This is the half that cost a separate debugging round: with only the app
    // service fixed, the container starts and the production build in the pre-push
    // gate fails the identical way one step later.
    const { base, wt } = scratchWorktree();
    try {
      execFileSync('bash', [path.join(wt, 'scripts', 'worktree-setup.sh')], {
        cwd: wt,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const override = fs.readFileSync(
        path.join(wt, 'docker-compose.override.yml'),
        'utf8'
      );
      // widgetworks, not a hardcoded template name — the service is read from
      // docker-compose.yml so a rebranded fork gets its own (#957).
      assert.match(override, /^ {2}widgetworks:$/m);
      assert.match(override, /^ {2}builder:$/m);
      assert.equal(
        (override.match(/^\s*- \S+:\S+$/gm) || []).length,
        2,
        'each service needs its own mount'
      );
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  test('gives the worktree its own compose project and port', () => {
    const { base, wt } = scratchWorktree();
    try {
      execFileSync('bash', [path.join(wt, 'scripts', 'worktree-setup.sh')], {
        cwd: wt,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const env = fs.readFileSync(path.join(wt, '.env'), 'utf8');
      assert.match(
        env,
        /^COMPOSE_PROJECT_NAME=wt$/m,
        'volumes would collide with the primary checkout'
      );
      assert.match(env, /^SH_PORT=\d+$/m);
      // Created from the example, never copied from a sibling: a worktree pointed at
      // the same backend is two agents writing to one database.
      assert.match(env, /NEXT_PUBLIC_X=placeholder/);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  test('is a no-op in an ordinary checkout', () => {
    const { base, main } = scratchWorktree();
    try {
      const out = execFileSync(
        'bash',
        [path.join(main, 'scripts', 'worktree-setup.sh')],
        {
          cwd: main,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
      assert.match(out, /Not a worktree/);
      assert.ok(
        !fs.existsSync(path.join(main, 'docker-compose.override.yml')),
        'a primary checkout must not get an override file'
      );
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  test('the entrypoint names the cause instead of crashlooping', () => {
    // The failure mode #932 is really about: the container restarting forever with
    // no mention of worktrees. Comments are stripped before matching, because this
    // file DISCUSSES the check at length and a guard that matches its own prose
    // passes with the code deleted.
    const src = fs
      .readFileSync(path.join(ROOT, 'docker', 'docker-entrypoint.sh'), 'utf8')
      .replace(/^\s*#.*$/gm, '');
    assert.match(
      src,
      /\[ -f \/app\/\.git \]/,
      'the entrypoint no longer detects a worktree'
    );
    assert.match(
      src,
      /gitdir/,
      'it must read the pointer, not just notice the file'
    );
    assert.match(src, /worktree-setup\.sh/, 'the error must name the fix');

    // And it must run BEFORE the install that fails, or it explains the problem
    // after the confusing error rather than instead of it.
    assert.ok(
      src.indexOf('/app/.git') < src.indexOf('pnpm install'),
      'the worktree check must come before pnpm install'
    );
  });
});
