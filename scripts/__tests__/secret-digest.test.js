/**
 * Guards the value-aware secret diff (#1182).
 *
 * WHAT WENT WRONG. `set-edge-function-secrets.ts` diffed by NAME and read desired state from
 * `.env`. "Already correct" and "about to be replaced with something else" printed
 * identically, `--apply` POSTed every allow-listed key unconditionally, and the verification
 * step only asked whether the NAME existed afterwards — which was already true before the
 * write. So it could report "N secret(s) set and verified" having changed nothing, or having
 * destroyed a live credential.
 *
 * WHY THAT IS NOT THEORETICAL. `STRIPE_SECRET_KEY` must be the LIVE key in the Edge Function
 * runtime, while `.env` must stay TEST-mode — `.env.example:317-322`, because
 * `tests/e2e/utils/test-user-factory.ts` provisions REAL subscriptions with it and a live key
 * there bills real money. The two stores legitimately hold different values for the same name.
 * One `--apply` used to be all it took to push the test key over production.
 *
 * The scenario in 'the real #1182 hazard' below is exactly the state of this project.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

let mod;
test.before(async () => {
  mod = await import('../supabase/secret-digest.mjs');
});

/** Deployed side, as the Management API returns it: name -> sha256 hex. */
const deployedAs = (obj) =>
  new Map(Object.entries(obj).map(([k, v]) => [k, mod.digest(v)]));

test('digest() matches the shape the Management API returns', () => {
  const d = mod.digest('whsec_example');
  assert.match(d, /^[0-9a-f]{64}$/, 'must be 64 lowercase hex chars');
  assert.equal(d, mod.digest('whsec_example'), 'must be stable');
  assert.notEqual(
    d,
    mod.digest('whsec_example '),
    'trailing space must change it'
  );
});

test('a value that already matches is UNCHANGED, not rewritten', () => {
  const desired = { A: 'same' };
  const c = mod.classifySecrets(desired, deployedAs({ A: 'same' }));
  assert.deepEqual(c.unchanged, ['A']);
  assert.deepEqual(c.overwrite, []);
  assert.deepEqual(c.fresh, []);
  assert.deepEqual(mod.namesToWrite(c, false), [], 'nothing to write');
});

test('a name absent upstream is NEW and is written without --force', () => {
  const desired = { A: 'v' };
  const c = mod.classifySecrets(desired, new Map());
  assert.deepEqual(c.fresh, ['A']);
  assert.deepEqual(mod.namesToWrite(c, false), ['A']);
});

test('a DIFFERENT deployed value is OVERWRITE, and is refused without --force', () => {
  const desired = { A: 'local' };
  const c = mod.classifySecrets(
    desired,
    deployedAs({ A: 'deployed-is-different' })
  );
  assert.deepEqual(c.overwrite, ['A']);
  assert.deepEqual(mod.namesToWrite(c, false), [], 'refused by default');
  assert.deepEqual(mod.namesToWrite(c, true), ['A'], '--force lets it through');
});

test('the real #1182 hazard: .env test key vs a deployed LIVE key', () => {
  // This project's actual state after #1185: `.env` holds the test-mode key on purpose, the
  // function runtime holds the live one on purpose, and a name-level diff cannot see the
  // difference. The fixture values are deliberately NOT shaped like real Stripe keys —
  // gitleaks pattern-matches those prefixes and blocks the commit, which is it working.
  const desired = {
    STRIPE_SECRET_KEY: '<test-mode key, the one in .env>',
    STRIPE_WEBHOOK_SECRET: 'whsec_shared',
    RESEND_API_KEY: 're_shared',
  };
  const deployed = deployedAs({
    STRIPE_SECRET_KEY: '<live-mode key, the one in the Vault>',
    STRIPE_WEBHOOK_SECRET: 'whsec_shared',
    RESEND_API_KEY: 're_shared',
  });

  const c = mod.classifySecrets(desired, deployed);
  assert.deepEqual(c.overwrite, ['STRIPE_SECRET_KEY']);
  assert.deepEqual(c.unchanged.sort(), [
    'RESEND_API_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ]);
  assert.deepEqual(
    mod.namesToWrite(c, false),
    [],
    'a plain --apply must write NOTHING here — it used to push the test key over production'
  );
});

test('CONTROL: the classifier can reach all three states, so the assertions above mean something', () => {
  const desired = { NEWNAME: 'a', SAME: 'b', DIVERGENT: 'c' };
  const c = mod.classifySecrets(
    desired,
    deployedAs({ SAME: 'b', DIVERGENT: 'something-else' })
  );
  assert.deepEqual(c.fresh, ['NEWNAME']);
  assert.deepEqual(c.unchanged, ['SAME']);
  assert.deepEqual(c.overwrite, ['DIVERGENT']);
});

test('an empty deployed map makes everything NEW, never UNCHANGED', () => {
  // A failed or empty GET must not be read as "everything already matches", which would
  // silently turn --apply into a no-op on a fresh project.
  const c = mod.classifySecrets({ A: 'x', B: 'y' }, new Map());
  assert.deepEqual(c.unchanged, []);
  assert.deepEqual(c.fresh.sort(), ['A', 'B']);
});
