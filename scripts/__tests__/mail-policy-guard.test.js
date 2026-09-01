/**
 * The mail-policy guard must be able to say NO (#822).
 *
 * WHY IT EXISTS. DMARC, SPF, the DKIM key and the inbound MX all live in Cloudflare's
 * dashboard, not in this tree. #822 says so explicitly under "Not automatable from this
 * repo", and draws the parallel to #635, where the cache rules lived outside the repo and
 * the next detector was a human opening a browser and seeing a white page.
 *
 * For mail the failure is silent in both directions, which is worse:
 *
 *   - lose the MX and `admin@` stops receiving, so the security policy (#881) quietly goes
 *     back to dropping vulnerability reports;
 *   - lose the DKIM key and transactional mail stops aligning — invisible while `p=none`,
 *     and it only surfaces as quarantined payment receipts once enforcement is raised;
 *   - lose the DMARC record and the domain is spoofable again, with no signal at all.
 *
 * WHAT THIS PINS. That the checker reaches BOTH verdicts, over the real module rather than a
 * reimplementation of its rules — a checker only ever observed passing has not been shown to
 * work, which is the whole subject of #396.
 *
 * It deliberately does NOT hit the network. Live DNS belongs in `smoke.yml`, where a
 * post-deploy check is expected to talk to the outside world; a unit test that depends on
 * resolution would fail for reasons unrelated to the code and get skipped.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CHECKER = path.join(ROOT, 'scripts', 'ci', 'check-mail-policy.mjs');
const SMOKE = path.join(ROOT, '.github', 'workflows', 'smoke.yml');

/**
 * A zone in the state this repo intends, for a FIXTURE domain. Each case below breaks
 * exactly one thing.
 *
 * The domain here is deliberately not scripthammer.com. `evaluate()` is handed the intent it
 * enforces (#822), so if a literal ever creeps back into the module these cases stop passing
 * — which is the property that makes a fork's run about the fork's own zone.
 */
const DOMAIN = 'fixture.example';
const HEALTHY = {
  dmarc: [`v=DMARC1; p=none; rua=mailto:admin@${DOMAIN}`],
  spf: ['v=spf1 include:_spf.mx.cloudflare.net ~all'],
  dkim: ['v=DKIM1; k=rsa; p=MIIBIjAN'],
  mx: ['10 route1.mx.cloudflare.net.'],
};

/** The intent for the fixture domain, rebuilt from the module under test. */
async function fixtureIntent() {
  const { intendedFor } = await import(`file://${CHECKER}`);
  return intendedFor(DOMAIN);
}

describe('the mail-policy guard (#822)', () => {
  it('exists and is wired into the post-deploy smoke run', () => {
    // Non-vacuity: a checker nothing invokes is the #396 shape in its purest form.
    assert.ok(fs.existsSync(CHECKER), `checker missing at ${CHECKER}`);
    assert.match(
      fs.readFileSync(SMOKE, 'utf8'),
      /check-mail-policy\.mjs/,
      'nothing runs check-mail-policy.mjs — a guard that is never invoked protects nothing'
    );
  });

  it('passes a zone that matches the declared intent', async () => {
    const { evaluate } = await import(`file://${CHECKER}`);
    assert.deepStrictEqual(evaluate(HEALTHY, await fixtureIntent()), []);
  });

  it('fails when the DMARC record is gone', async () => {
    const { evaluate } = await import(`file://${CHECKER}`);
    const f = evaluate({ ...HEALTHY, dmarc: [] }, await fixtureIntent());
    assert.equal(f.length, 1);
    assert.match(f[0], /NO DMARC RECORD/);
  });

  it('fails when the published policy differs from the declared intent', async () => {
    // This is the point of declaring `p` in the repo: a dashboard edit nobody recorded
    // shows up here, and a DELIBERATE change is a one-line reviewable diff.
    const { evaluate } = await import(`file://${CHECKER}`);
    const f = evaluate(
      {
        ...HEALTHY,
        dmarc: [`v=DMARC1; p=reject; rua=mailto:admin@${DOMAIN}`],
      },
      await fixtureIntent()
    );
    assert.equal(f.length, 1);
    assert.match(f[0], /intends p=none/);
  });

  it('fails when aggregate reports have nowhere to go', async () => {
    // Without `rua` there is no evidence, and #822 cannot ever be finished.
    const { evaluate } = await import(`file://${CHECKER}`);
    const f = evaluate(
      { ...HEALTHY, dmarc: ['v=DMARC1; p=none'] },
      await fixtureIntent()
    );
    assert.equal(f.length, 1);
    assert.match(f[0], /does not report to/);
  });

  it('fails when DKIM or MX disappear — the two silent ones', async () => {
    const { evaluate } = await import(`file://${CHECKER}`);
    assert.match(
      evaluate({ ...HEALTHY, dkim: [] }, await fixtureIntent())[0],
      /no usable DKIM public key/
    );
    assert.match(
      evaluate({ ...HEALTHY, mx: [] }, await fixtureIntent())[0],
      /inbound mail is not being routed/
    );
  });

  it('treats duplicate DMARC records as broken, because receivers do', async () => {
    const { evaluate } = await import(`file://${CHECKER}`);
    const f = evaluate(
      {
        ...HEALTHY,
        dmarc: [HEALTHY.dmarc[0], 'v=DMARC1; p=reject'],
      },
      await fixtureIntent()
    );
    assert.match(f[0], /receivers ignore all of them/);
  });

  it('reports every fault at once rather than stopping at the first', async () => {
    // A guard that reports one problem per run turns a broken zone into several
    // round-trips, and the later faults get discovered one deploy at a time.
    const { evaluate } = await import(`file://${CHECKER}`);
    assert.equal(
      evaluate({ dmarc: [], spf: [], dkim: [], mx: [] }, await fixtureIntent())
        .length,
      4
    );
  });

  it('declares the intent it is enforcing', async () => {
    const { INTENDED } = await import(`file://${CHECKER}`);
    assert.equal(
      INTENDED.dmarcPolicy,
      'none',
      'the intended policy is no longer `none`'
    );
  });

  it('addresses aggregate reports to the domain being checked, not a literal', async () => {
    // #881: reports must reach an address that RECEIVES. For a fork that address is on the
    // fork's own domain, so a hardcoded `admin@scripthammer.com` pointed every fork's
    // evidence at this repo's inbox.
    const { intendedFor } = await import(`file://${CHECKER}`);
    assert.equal(intendedFor('example.test').dmarcRua, 'admin@example.test');
    assert.equal(intendedFor('another.test').dmarcRua, 'admin@another.test');
  });

  it('refuses to evaluate without being told whose policy it is', async () => {
    // The failure mode being closed: a default intent means a fork's run silently asserts
    // the template's domain. There is no literal left to fall back to, and a missing intent
    // must not read as a clean zone.
    const { evaluate } = await import(`file://${CHECKER}`);
    assert.throws(() => evaluate(HEALTHY), /needs an intent with a domain/);
  });

  it('rejects a REVOKED DKIM key, not merely a missing one', async () => {
    // `v=DKIM1; p=` is a revoked key (RFC 6376 §3.6.1), which is what a provider publishes
    // when a key is withdrawn. A substring test for `p=` called that healthy — so the one
    // state this checker exists to catch read as fine. Found against example.com, which
    // publishes exactly this record.
    const { evaluate } = await import(`file://${CHECKER}`);
    const f = evaluate(
      { ...HEALTHY, dkim: ['v=DKIM1; p='] },
      await fixtureIntent()
    );
    assert.equal(f.length, 1, 'a revoked key must fail');
    assert.match(f[0], /revoked key/);
    assert.deepStrictEqual(
      evaluate(
        { ...HEALTHY, dkim: ['v=DKIM1; k=rsa; p=MIIBIjAN'] },
        await fixtureIntent()
      ),
      [],
      'a real key must still pass — otherwise the rule is just always-fail'
    );
  });
});

describe('whose domain the mail check asserts (#822 fork safety)', () => {
  it('derives the domain from the deploy URL when none is given', async () => {
    const { resolveDomain } = await import(`file://${CHECKER}`);
    const r = resolveDomain([], {
      NEXT_PUBLIC_DEPLOY_URL: 'https://example.test/path',
    });
    assert.equal(r.domain, 'example.test');
    assert.equal(r.source, 'NEXT_PUBLIC_DEPLOY_URL');
  });

  it('SKIPS rather than falling back to a literal when nothing is configured', async () => {
    // This is the whole defect. A fork used to run this against scripthammer.com and report
    // green about a zone it does not control — the #1014 / #987 shape.
    const { resolveDomain } = await import(`file://${CHECKER}`);
    for (const env of [{}, { NEXT_PUBLIC_DEPLOY_URL: '' }]) {
      const r = resolveDomain([], env);
      assert.equal(r.domain, null, 'must not resolve to any domain');
      assert.match(r.reason, /MAIL_DOMAIN|NEXT_PUBLIC_DEPLOY_URL/);
    }
  });

  it('skips a hosting subdomain, whose mail DNS belongs to the platform', async () => {
    const { resolveDomain } = await import(`file://${CHECKER}`);
    for (const host of [
      'https://someone.github.io/proj',
      'https://x.pages.dev',
      'https://x.vercel.app',
      'https://x.netlify.app',
    ]) {
      assert.equal(
        resolveDomain([], { NEXT_PUBLIC_DEPLOY_URL: host }).domain,
        null,
        `${host} must skip — a fork cannot publish DMARC for it`
      );
    }
  });

  it("never names this repo's domain in the module source", async () => {
    // The assertion that makes the rest non-vacuous: any reintroduced literal fails here,
    // including in a default parameter a behavioural test would not reach.
    const src = fs.readFileSync(CHECKER, 'utf8');
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(
      code,
      /scripthammer\.com/i,
      'a hardcoded domain is the bug #822 fixed — declare it via MAIL_DOMAIN instead'
    );
  });

  it('smoke.yml passes no literal domain either', async () => {
    // The script can be perfectly parameterised and still be pinned to one domain by the
    // workflow that calls it, which is where the literal actually lived.
    const yml = fs.readFileSync(SMOKE, 'utf8');
    const step = yml.slice(
      yml.indexOf('check-mail-policy') - 900,
      yml.indexOf('check-mail-policy') + 200
    );
    const code = step.replace(/^\s*#.*$/gm, '');
    assert.doesNotMatch(
      code,
      /MAIL_DOMAIN:\s*['"]?scripthammer\.com/i,
      'the workflow must pass vars.MAIL_DOMAIN, not a literal'
    );
  });
});
