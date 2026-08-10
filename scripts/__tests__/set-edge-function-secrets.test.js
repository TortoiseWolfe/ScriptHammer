/**
 * Permission guard for the Edge Function secret setter (#614).
 *
 * These exercise the executable in a child process rather than importing a helper:
 * the ordering is the property. An unsafe config must be refused before the setter
 * checks credentials, reads the file, or can reach the Management API.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { chmodSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const REPO = resolve(__dirname, '..', '..');
const SETTER = join(REPO, 'scripts/supabase/set-edge-function-secrets.ts');
const POSIX_ONLY = {
  skip: process.platform === 'win32' && 'POSIX mode bits are not Windows ACLs',
};

function runSetter(configMode) {
  const root = mkdtempSync(join(tmpdir(), 'edge-function-secrets-'));
  const configPath = join(root, 'edge-function-secrets.json');
  writeFileSync(configPath, '{"STRIPE_SECRET_KEY":"test-only-value"}\n');
  // writeFileSync observes the umask, so set the exact mode the regression needs.
  chmodSync(configPath, configMode);

  const env = { ...process.env };
  delete env.SUPABASE_ACCESS_TOKEN;
  delete env.NEXT_PUBLIC_SUPABASE_PROJECT_REF;
  delete env.SUPABASE_PROJECT_REF;

  try {
    const child = spawnSync(
      process.execPath,
      ['--import', 'tsx', SETTER, '--config', configPath],
      {
        cwd: REPO,
        encoding: 'utf8',
        env,
        timeout: 10_000,
      }
    );
    return {
      status: child.status,
      output: `${child.stdout ?? ''}${child.stderr ?? ''}${child.error?.message ?? ''}`,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test(
  'refuses a 0644 config before credential validation or an API request',
  POSIX_ONLY,
  () => {
    const result = runSetter(0o644);

    assert.notStrictEqual(result.status, 0, result.output);
    assert.match(
      result.output,
      /Refusing to read .*edge-function-secrets\.json/
    );
    assert.match(result.output, /mode 0644/);
    assert.match(result.output, /chmod 600/);
    assert.doesNotMatch(result.output, /SUPABASE_ACCESS_TOKEN is not set/);
  }
);

test(
  'allows a 0600 config through to intentional missing-token validation',
  POSIX_ONLY,
  () => {
    const result = runSetter(0o600);

    assert.strictEqual(result.status, 1, result.output);
    assert.match(result.output, /SUPABASE_ACCESS_TOKEN is not set/);
    assert.doesNotMatch(result.output, /Refusing to read/);
  }
);
