/**
 * The graphify hooks in `.claude/settings.json` must work on any machine (#1455).
 *
 * They once named `/home/TurtleWolfe/.local/bin/graphify`, one developer's home
 * folder. Everywhere else the file does not exist, so every Bash, Grep, Read and
 * Glob call in the repo printed a hook failure.
 *
 * Contract, run against the real command strings with a throwaway HOME and PATH:
 *   - no path in the file names a person's home folder;
 *   - graphify missing => exit 0 and no output (the hook is silent);
 *   - graphify on PATH, or at $HOME/.local/bin => it runs with the same
 *     arguments (`hook-guard search` / `hook-guard read`) and its exit code is kept.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const settingsPath = join(here, '..', '..', '.claude', 'settings.json');
const raw = readFileSync(settingsPath, 'utf8');
const settings = JSON.parse(raw);

const commands = {};
for (const group of settings.hooks.PreToolUse) {
  for (const h of group.hooks) {
    const m = h.command.match(/hook-guard (search|read)/);
    if (m) commands[m[1]] = h.command;
  }
}

/** A fake graphify that records its arguments and exits with `code`. */
function fakeGraphify(dir, code = 0) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'graphify');
  writeFileSync(file, `#!/bin/sh\necho "ran: $*"\nexit ${code}\n`);
  chmodSync(file, 0o755);
}

function run(command, { home, path }) {
  return spawnSync('/bin/sh', ['-c', command], {
    env: { HOME: home, PATH: path },
    encoding: 'utf8',
  });
}

test('both hooks are present', () => {
  assert.ok(commands.search, 'hook-guard search hook missing');
  assert.ok(commands.read, 'hook-guard read hook missing');
});

test('no path in the file names a person’s home folder', () => {
  assert.doesNotMatch(raw, /\/home\/[A-Za-z0-9_.-]+/);
  assert.doesNotMatch(raw, /\/Users\/[A-Za-z0-9_.-]+/);
});

for (const kind of ['search', 'read']) {
  test(`${kind}: silent and exit 0 when graphify is not installed`, () => {
    const home = mkdtempSync(join(tmpdir(), 'hook-home-'));
    const r = run(commands[kind], { home, path: '/usr/bin:/bin' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, '');
  });

  test(`${kind}: runs graphify from PATH with the same arguments`, () => {
    const home = mkdtempSync(join(tmpdir(), 'hook-home-'));
    const bin = mkdtempSync(join(tmpdir(), 'hook-bin-'));
    fakeGraphify(bin);
    const r = run(commands[kind], { home, path: `${bin}:/usr/bin:/bin` });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), `ran: hook-guard ${kind}`);
  });

  test(`${kind}: falls back to $HOME/.local/bin/graphify`, () => {
    const home = mkdtempSync(join(tmpdir(), 'hook-home-'));
    fakeGraphify(join(home, '.local', 'bin'));
    const r = run(commands[kind], { home, path: '/usr/bin:/bin' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), `ran: hook-guard ${kind}`);
  });

  test(`${kind}: keeps graphify's own exit code`, () => {
    const home = mkdtempSync(join(tmpdir(), 'hook-home-'));
    const bin = mkdtempSync(join(tmpdir(), 'hook-bin-'));
    fakeGraphify(bin, 2);
    const r = run(commands[kind], { home, path: `${bin}:/usr/bin:/bin` });
    assert.equal(r.status, 2);
  });
}
