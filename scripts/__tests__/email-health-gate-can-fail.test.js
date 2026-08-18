/**
 * The email-health gate must be able to fail (#572, item 3).
 *
 * WHAT WENT WRONG. `check-email-health.mjs` shipped with two branches: over-threshold
 * in `block` mode exits 1, and over-threshold in `annotate` mode prints a warning and
 * exits 0. The workflow ran in `annotate` from the day it was written, with a comment
 * saying to flip it "once the window has rolled past 2026-08-02". That date passed and
 * the flip was not made, so for sixteen days a gate whose whole purpose is to catch a
 * bounce spike would have reported one and passed.
 *
 * The enforcing branch was therefore never exercised anywhere — not in CI, not in a
 * real run. Flipping the switch without checking it does something is how a gate ends
 * up green because it cannot fail rather than because the thing it watches is fine;
 * this repo has paid for that shape repeatedly (#396, #411, #457).
 *
 * HOW THIS TESTS IT. The script is run for real, as a child process, against a local
 * stub standing in for the Resend API, so the assertion is on the process's exit code
 * rather than on a string in a file. The four cases pin the two axes that decide it:
 * the mode, and the minimum sample below which a rate is noise.
 *
 * WHAT IT CANNOT CHECK: that Resend's real payload matches the stub's shape, or that
 * the workflow's secret is valid. It proves the gate's decision logic and the wiring
 * of the mode, not the live integration.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'check-email-health.mjs');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'email-health.yml');

/** An hour-old batch of sends, `bounced` of which hard-bounced. */
function emails(total, bounced) {
  const at = new Date(Date.now() - 3600e3)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
  return Array.from({ length: total }, (_, i) => ({
    id: `e${i}`,
    created_at: at,
    last_event: i < bounced ? 'bounced' : 'delivered',
    to: [`x${i}@example.com`],
  }));
}

function stub(payload) {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ data: payload, has_more: false }));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/**
 * Run the real script against the stub and return its exit code.
 *
 * `spawn`, never `spawnSync`: the stub server lives in this process, and a synchronous
 * child blocks the event loop so the server can never answer it — the run just hangs.
 */
async function exitCode({ total, bounced, mode }) {
  const server = await stub(emails(total, bounced));
  const { port } = server.address();
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [SCRIPT, '--mode', mode], {
        env: {
          ...process.env,
          RESEND_API_KEY: 'stub-key-not-a-secret',
          EMAIL_HEALTH_API: `http://127.0.0.1:${port}`,
        },
        stdio: 'ignore',
      });
      child.on('error', reject);
      child.on('exit', (code) => resolve(code));
    });
  } finally {
    server.close();
  }
}

describe('the email-health gate can actually fail (#572)', () => {
  it('fails the run when the bounce rate is over threshold in block mode', async () => {
    // The assertion the whole gate exists for. 50% bounced, well past the 5% budget.
    assert.equal(
      await exitCode({ total: 20, bounced: 10, mode: 'block' }),
      1,
      'block mode did not fail on a 50% bounce rate — the gate cannot enforce anything'
    );
  });

  it('reports without failing in annotate mode, on the same data', async () => {
    // The control that gives the test above its meaning: identical input, different
    // mode, different outcome. If this also exited 1, the first assertion would prove
    // nothing about the mode wiring.
    assert.equal(
      await exitCode({ total: 20, bounced: 10, mode: 'annotate' }),
      0,
      'annotate mode failed the run; it is supposed to report only'
    );
  });

  it('passes a healthy window in block mode', async () => {
    // A gate that fails on good input is worse than none: it gets muted.
    assert.equal(
      await exitCode({ total: 20, bounced: 0, mode: 'block' }),
      0,
      'block mode failed a window with zero bounces'
    );
  });

  it('does not cry wolf below the minimum sample', async () => {
    // 3 of 3 is 100% and means nothing. The floor must hold in block mode too,
    // otherwise flipping the switch turns every quiet week into a red run.
    assert.equal(
      await exitCode({ total: 3, bounced: 3, mode: 'block' }),
      0,
      'block mode failed on a 3-send sample; the min-sample floor is not holding'
    );
  });

  it('the workflow actually runs in block mode', async () => {
    // The behaviour above is only reached if the workflow asks for it. This is the
    // half that was wrong for sixteen days: the enforcing branch existed and worked,
    // and nothing ever selected it.
    const yaml = fs.readFileSync(WORKFLOW, 'utf8');
    const line = yaml
      .split('\n')
      .find(
        (l) => l.includes('EMAIL_HEALTH_MODE:') && !l.trim().startsWith('#')
      );

    assert.ok(
      line,
      'no EMAIL_HEALTH_MODE assignment found in email-health.yml'
    );
    assert.match(
      line,
      /\|\|\s*'block'/,
      `email-health.yml falls back to a non-blocking mode: ${line.trim()}\n` +
        `A gate in annotate mode reports a bounce spike and passes anyway. Flipping ` +
        `it back needs a reason recorded in the workflow, not a silent default.`
    );
  });
});
