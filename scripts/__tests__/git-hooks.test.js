/**
 * Git-hook setup must work from both a primary checkout and a linked worktree
 * (#672). Husky's ignored .husky/_ shims do not exist in linked worktrees, so
 * a green commit there previously meant no hook ran at all.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  chmodSync,
  statSync,
  readFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const CONFIGURE_HOOKS = path.join(ROOT, 'scripts', 'configure-git-hooks.js');
const PRE_COMMIT = path.join(ROOT, '.husky', 'pre-commit');
const PRE_PUSH = path.join(ROOT, '.husky', 'pre-push');
const DOCKERFILES = [
  path.join(ROOT, 'docker', 'Dockerfile'),
  path.join(ROOT, 'docker', 'Dockerfile.e2e'),
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env,
  });
  assert.ifError(result.error);
  return result;
}

function expectSuccess(command, args, options = {}) {
  const result = run(command, args, options);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  return result;
}

function makeRepository() {
  const repository = mkdtempSync(path.join(tmpdir(), 'git-hooks-main-'));
  const emptyHooks = path.join(repository, 'empty-hooks');
  mkdirSync(emptyHooks);
  mkdirSync(path.join(repository, '.husky'));
  writeFileSync(path.join(repository, 'README.md'), '# fixture\n');
  writeFileSync(
    path.join(repository, '.husky', 'pre-commit'),
    '#!/bin/sh\nprintf "HOOK_RAN\\n"\n'
  );
  writeFileSync(
    path.join(repository, '.husky', 'pre-push'),
    '#!/bin/sh\nprintf "PUSH_HOOK_RAN\\n"\n'
  );
  chmodSync(path.join(repository, '.husky', 'pre-commit'), 0o755);
  chmodSync(path.join(repository, '.husky', 'pre-push'), 0o755);

  expectSuccess('git', ['init'], { cwd: repository });
  expectSuccess('git', ['config', 'user.name', 'Hook Test'], {
    cwd: repository,
  });
  expectSuccess('git', ['config', 'user.email', 'hook-test@example.test'], {
    cwd: repository,
  });
  expectSuccess('git', ['add', '.'], { cwd: repository });
  expectSuccess(
    'git',
    ['-c', 'core.hooksPath=' + emptyHooks, 'commit', '-m', 'initial fixture'],
    { cwd: repository }
  );

  return repository;
}

test('versioned hooks are configured and run in a linked worktree', () => {
  const repository = makeRepository();
  const worktree = repository + '-worktree';
  const remote = repository + '-remote.git';

  try {
    const setup = run(process.execPath, [CONFIGURE_HOOKS], {
      cwd: repository,
    });
    assert.strictEqual(setup.status, 0, setup.stdout + setup.stderr);
    assert.match(setup.stdout, /Configured versioned Git hooks/);

    const configuredPath = expectSuccess(
      'git',
      ['config', '--local', '--get', 'core.hooksPath'],
      { cwd: repository }
    );
    assert.strictEqual(configuredPath.stdout.trim(), '.husky');

    const mainHook = expectSuccess('git', ['hook', 'run', 'pre-commit'], {
      cwd: repository,
    });
    assert.match(mainHook.stdout + mainHook.stderr, /HOOK_RAN/);

    writeFileSync(path.join(repository, 'main.txt'), 'main commit\n');
    expectSuccess('git', ['add', 'main.txt'], { cwd: repository });
    const mainCommit = expectSuccess(
      'git',
      ['commit', '-m', 'main hook check'],
      {
        cwd: repository,
      }
    );
    assert.match(mainCommit.stdout + mainCommit.stderr, /HOOK_RAN/);

    expectSuccess('git', ['init', '--bare', remote], { cwd: repository });
    expectSuccess('git', ['remote', 'add', 'origin', remote], {
      cwd: repository,
    });
    const mainBranch = expectSuccess('git', ['branch', '--show-current'], {
      cwd: repository,
    }).stdout.trim();
    const mainPush = expectSuccess(
      'git',
      ['push', '-u', 'origin', mainBranch],
      {
        cwd: repository,
      }
    );
    assert.match(mainPush.stdout + mainPush.stderr, /PUSH_HOOK_RAN/);

    expectSuccess('git', ['worktree', 'add', '-b', 'hook-test', worktree], {
      cwd: repository,
    });
    const worktreeHook = expectSuccess('git', ['hook', 'run', 'pre-commit'], {
      cwd: worktree,
    });
    assert.match(worktreeHook.stdout + worktreeHook.stderr, /HOOK_RAN/);

    writeFileSync(path.join(worktree, 'worktree.txt'), 'worktree commit\n');
    expectSuccess('git', ['add', 'worktree.txt'], { cwd: worktree });
    const worktreeCommit = expectSuccess(
      'git',
      ['commit', '-m', 'worktree hook check'],
      { cwd: worktree }
    );
    assert.match(worktreeCommit.stdout + worktreeCommit.stderr, /HOOK_RAN/);
    const worktreePush = expectSuccess(
      'git',
      ['push', '-u', 'origin', 'hook-test'],
      { cwd: worktree }
    );
    assert.match(worktreePush.stdout + worktreePush.stderr, /PUSH_HOOK_RAN/);
  } finally {
    run('git', ['worktree', 'remove', '--force', worktree], {
      cwd: repository,
    });
    rmSync(repository, { recursive: true, force: true });
    rmSync(remote, { recursive: true, force: true });
  }
});

test('setup fails loudly when a required tracked hook is missing', () => {
  const repository = makeRepository();

  try {
    rmSync(path.join(repository, '.husky', 'pre-push'));
    const setup = run(process.execPath, [CONFIGURE_HOOKS], {
      cwd: repository,
    });
    assert.notStrictEqual(setup.status, 0);
    assert.match(setup.stderr, /Required Git hook is missing/);
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});

test('setup fails when a worktree git pointer cannot resolve', () => {
  const directory = mkdtempSync(
    path.join(tmpdir(), 'git-hooks-broken-pointer-')
  );

  try {
    writeFileSync(
      path.join(directory, '.git'),
      'gitdir: /not-mounted/.git/worktrees/test\n'
    );
    const setup = run(process.execPath, [CONFIGURE_HOOKS], {
      cwd: directory,
      env: { PATH: '' },
    });
    assert.notStrictEqual(setup.status, 0);
    assert.match(
      setup.stderr,
      /Git metadata is present but cannot be resolved/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('setup is a no-op outside a Git checkout', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'git-hooks-no-checkout-'));

  try {
    const setup = run(process.execPath, [CONFIGURE_HOOKS], {
      cwd: directory,
      env: { PATH: '' },
    });
    assert.strictEqual(setup.status, 0, setup.stdout + setup.stderr);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('tracked pre-commit and pre-push hooks are executable', () => {
  for (const hook of [PRE_COMMIT, PRE_PUSH]) {
    assert.notStrictEqual(
      statSync(hook).mode & 0o111,
      0,
      hook + ' is not executable'
    );
  }
});

test('security hooks fail when gitleaks is unavailable', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'git-hooks-no-gitleaks-'));

  try {
    for (const hook of [PRE_COMMIT, PRE_PUSH]) {
      const result = run('/bin/sh', [hook], {
        cwd: directory,
        env: { PATH: '' },
      });
      const output = result.stdout + result.stderr;
      assert.strictEqual(result.status, 1, output);
      // IT MUST SAY IT COULD NOT SCAN — not that it found something (#747).
      // pre-commit used to report every non-zero exit as "Secrets detected", so a
      // missing .env in a worktree sent the reader hunting a leak that did not
      // exist. Each hook words this its own way; what matters is that a scanner
      // which never ran is never dressed up as a finding.
      assert.match(
        output,
        /gitleaks is required|could NOT RUN|cannot scan/i,
        'a hook that cannot scan must say so: ' + output
      );
      assert.doesNotMatch(
        output,
        /Secrets detected/,
        'gitleaks was unavailable, so reporting detected secrets is a false ' +
          'report — the #747 defect: ' +
          output
      );
      assert.doesNotMatch(output, /skipping secret scan/);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('prepare runs the versioned hook setup instead of Husky shim generation', () => {
  const packageJson = require(path.join(ROOT, 'package.json'));
  assert.strictEqual(
    packageJson.scripts.prepare,
    'node scripts/configure-git-hooks.js'
  );
});

test('Docker dependency stages copy the prepare script before pnpm install', () => {
  for (const dockerfile of DOCKERFILES) {
    const source = readFileSync(dockerfile, 'utf8');
    const copy =
      'COPY scripts/configure-git-hooks.js ./scripts/configure-git-hooks.js';
    assert.ok(
      source.includes(copy),
      dockerfile + ' does not copy the prepare script'
    );
    assert.ok(
      source.indexOf(copy) < source.indexOf('pnpm install'),
      dockerfile + ' copies the prepare script after pnpm install'
    );
  }
});
