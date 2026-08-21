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

/** A zone in the state this repo intends. Each case below breaks exactly one thing. */
const HEALTHY = {
  dmarc: ['v=DMARC1; p=none; rua=mailto:admin@scripthammer.com'],
  spf: ['v=spf1 include:_spf.mx.cloudflare.net ~all'],
  dkim: ['v=DKIM1; k=rsa; p=MIIBIjAN'],
  mx: ['10 route1.mx.cloudflare.net.'],
};

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
    assert.deepStrictEqual(evaluate(HEALTHY), []);
  });

  it('fails when the DMARC record is gone', async () => {
    const { evaluate } = await import(`file://${CHECKER}`);
    const f = evaluate({ ...HEALTHY, dmarc: [] });
    assert.equal(f.length, 1);
    assert.match(f[0], /NO DMARC RECORD/);
  });

  it('fails when the published policy differs from the declared intent', async () => {
    // This is the point of declaring `p` in the repo: a dashboard edit nobody recorded
    // shows up here, and a DELIBERATE change is a one-line reviewable diff.
    const { evaluate } = await import(`file://${CHECKER}`);
    const f = evaluate({
      ...HEALTHY,
      dmarc: ['v=DMARC1; p=reject; rua=mailto:admin@scripthammer.com'],
    });
    assert.equal(f.length, 1);
    assert.match(f[0], /intends p=none/);
  });

  it('fails when aggregate reports have nowhere to go', async () => {
    // Without `rua` there is no evidence, and #822 cannot ever be finished.
    const { evaluate } = await import(`file://${CHECKER}`);
    const f = evaluate({ ...HEALTHY, dmarc: ['v=DMARC1; p=none'] });
    assert.equal(f.length, 1);
    assert.match(f[0], /does not report to/);
  });

  it('fails when DKIM or MX disappear — the two silent ones', async () => {
    const { evaluate } = await import(`file://${CHECKER}`);
    assert.match(evaluate({ ...HEALTHY, dkim: [] })[0], /no DKIM public key/);
    assert.match(
      evaluate({ ...HEALTHY, mx: [] })[0],
      /inbound mail is not being routed/
    );
  });

  it('treats duplicate DMARC records as broken, because receivers do', async () => {
    const { evaluate } = await import(`file://${CHECKER}`);
    const f = evaluate({
      ...HEALTHY,
      dmarc: [HEALTHY.dmarc[0], 'v=DMARC1; p=reject'],
    });
    assert.match(f[0], /receivers ignore all of them/);
  });

  it('reports every fault at once rather than stopping at the first', async () => {
    // A guard that reports one problem per run turns a broken zone into several
    // round-trips, and the later faults get discovered one deploy at a time.
    const { evaluate } = await import(`file://${CHECKER}`);
    assert.equal(evaluate({ dmarc: [], spf: [], dkim: [], mx: [] }).length, 4);
  });

  it('declares the intent it is enforcing', async () => {
    const { INTENDED } = await import(`file://${CHECKER}`);
    assert.equal(
      INTENDED.dmarcPolicy,
      'none',
      'the intended policy is no longer `none`'
    );
    assert.equal(
      INTENDED.dmarcRua,
      'admin@scripthammer.com',
      'aggregate reports must go to an address that receives — see #881'
    );
  });
});
