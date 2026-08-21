/**
 * The offline payment queue's automatic drain must actually be wired up (#895).
 *
 * WHY THIS EXISTS. `src/lib/payments/connection-listener.ts` was written to "auto-sync
 * offline queue when online" and **nothing ever called it**. `startConnectionListener`
 * sat with zero callers, and it is the only caller of `processPendingOperations()`, which
 * is the only non-shim caller of `paymentQueue.sync()` — so the entire automatic drain
 * chain was dead. A payment submitted offline was written to IndexedDB and stayed there
 * until the buyer navigated to the payment hub and found the manual retry button.
 *
 * It had unit tests the whole time. That is the point: **a module can be fully tested and
 * called by nobody.** Its tests exercised the function; nothing asserted the application
 * used it. This test asserts the wiring instead — the thing that was missing.
 *
 * The second assertion guards the change that made wiring it possible at all. The listener
 * used to run `isSupabaseOnline()` — a real Supabase query — BEFORE checking whether
 * anything was queued, so mounting it anywhere cost a network round trip every 30 seconds
 * for every visitor, almost all of whom have an empty queue. That cost is why it was never
 * mounted. Reversing those two calls would silently restore the cost, and nothing else
 * would go red.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LISTENER = path.join(
  REPO_ROOT,
  'src/lib/payments/connection-listener.ts'
);

/**
 * Comments are not code, and this file's own comments name both functions it checks the
 * order of. Matching them would make the ordering assertion pass with the calls reversed —
 * a mistake made repeatedly in this repo, most recently in scripts/render-talk.mjs.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Files under src/ whose CODE references the symbol — comments stripped first.
 *
 * The stripping is not tidiness, it is the whole correctness of this check. The first
 * version grepped raw text, and PaymentQueueSync's own docblock names
 * `startConnectionListener` while explaining why it exists. So when the mount was deleted
 * as a mutation test, the docblock alone still counted as a caller and this test stayed
 * GREEN through the exact defect it was written to catch. Caught by running the mutation;
 * it would never have been caught by reading it.
 */
function referencingFiles(symbol) {
  let out = '';
  try {
    out = execFileSync(
      'grep',
      ['-rl', symbol, 'src', '--include=*.ts', '--include=*.tsx'],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    );
  } catch {
    return []; // grep exits 1 on no matches
  }
  return out
    .split('\n')
    .filter(Boolean)
    .filter((f) => !f.includes('connection-listener'))
    .filter((f) => !/\.test\.tsx?$|\.stories\.tsx?$|__tests__/.test(f))
    .filter((f) => {
      const code = stripComments(
        fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')
      );
      return new RegExp(`\\b${symbol}\\b`).test(code);
    });
}

describe('the offline payment queue drain is actually wired up (#895)', () => {
  it('the listener module is where this test thinks it is', () => {
    // Anti-vacuity: a moved or renamed file would otherwise make every assertion below
    // pass by finding nothing.
    assert.ok(
      fs.existsSync(LISTENER),
      `${LISTENER} is gone — this test is stale`
    );
    const code = stripComments(fs.readFileSync(LISTENER, 'utf8'));
    assert.match(
      code,
      /export function startConnectionListener\s*\(/,
      'startConnectionListener is no longer exported from connection-listener.ts'
    );
  });

  it('exactly one non-test module starts the listener', () => {
    const callers = referencingFiles('startConnectionListener');

    assert.notDeepStrictEqual(
      callers,
      [],
      'NOTHING calls startConnectionListener. This is the #895 defect exactly: the ' +
        'offline payment queue has no automatic drain, so a payment queued while ' +
        'offline sits in IndexedDB until the buyer finds the manual retry button on ' +
        'the payment hub. Mount <PaymentQueueSync /> in the root layout.'
    );

    // Exactly one, not at least one. The listener is a module-level singleton guarded by
    // `isListening`: a second mount gets handed `stopConnectionListener`, and then the
    // first unmount to run kills the listener for both.
    assert.deepStrictEqual(
      callers,
      ['src/components/payment/PaymentQueueSync/PaymentQueueSync.tsx'],
      `startConnectionListener is started from ${callers.length} modules. It is a ` +
        'module-level singleton — mounting it twice means either unmount disarms both. ' +
        'Keep the single mount in PaymentQueueSync.'
    );
  });

  it('the cheap local check still runs before the network probe', () => {
    const code = stripComments(fs.readFileSync(LISTENER, 'utf8'));

    const pending = code.indexOf('await getPendingCount()');
    const online = code.indexOf('await isSupabaseOnline()');

    assert.ok(
      pending !== -1,
      'no `await getPendingCount()` call found in the listener'
    );
    assert.ok(
      pending !== -1 && online !== -1,
      'no `await isSupabaseOnline()` call found'
    );
    assert.ok(
      pending < online,
      'connection-listener.ts probes the network before checking whether anything is ' +
        'queued. `isSupabaseOnline()` runs a real Supabase query; `getPendingCount()` is ' +
        'a local IndexedDB read. In that order the listener costs a round trip every 30 ' +
        'seconds on every page for every visitor — which is why it was never mounted at ' +
        'all, and why nothing drained (#895). Check the queue first.'
    );
  });

  it('the component that does the mounting renders nothing', () => {
    // It sits in the root layout ABOVE the skip link. Anything it rendered would land
    // ahead of "Skip to main content" on every route for every keyboard user (#475).
    const cmp = path.join(
      REPO_ROOT,
      'src/components/payment/PaymentQueueSync/PaymentQueueSync.tsx'
    );
    assert.ok(fs.existsSync(cmp), 'PaymentQueueSync.tsx is gone');
    assert.match(
      stripComments(fs.readFileSync(cmp, 'utf8')),
      /return null;/,
      'PaymentQueueSync no longer returns null. It is mounted in the root layout above ' +
        'the skip link; it must contribute no DOM.'
    );
  });
});
