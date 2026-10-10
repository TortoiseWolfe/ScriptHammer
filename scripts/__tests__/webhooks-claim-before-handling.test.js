/**
 * Every webhook that writes `webhook_events` must go through the claim (#1307).
 *
 * WHY A SOURCE-LEVEL GUARD. Nothing in CI executes an Edge Function: `vitest.config.ts` excludes
 * `supabase/functions/**` and no workflow runs `deno test`. `_shared/webhook-claim.ts` is covered
 * behaviourally in `tests/unit/webhook-claim.test.ts`, but the WIRING has no such route. A webhook
 * that went back to its own `select ... .single()` check-then-insert would reintroduce the #1307
 * loss (a failed event answered "already processed" on every retry) with every check green.
 *
 * So, for each webhook: it imports the claim, calls all three of its entry points, and never
 * touches `webhook_events` itself.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const FN = path.resolve(__dirname, '..', '..', 'supabase', 'functions');
const CLAIM = path.join(FN, '_shared', 'webhook-claim.ts');

/** Block and full-line `//` comments removed, so this cannot match its own rationale. */
function code(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const WEBHOOKS = ['stripe-webhook', 'paypal-webhook', 'calcom-webhook'].map(
  (name) => [name, path.join(FN, name, 'index.ts')]
);

describe('webhooks claim an event before handling it (#1307)', () => {
  it('the claim module exists and is what the unit tests cover', () => {
    // Anti-vacuity: a moved file would make every assertion below pass by inspecting nothing.
    assert.ok(fs.existsSync(CLAIM), 'webhook-claim.ts is gone');
    const src = code(CLAIM);
    for (const fn of [
      'claimWebhookEvent',
      'finishWebhookEvent',
      'failWebhookEvent',
    ]) {
      assert.match(src, new RegExp(`export async function ${fn}\\(`), fn);
    }
  });

  it('every function that writes webhook_events is in this list', () => {
    // A NEW webhook that writes the ledger directly would otherwise escape this guard entirely.
    const writers = fs
      .readdirSync(FN, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== '_shared')
      .map((d) => d.name)
      .filter((name) => {
        const file = path.join(FN, name, 'index.ts');
        return (
          fs.existsSync(file) &&
          /from\(\s*'webhook_events'\s*\)|claimWebhookEvent\(/.test(code(file))
        );
      })
      .sort();
    assert.deepStrictEqual(
      writers,
      WEBHOOKS.map(([name]) => name).sort(),
      'a function reads or writes webhook_events but is not covered by this guard'
    );
  });

  for (const name of ['stripe-webhook', 'paypal-webhook']) {
    it(`${name} checks an intent reference is ours before every payment_intents lookup`, () => {
      // A lookup error now throws and the claim retries it (#1307). A reference that was never
      // ours (a PayPal Invoicing `INV2-...`) makes the uuid lookup ERROR, so without the check a
      // permanent condition becomes MAX_ATTEMPTS retries and then a daily red alarm.
      const src = code(path.join(FN, name, 'index.ts'));
      const lookups = (src.match(/from\(\s*'payment_intents'\s*\)/g) || [])
        .length;
      const checks = (src.match(/isOurIntentRef\(/g) || []).length;
      assert.ok(
        lookups > 0,
        `${name} no longer looks up payment_intents; update this guard`
      );
      assert.ok(
        checks >= lookups,
        `${name} has ${lookups} payment_intents lookup(s) but only ${checks} isOurIntentRef check(s)`
      );
    });
  }

  for (const [name, file] of WEBHOOKS) {
    it(`${name} claims, finishes and fails through the shared module`, () => {
      const src = code(file);
      assert.match(
        src,
        /from '\.\.\/_shared\/webhook-claim\.ts'/,
        `${name} does not import the claim`
      );
      for (const call of [
        'claimWebhookEvent',
        'finishWebhookEvent',
        'failWebhookEvent',
      ]) {
        assert.match(
          src,
          new RegExp(`await ${call}\\(`),
          `${name} never calls ${call}`
        );
      }
    });

    it(`${name} never touches webhook_events itself`, () => {
      // The old check-then-insert lived here. Any direct read or write bypasses the claim.
      assert.doesNotMatch(
        code(file),
        /from\(\s*'webhook_events'\s*\)/,
        `${name} reads or writes webhook_events directly, around the claim (#1307)`
      );
    });
  }
});
