#!/usr/bin/env node
/**
 * Assert that the LIVE mail policy for the domain is still what this repo intends (#822).
 *
 * WHY THIS EXISTS. The DMARC record, the SPF record, the DKIM key and the inbound MX all live
 * in Cloudflare's dashboard, not in this tree. Nothing here would notice if one were deleted,
 * a token rotated, or the zone moved — which is exactly the gap #635 documented for the cache
 * rules, where the next detector was a human opening a browser.
 *
 * For mail the failure is worse, because it is SILENT IN BOTH DIRECTIONS:
 *
 *   - Lose the MX and `admin@` stops receiving. The security policy (#881) starts dropping
 *     vulnerability reports again, and nobody here sees a thing — the reporter gets a bounce.
 *   - Lose the DKIM key and transactional mail stops aligning. Under `p=none` nothing visibly
 *     breaks, so the damage is invisible until enforcement is raised, at which point real
 *     payment receipts start being quarantined.
 *   - Lose the DMARC record and the domain is spoofable again, silently.
 *
 * WHAT IT IS NOT. This does not verify that mail is DELIVERED, and it cannot: that needs a
 * receiver's aggregate reports, which arrive by email days later. It asserts the published
 * policy matches the declared intent below. That is the difference between "the config we
 * meant is still there" and "mail works" — and only the first is checkable from CI.
 *
 * RAISING ENFORCEMENT. `p=` is declared here on purpose. Tightening the policy is then a
 * one-line, reviewable change in this repo that CI enforces against live DNS, instead of an
 * undocumented dashboard edit nothing records. See #822 for why it is still `none`.
 *
 * USAGE
 *   node scripts/ci/check-mail-policy.mjs [domain]     # default scripthammer.com
 *   node scripts/ci/check-mail-policy.mjs --selftest
 */

const DOH = 'https://cloudflare-dns.com/dns-query';

/**
 * The mail policy this repository intends to be published.
 *
 * `p: 'none'` is deliberate and currently correct — #822 has the reasoning. Two things must
 * be true before it is raised, and neither is today:
 *
 *   1. Enough `rua` aggregate reports to show every legitimate sender aligns. In the 30 days
 *      to 2026-08-21 exactly ONE report arrived (Google, covering one day).
 *   2. #368 closed. Replies to `admin@` still leave through a personal Gmail, which is not in
 *      the root SPF and does not DKIM-sign as the domain — so `p=quarantine` would quarantine
 *      the maintainer's own replies.
 */
export const INTENDED = {
  domain: 'scripthammer.com',
  dmarcPolicy: 'none',
  // Aggregate reports must go somewhere that actually receives — see #881, where the
  // published security address had no mail route at all.
  dmarcRua: 'admin@scripthammer.com',
  spfInclude: '_spf.mx.cloudflare.net',
  dkimSelector: 'resend',
  mxSuffix: 'mx.cloudflare.net',
};

async function txt(name) {
  const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=TXT`, {
    headers: { accept: 'application/dns-json' },
  });
  if (!res.ok) throw new Error(`DoH ${res.status} for TXT ${name}`);
  const body = await res.json();
  return (body.Answer ?? []).map((a) => String(a.data).replace(/^"|"$/g, ''));
}

async function mx(name) {
  const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=MX`, {
    headers: { accept: 'application/dns-json' },
  });
  if (!res.ok) throw new Error(`DoH ${res.status} for MX ${name}`);
  const body = await res.json();
  return (body.Answer ?? []).map((a) => String(a.data));
}

/** Parse a DMARC TXT record into its tags. */
export function parseDmarc(record) {
  const out = {};
  for (const part of record.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k && rest.length) out[k.trim()] = rest.join('=').trim();
  }
  return out;
}

/**
 * Evaluate the observed DNS against INTENDED. Pure, so both directions are testable without
 * a network — a checker only ever seen passing has not been shown to work.
 */
export function evaluate(observed, intended = INTENDED) {
  const failures = [];

  const dmarcRecords = (observed.dmarc ?? []).filter((r) => r.startsWith('v=DMARC1'));
  if (dmarcRecords.length === 0) {
    failures.push(
      'NO DMARC RECORD at _dmarc.' +
        intended.domain +
        ' — the domain is spoofable and nothing else here would notice'
    );
  } else if (dmarcRecords.length > 1) {
    // Receivers treat multiple DMARC records as none at all.
    failures.push(`${dmarcRecords.length} DMARC records published; receivers ignore all of them`);
  } else {
    const tags = parseDmarc(dmarcRecords[0]);
    if (tags.p !== intended.dmarcPolicy) {
      failures.push(
        `DMARC p=${tags.p ?? '<absent>'} but this repo intends p=${intended.dmarcPolicy}. ` +
          'If the change was deliberate, update INTENDED in this file so the intent is recorded.'
      );
    }
    if (!tags.rua || !tags.rua.includes(intended.dmarcRua)) {
      failures.push(
        `DMARC rua=${tags.rua ?? '<absent>'} does not report to ${intended.dmarcRua}; ` +
          'without aggregate reports there is no evidence for raising enforcement'
      );
    }
  }

  const spf = (observed.spf ?? []).filter((r) => r.startsWith('v=spf1'));
  if (spf.length === 0) {
    failures.push(`no SPF record on ${intended.domain}`);
  } else if (!spf.some((r) => r.includes(intended.spfInclude))) {
    failures.push(`SPF does not include ${intended.spfInclude}: ${spf.join(' | ')}`);
  }

  if (!(observed.dkim ?? []).some((r) => r.includes('p='))) {
    failures.push(
      `no DKIM public key at ${intended.dkimSelector}._domainkey.${intended.domain} — ` +
        'transactional mail would stop aligning, invisibly while p=none'
    );
  }

  if (!(observed.mx ?? []).some((r) => r.includes(intended.mxSuffix))) {
    failures.push(
      `MX does not point at ${intended.mxSuffix} — inbound mail is not being routed, so ` +
        'admin@ stops receiving and the security policy (#881) silently breaks again'
    );
  }

  return failures;
}

async function main(argv) {
  if (argv.includes('--selftest')) {
    const good = {
      dmarc: ['v=DMARC1; p=none; rua=mailto:admin@scripthammer.com'],
      spf: ['v=spf1 include:_spf.mx.cloudflare.net ~all'],
      dkim: ['v=DKIM1; k=rsa; p=MIIBIjAN'],
      mx: ['10 route1.mx.cloudflare.net.'],
    };
    const cases = [
      [good, 0, 'a correct zone passes'],
      [{ ...good, dmarc: [] }, 1, 'a missing DMARC record fails'],
      [{ ...good, dmarc: ['v=DMARC1; p=reject; rua=mailto:admin@scripthammer.com'] }, 1, 'an undeclared policy change fails'],
      [{ ...good, dkim: [] }, 1, 'a missing DKIM key fails'],
      [{ ...good, mx: [] }, 1, 'a missing MX fails'],
      [{ ...good, spf: [] }, 1, 'a missing SPF fails'],
      [{ dmarc: [], spf: [], dkim: [], mx: [] }, 4, 'an empty zone fails everything'],
    ];
    let bad = 0;
    for (const [obs, want, label] of cases) {
      const got = evaluate(obs).length;
      if (got !== want) {
        console.error(`  selftest FAILED: ${label} — wanted ${want} failure(s), got ${got}`);
        bad++;
      }
    }
    if (bad) process.exit(1);
    console.log(`selftest ok: ${cases.length} cases, both answers reachable`);
    return;
  }

  const domain = argv.find((a) => !a.startsWith('--')) ?? INTENDED.domain;
  const intended = { ...INTENDED, domain };

  const observed = {
    dmarc: await txt(`_dmarc.${domain}`),
    spf: await txt(domain),
    dkim: await txt(`${intended.dkimSelector}._domainkey.${domain}`),
    mx: await mx(domain),
  };

  console.log(`[mail-policy] ${domain}`);
  console.log(`  DMARC : ${observed.dmarc.join(' | ') || '<none>'}`);
  console.log(`  SPF   : ${observed.spf.filter((r) => r.startsWith('v=spf1')).join(' | ') || '<none>'}`);
  console.log(`  DKIM  : ${observed.dkim.length ? 'present' : '<none>'}`);
  console.log(`  MX    : ${observed.mx.join(' | ') || '<none>'}`);

  const failures = evaluate(observed, intended);
  if (failures.length === 0) {
    console.log('[mail-policy] published policy matches the intent declared in this repo');
    return;
  }
  for (const f of failures) console.log(`::error::[mail-policy] ${f}`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((err) => {
    // A DoH outage must not read as a clean zone.
    console.log(`::error::[mail-policy] could not resolve the domain's mail records: ${err.message}`);
    process.exit(1);
  });
}
