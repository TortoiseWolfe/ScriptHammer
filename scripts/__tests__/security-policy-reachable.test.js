/**
 * The security policy must be FINDABLE, and the address in it must RECEIVE MAIL (#881).
 *
 * WHAT WAS WRONG. Both halves failed at once, and each was invisible from inside the repo:
 *
 *   1. `SECURITY.md` lived at `docs/project/SECURITY.md`. GitHub only detects a security
 *      policy in the repository root, `.github/`, or `docs/` — it does not recurse. So
 *      `/repos/.../community/profile` returned no `security_policy` key at all, the repo had
 *      no Security tab entry and no "Report a vulnerability" affordance. Someone looking for
 *      how to report found nothing.
 *   2. The policy told people to email `security@scripthammer.com`. Cloudflare Email Routing
 *      for the zone had exactly one rule — `admin@` → the maintainer — with the catch-all
 *      DISABLED, so mail to `security@` was rejected at the edge.
 *
 * Together: the policy asked reporters not to open a public issue, then dropped the private
 * report. The more responsible the reporter, the more completely it was lost — and nothing on
 * this side would ever show a report had been attempted.
 *
 * WHAT THIS CAN AND CANNOT CHECK. It cannot query Cloudflare — CI has no zone token, and a
 * test that silently skips when a credential is absent is its own #396 instance. What it CAN
 * do is force the question: any `@scripthammer.com` address published to outsiders must appear
 * in ROUTED_ADDRESSES below, and adding one to that list means someone confirmed the route.
 * The command to confirm it is recorded here so the check is cheap to redo.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

/** Paths where GitHub looks for a security policy. It does NOT recurse into subdirectories. */
const GITHUB_DETECTED = [
  'SECURITY.md',
  path.join('.github', 'SECURITY.md'),
  path.join('docs', 'SECURITY.md'),
];

/**
 * Addresses on scripthammer.com confirmed to have a Cloudflare Email Routing rule.
 *
 * Confirm before adding one — an address with no rule is REJECTED, because the catch-all is
 * deliberately off:
 *
 *   curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
 *     "https://api.cloudflare.com/client/v4/zones/$ZONE/email/routing/rules?per_page=50"
 *
 * As of 2026-08-21 the zone has exactly one enabled rule, for `admin@`.
 */
const ROUTED_ADDRESSES = new Set(['admin@scripthammer.com']);

/** Files an outsider is asked to act on. A wrong address here loses a real report. */
const OUTWARD_FACING = [
  path.join('.github', 'SECURITY.md'),
  path.join('.github', 'ISSUE_TEMPLATE', 'config.yml'),
  'CONTRIBUTING.md',
  'README.md',
  path.join('docs', 'security', 'MESSAGING-SECURITY-AUDIT.md'),
];

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('the security policy can actually be reached (#881)', () => {
  it('lives where GitHub will detect it', () => {
    const found = GITHUB_DETECTED.filter((p) =>
      fs.existsSync(path.join(ROOT, p))
    );
    assert.ok(
      found.length > 0,
      'No SECURITY.md in the repository root, .github/ or docs/. GitHub does not recurse, ' +
        'so a policy in a subdirectory gives the repo no Security tab entry and no "Report ' +
        'a vulnerability" affordance — which is how this one sat undiscovered.'
    );
  });

  it('is not duplicated across two detected paths', () => {
    // Two copies of a disclosure process is two processes, and the stale one is the one
    // someone follows.
    const found = GITHUB_DETECTED.filter((p) =>
      fs.existsSync(path.join(ROOT, p))
    );
    assert.equal(
      found.length,
      1,
      `SECURITY.md exists at more than one GitHub-detected path: ${found.join(', ')}`
    );
  });

  it('tells reporters to use an address that has a mail route', () => {
    const offenders = [];
    for (const file of OUTWARD_FACING) {
      if (!fs.existsSync(path.join(ROOT, file))) continue;
      const addresses =
        read(file).match(/[a-zA-Z0-9._%+-]+@scripthammer\.com/g) ?? [];
      for (const a of new Set(addresses)) {
        if (!ROUTED_ADDRESSES.has(a)) offenders.push(`${file}: ${a}`);
      }
    }
    assert.deepStrictEqual(
      offenders,
      [],
      'These outward-facing files publish a scripthammer.com address that is not known to ' +
        'have a Cloudflare Email Routing rule. The catch-all is disabled, so mail to an ' +
        'unrouted address is REJECTED and the sender gets a bounce or silence:\n  ' +
        offenders.join('\n  ') +
        '\n\nEither route the address, or publish one that is already routed, then update ' +
        'ROUTED_ADDRESSES in this file.'
    );
  });

  it('still contains a usable reporting process', () => {
    // Non-vacuity. The checks above would all pass against an empty file.
    const found = GITHUB_DETECTED.find((p) =>
      fs.existsSync(path.join(ROOT, p))
    );
    const src = read(found);
    assert.match(src, /Reporting a Vulnerability/i, 'no reporting section');
    assert.match(src, /@scripthammer\.com/, 'no contact address at all');
    assert.ok(src.length > 500, 'the policy is suspiciously short');
  });

  it('every link to the policy points at where it now lives', () => {
    // The file moved. A stale relative link renders as a 404 on GitHub, which for this
    // particular document means a reporter gives up.
    const stale = [];
    for (const file of ['README.md', 'CONTRIBUTING.md', 'CLAUDE.md']) {
      if (!fs.existsSync(path.join(ROOT, file))) continue;
      if (read(file).includes('docs/project/SECURITY.md')) stale.push(file);
    }
    assert.deepStrictEqual(
      stale,
      [],
      `stale SECURITY.md links in: ${stale.join(', ')}`
    );
  });
});
