/**
 * A `NEXT_PUBLIC_*` value is public by definition — it is compiled into the browser
 * bundle and served to every visitor. Storing one as a write-only GitHub *secret*
 * buys no security and costs the ability to audit it (#787).
 *
 * WHY THIS IS A GATE AND NOT A PREFERENCE. On 2026-08-07 production served a bundle
 * pointing at a Supabase project that had been DELETED, for hours, behind entirely
 * green checks. The deploy read `vars.*`; the operator was setting `gh secret set`.
 * Same names, two stores, and a secret cannot be read back — so the divergence was
 * invisible to inspection. 20 shadow secrets were deleted on 2026-08-17; this stops
 * them growing back.
 *
 * It is also how #629 stayed hidden: production's Stripe payment MODE could only be
 * discovered by downloading a chunk and grepping it for `pk_test_`, because the
 * publishable key was write-only.
 *
 * WHAT THIS CANNOT CHECK, stated plainly so a green run is not over-read: whether a
 * shadow secret EXISTS in the repo's secret store. Listing secrets requires an
 * admin-scoped token, which CI's default `GITHUB_TOKEN` does not have. This asserts
 * the half that is deterministically checkable — that no workflow *consumes* a
 * public value from the secret store. Auditing the store itself is a manual step,
 * documented in #787.
 *
 * THE ALLOWLIST IS A RATCHET. It may shrink, never grow. Each entry is a value that
 * is public by definition and still read from a secret; migrating one means deleting
 * its line here.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOWS = path.join(__dirname, '..', '..', '.github', 'workflows');

/**
 * Known-unmigrated public values, as of 2026-08-17. Do not add to this list —
 * move the value to a repo variable instead.
 */
const ALLOWED = new Set([
  // Browser-side keys. Public by design; each ships in the bundle.
  'NEXT_PUBLIC_PAGESPEED_API_KEY',
  'NEXT_PUBLIC_EMAILJS_PUBLIC_KEY',
  'NEXT_PUBLIC_PAYPAL_CLIENT_ID',
  'NEXT_PUBLIC_SENTRY_DSN',
  'NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY',
]);

/** Every `secrets.NEXT_PUBLIC_*` reference across all workflow files. */
function publicSecretRefs() {
  const found = new Map(); // name -> [file...]
  for (const file of fs.readdirSync(WORKFLOWS)) {
    if (!/\.ya?ml$/.test(file)) continue;
    const body = fs.readFileSync(path.join(WORKFLOWS, file), 'utf8');
    for (const m of body.matchAll(/secrets\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)) {
      const list = found.get(m[1]) ?? [];
      if (!list.includes(file)) list.push(file);
      found.set(m[1], list);
    }
  }
  return found;
}

test('no workflow reads a NEW public value from the secret store', () => {
  const refs = publicSecretRefs();
  const offenders = [...refs.keys()].filter((n) => !ALLOWED.has(n));

  assert.deepEqual(
    offenders,
    [],
    `These NEXT_PUBLIC_* values are read from \`secrets.*\`:\n` +
      offenders.map((n) => `  - ${n} (${refs.get(n).join(', ')})`).join('\n') +
      `\n\nA NEXT_PUBLIC_ value is compiled into the browser bundle, so storing it ` +
      `write-only protects nothing and makes it unauditable — that is how #629 hid ` +
      `a test-mode Stripe key in production, and how #787's shadow secrets caused an ` +
      `outage. Put it in a repo VARIABLE and read it with \`vars.\`.`
  );
});

test('the allowlist is a ratchet: it may not list names nothing references', () => {
  const refs = publicSecretRefs();
  const stale = [...ALLOWED].filter((n) => !refs.has(n));

  // A stale entry means the migration already happened and the exemption was left
  // behind — which quietly re-permits the thing it was meant to phase out.
  assert.deepEqual(
    stale,
    [],
    `Allowlisted but no longer referenced by any workflow: ${stale.join(', ')}. ` +
      `Delete these lines — an exemption nobody needs is an exemption nobody notices.`
  );
});

test('the detector can actually see references (guards against a silent no-op)', () => {
  // If the regex or the directory path ever breaks, both tests above pass vacuously
  // by finding nothing. Assert the scan is genuinely reading workflows.
  const refs = publicSecretRefs();

  assert.ok(
    refs.size > 0,
    'found zero secrets.NEXT_PUBLIC_* references anywhere, which almost certainly ' +
      'means this scan is broken rather than that the repo is clean — verify by ' +
      'hand before deleting this assertion.'
  );
});
