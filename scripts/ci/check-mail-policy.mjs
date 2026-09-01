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
 * WHOSE DOMAIN. Nothing here is hardcoded to scripthammer.com any more (#822). The domain
 * comes from `MAIL_DOMAIN`, else from the host of `NEXT_PUBLIC_DEPLOY_URL` — the repo
 * variable `smoke.yml` already uses for every other live check. A fork that has not set one,
 * or that deploys to a platform subdomain it does not own the mail DNS for, SKIPS.
 *
 * That is not a nicety. Before this change the domain, the `rua` address and the CSP script's
 * base URL were all string literals, so a fork running these checks asserted *this* repo's
 * mail policy and reported green about a zone it does not control — the #1014 and #987 shape,
 * where template defaults quietly point a fork's infrastructure at the template's.
 *
 * The provider-shaped fields are declarable too, because a fork on Google Workspace and
 * SendGrid intends a different policy, not a broken one. Defaults are what this repo uses; a
 * failing run prints the variable that would redeclare each.
 *
 * USAGE
 *   node scripts/ci/check-mail-policy.mjs [domain]     # else MAIL_DOMAIN, else deploy URL
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
  dmarcPolicy: 'none',
  /**
   * `pct` is how a policy is raised SAFELY: `p=quarantine; pct=25` applies the policy to a
   * quarter of failing mail, so a sender nobody remembered surfaces as a complaint rather
   * than as silently lost receipts. `null` means undeclared and unasserted — today's record
   * carries no pct, and inventing `pct=100` here would assert a tag the zone does not have.
   */
  dmarcPct: null,
  spfInclude: '_spf.mx.cloudflare.net',
  dkimSelector: 'resend',
  mxSuffix: 'mx.cloudflare.net',
};

/** The env var that redeclares each field, printed when the corresponding check fails. */
export const OVERRIDES = {
  dmarcPolicy: 'MAIL_DMARC_POLICY',
  dmarcRua: 'MAIL_DMARC_RUA',
  spfInclude: 'MAIL_SPF_INCLUDE',
  dmarcPct: 'MAIL_DMARC_PCT',
  dkimSelector: 'MAIL_DKIM_SELECTOR',
  mxSuffix: 'MAIL_MX_SUFFIX',
};

/**
 * Hosts whose mail DNS belongs to the hosting platform, not to the person deploying.
 *
 * A fork on `someone.github.io` cannot publish a DMARC record for it and must not be failed
 * for that. Checking `github.io`'s own mail policy would also be checking GitHub's, which is
 * both meaningless here and a check nobody asked for.
 */
const PLATFORM_HOSTS = [
  /(^|\.)github\.io$/i,
  /(^|\.)pages\.dev$/i,
  /(^|\.)vercel\.app$/i,
  /(^|\.)netlify\.app$/i,
  /^localhost$/i,
  /^127\./,
];

/**
 * Which domain's mail policy to assert, and where that answer came from.
 *
 * Returns `{ domain: null, reason }` when there is nothing legitimate to check — the caller
 * SKIPS on that, rather than failing (a fork has done nothing wrong) or falling back to a
 * literal (which is the bug this replaces).
 */
export function resolveDomain(argv = [], env = {}) {
  const positional = argv.find((a) => !a.startsWith('--'));
  const explicit = (positional || env.MAIL_DOMAIN || '').trim();
  if (explicit) {
    // Tolerate a full URL, since the neighbouring vars are URLs and pasting one is the
    // obvious mistake to make.
    const bare = explicit.replace(/^[a-z]+:\/\//i, '').replace(/[/:].*$/, '');
    return {
      domain: bare,
      source: positional ? 'command-line argument' : 'MAIL_DOMAIN',
    };
  }

  const url = (
    env.NEXT_PUBLIC_DEPLOY_URL ||
    env.NEXT_PUBLIC_SITE_URL ||
    ''
  ).trim();
  if (!url) {
    return {
      domain: null,
      reason:
        'neither MAIL_DOMAIN nor NEXT_PUBLIC_DEPLOY_URL is set, so there is no domain to ' +
        'check. Set NEXT_PUBLIC_DEPLOY_URL (Settings → Secrets and variables → Actions → ' +
        'Variables) to the site you deploy, or MAIL_DOMAIN if mail lives on another domain.',
    };
  }

  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return {
      domain: null,
      reason: `NEXT_PUBLIC_DEPLOY_URL is not a URL: ${url}`,
    };
  }

  if (PLATFORM_HOSTS.some((re) => re.test(host))) {
    return {
      domain: null,
      reason:
        `${host} is a hosting subdomain — its mail DNS belongs to the platform, not to this ` +
        'deployment. Set MAIL_DOMAIN if you send mail from a domain you control.',
    };
  }

  return { domain: host, source: 'NEXT_PUBLIC_DEPLOY_URL' };
}

/**
 * The intended policy for one domain.
 *
 * `rua` defaults to `admin@<domain>` rather than a literal address. Aggregate reports must
 * go somewhere that actually RECEIVES — see #881, where the published security address had
 * no mail route at all — and for a fork that address is on the fork's own domain.
 */
export function intendedFor(domain, env = {}) {
  const out = { ...INTENDED, domain, dmarcRua: `admin@${domain}` };
  for (const [field, name] of Object.entries(OVERRIDES)) {
    const v = (env[name] ?? '').trim?.() ?? '';
    if (v) out[field] = v;
  }
  return out;
}

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
export function evaluate(observed, intended) {
  if (!intended?.domain) {
    // A missing intent must not read as a clean zone. Building one from `INTENDED` alone is
    // impossible on purpose: it carries no domain, so there is no literal to fall back to.
    throw new Error(
      'evaluate() needs an intent with a domain — build one with intendedFor()'
    );
  }
  const failures = [];

  const dmarcRecords = (observed.dmarc ?? []).filter((r) =>
    r.startsWith('v=DMARC1')
  );
  if (dmarcRecords.length === 0) {
    failures.push(
      'NO DMARC RECORD at _dmarc.' +
        intended.domain +
        ' — the domain is spoofable and nothing else here would notice'
    );
  } else if (dmarcRecords.length > 1) {
    // Receivers treat multiple DMARC records as none at all.
    failures.push(
      `${dmarcRecords.length} DMARC records published; receivers ignore all of them`
    );
  } else {
    const tags = parseDmarc(dmarcRecords[0]);
    if (tags.p !== intended.dmarcPolicy) {
      failures.push(
        `DMARC p=${tags.p ?? '<absent>'} but this repo intends p=${intended.dmarcPolicy}. ` +
          'If the change was deliberate, update INTENDED in this file so the intent is recorded.'
      );
    }
    if (
      intended.dmarcPct != null &&
      String(tags.pct ?? '') !== String(intended.dmarcPct)
    ) {
      failures.push(
        `DMARC pct=${tags.pct ?? '<absent>'} but this repo intends pct=${intended.dmarcPct}. ` +
          'A policy raised at the wrong percentage is either untested or ineffective.'
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
    failures.push(
      `SPF does not include ${intended.spfInclude}: ${spf.join(' | ')}`
    );
  }

  // `p=` with an EMPTY value is not a key — RFC 6376 §3.6.1 defines it as an explicitly
  // REVOKED one, which is what a provider publishes when a key is withdrawn. Testing for the
  // substring `p=` accepted that as healthy, so the one state this check exists to catch —
  // a key that has stopped signing, invisibly while p=none — read as present. Found by
  // pointing the checker at example.com, which publishes exactly that record.
  const dkimKey = (observed.dkim ?? []).some((r) =>
    /\bp=[A-Za-z0-9+/]/.test(r)
  );
  if (!dkimKey) {
    const revoked = (observed.dkim ?? []).some((r) => /\bp=\s*(;|$)/.test(r));
    failures.push(
      `no usable DKIM public key at ${intended.dkimSelector}._domainkey.${intended.domain} — ` +
        (revoked
          ? 'the record publishes an EMPTY p=, which is a revoked key (RFC 6376 §3.6.1). '
          : '') +
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

/**
 * Name the variable that would redeclare a failing field.
 *
 * A fork on different mail infrastructure is not broken, it intends something else — and the
 * first red run is the only moment anyone is looking. Printing the knob there is the
 * difference between a check a fork configures and one it deletes.
 */
export function overrideHint(failures) {
  const fields = Object.entries(OVERRIDES).filter(([field]) => {
    const needle = {
      dmarcPolicy: 'DMARC p=',
      dmarcRua: 'DMARC rua=',
      dmarcPct: 'DMARC pct=',
      spfInclude: 'SPF',
      dkimSelector: 'DKIM',
      mxSuffix: 'MX',
    }[field];
    return failures.some((f) => f.includes(needle));
  });
  if (!fields.length) return null;
  return (
    'If this deployment intends a different mail policy, declare it rather than editing ' +
    `this file: ${fields.map(([, name]) => name).join(', ')}.`
  );
}

async function main(argv) {
  if (argv.includes('--selftest')) {
    // A fixture domain, NOT this repo's. If any literal crept back into the module, a zone
    // healthy for `selftest.example` would stop passing here.
    const self = intendedFor('selftest.example');
    const good = {
      dmarc: ['v=DMARC1; p=none; rua=mailto:admin@selftest.example'],
      spf: ['v=spf1 include:_spf.mx.cloudflare.net ~all'],
      dkim: ['v=DKIM1; k=rsa; p=MIIBIjAN'],
      mx: ['10 route1.mx.cloudflare.net.'],
    };
    const cases = [
      [good, 0, 'a correct zone passes'],
      [{ ...good, dmarc: [] }, 1, 'a missing DMARC record fails'],
      [
        {
          ...good,
          dmarc: ['v=DMARC1; p=reject; rua=mailto:admin@selftest.example'],
        },
        1,
        'an undeclared policy change fails',
      ],
      [
        {
          ...good,
          dmarc: ['v=DMARC1; p=none; rua=mailto:admin@somewhere.else'],
        },
        1,
        "another domain's rua fails",
      ],
      [{ ...good, dkim: [] }, 1, 'a missing DKIM key fails'],
      [
        {
          ...good,
          dmarc: [
            'v=DMARC1; p=none; pct=50; rua=mailto:admin@selftest.example',
          ],
        },
        0,
        'an undeclared pct is not asserted',
      ],
      [
        { ...good, dkim: ['v=DKIM1; p='] },
        1,
        'a REVOKED DKIM key (empty p=) fails',
      ],
      [
        { ...good, dkim: ['v=DKIM1; k=rsa; p=;'] },
        1,
        'a revoked key with a trailing ; fails',
      ],
      [{ ...good, mx: [] }, 1, 'a missing MX fails'],
      [{ ...good, spf: [] }, 1, 'a missing SPF fails'],
      [
        { dmarc: [], spf: [], dkim: [], mx: [] },
        4,
        'an empty zone fails everything',
      ],
    ];
    let bad = 0;
    for (const [obs, want, label] of cases) {
      const got = evaluate(obs, self).length;
      if (got !== want) {
        console.error(
          `  selftest FAILED: ${label} — wanted ${want} failure(s), got ${got}`
        );
        bad++;
      }
    }
    // The resolver has its own two answers, and the skip is the one a fork actually hits.
    const resolves = [
      [[], { MAIL_DOMAIN: 'example.test' }, 'example.test'],
      [['example.test'], {}, 'example.test'],
      [['https://example.test/'], {}, 'example.test'],
      [[], { NEXT_PUBLIC_DEPLOY_URL: 'https://example.test' }, 'example.test'],
      [[], { NEXT_PUBLIC_DEPLOY_URL: 'https://someone.github.io/proj' }, null],
      [[], {}, null],
    ];
    for (const [argvIn, env, want] of resolves) {
      const got = resolveDomain(argvIn, env).domain;
      if (got !== want) {
        console.error(
          `  selftest FAILED: resolveDomain(${JSON.stringify(argvIn)}, ${JSON.stringify(env)}) — wanted ${want}, got ${got}`
        );
        bad++;
      }
    }
    if (bad) process.exit(1);
    console.log(
      `selftest ok: ${cases.length} evaluate cases + ${resolves.length} resolver cases, both answers reachable`
    );
    return;
  }

  const { domain, source, reason } = resolveDomain(argv, process.env);
  if (!domain) {
    // SKIP, not fail and not a fallback. A fork has done nothing wrong by not owning a mail
    // domain, and pointing this at a literal would assert the template's policy on its behalf.
    console.log(`[mail-policy] skipped — ${reason}`);
    return;
  }
  const intended = intendedFor(domain, process.env);

  const observed = {
    dmarc: await txt(`_dmarc.${domain}`),
    spf: await txt(domain),
    dkim: await txt(`${intended.dkimSelector}._domainkey.${domain}`),
    mx: await mx(domain),
  };

  console.log(`[mail-policy] ${domain} (from ${source})`);
  console.log(`  DMARC : ${observed.dmarc.join(' | ') || '<none>'}`);
  console.log(
    `  SPF   : ${observed.spf.filter((r) => r.startsWith('v=spf1')).join(' | ') || '<none>'}`
  );
  // "present" alone contradicted the verdict on a revoked key: the record IS present and the
  // check fails. Report usability, which is the question being asked.
  const dkimState = !observed.dkim.length
    ? '<none>'
    : observed.dkim.some((r) => /\bp=[A-Za-z0-9+/]/.test(r))
      ? 'present'
      : 'present but REVOKED (empty p=)';
  console.log(`  DKIM  : ${dkimState}`);
  console.log(`  MX    : ${observed.mx.join(' | ') || '<none>'}`);

  const failures = evaluate(observed, intended);
  if (failures.length === 0) {
    console.log(
      '[mail-policy] published policy matches the intent declared in this repo'
    );
    return;
  }
  for (const f of failures) console.log(`::error::[mail-policy] ${f}`);
  const hint = overrideHint(failures);
  if (hint) console.log(`[mail-policy] ${hint}`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((err) => {
    // A DoH outage must not read as a clean zone.
    console.log(
      `::error::[mail-policy] could not resolve the domain's mail records: ${err.message}`
    );
    process.exit(1);
  });
}
