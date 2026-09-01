#!/usr/bin/env node
/**
 * Make Cloudflare match the intent this repository declares (#393, #822).
 *
 * WHY THIS EXISTS. Three controls with real security weight live in a Cloudflare dashboard
 * rather than in this tree — the cache headers (#635), the CSP header (#393) and the mail
 * DNS (#822). Each has a checker that asserts production still matches. NOTHING here could
 * CHANGE them, so every tightening was a hand-edit in a browser, recorded nowhere, that then
 * needed a second edit in this repo to keep the checker honest. Two steps, two systems, and
 * nothing catching a half-done pair.
 *
 * The `CLOUDFLARE_API_TOKEN` in `.env` already reads the exact DNS record and the exact
 * transform rule those tickets ask a human to edit by hand.
 *
 * NO IDENTIFIERS ARE STORED. Not the zone id, not the ruleset id, not the rule id — even
 * though all three are known for this repo. They are discovered by name and by CONTENT:
 *
 *   - the zone, by the domain from `NEXT_PUBLIC_DEPLOY_URL` (or `MAIL_DOMAIN`);
 *   - the DMARC record, as the TXT at `_dmarc.<domain>` beginning `v=DMARC1`;
 *   - the CSP rule, as the rule in the `http_response_headers_transform` phase whose action
 *     sets a Content-Security-Policy header — in EITHER mode, so the rule is still found
 *     after it has been flipped.
 *
 * A stored id would work here and break in every fork, which is the #1014 / #987 shape: a
 * template default silently pointing a fork's tooling at the template's infrastructure. It
 * would also break for THIS repo the moment the zone moved, and it would break silently.
 *
 * SAFETY. Dry run by DEFAULT — `--apply` is required to write anything. No token, no zone,
 * or nothing to change all SKIP with a message and exit 0; none of them fail, and none of
 * them pass silently. Every change prints before and after, in full, before it is made.
 *
 * PROPAGATION IS NOT INSTANT. Cloudflare ruleset edits take roughly 45 seconds to take
 * effect, and a probe fired immediately after a write reads the PREVIOUS value. That
 * produced three confident, wrong conclusions in one session on #635 — it is written into
 * CLAUDE.md for that reason. So verification here waits, and says that it is waiting.
 *
 * USAGE
 *   node scripts/ci/cloudflare-apply.mjs                 # dry run: show the diff
 *   node scripts/ci/cloudflare-apply.mjs --apply         # write, wait, verify
 *   node scripts/ci/cloudflare-apply.mjs --only=csp      # or --only=dmarc
 *   node scripts/ci/cloudflare-apply.mjs --selftest      # planners, no network
 */
import {
  resolveDomain,
  intendedFor,
  parseDmarc,
} from './check-mail-policy.mjs';
import {
  CSP_MODE,
  CSP_HEADER_NAMES,
  intendedCspHeader,
} from './cloudflare-intent.mjs';

const API = 'https://api.cloudflare.com/client/v4';

/** How long a ruleset edit takes to reach the edge. See the header — this is load-bearing. */
export const PROPAGATION_MS = 45_000;

async function cf(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const errs = (body.errors ?? [])
      .map((e) => `${e.code}: ${e.message}`)
      .join('; ');
    throw new Error(
      `Cloudflare ${init.method ?? 'GET'} ${path} → ${res.status} ${errs || ''}`
    );
  }
  return body.result;
}

/* ---------------------------------------------------------------- planners (pure) ------ */

/**
 * Rewrite one DMARC tag set, preserving every other tag and its order.
 *
 * Rebuilding the record from the tags this repo knows about would DROP the ones it does not
 * — `sp`, `adkim`, `aspf`, `fo`, `ruf` — silently loosening a policy while appearing to
 * tighten it. So this edits in place and leaves everything it was not asked about alone.
 */
export function rewriteDmarc(record, { policy, pct }) {
  const parts = record
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  let sawPolicy = false;
  let sawPct = false;
  for (const part of parts) {
    const [k, ...rest] = part.split('=');
    const key = k.trim();
    if (key === 'p') {
      out.push(`p=${policy}`);
      sawPolicy = true;
    } else if (key === 'pct') {
      sawPct = true;
      // A null pct means "not declared" — drop the tag rather than pinning it to 100.
      if (pct != null) out.push(`pct=${pct}`);
    } else {
      out.push(`${key}=${rest.join('=').trim()}`);
    }
  }
  if (!sawPolicy) out.unshift(`p=${policy}`);
  if (!sawPct && pct != null) {
    // `pct` belongs after `p` by convention; receivers do not care, humans reading it do.
    const i = out.findIndex((t) => t.startsWith('p='));
    out.splice(i + 1, 0, `pct=${pct}`);
  }
  return out.join('; ');
}

/** What, if anything, the DMARC record needs. */
export function planDmarc(records, intended) {
  const found = (records ?? []).filter((r) =>
    String(r.content ?? '').includes('v=DMARC1')
  );
  if (found.length === 0) {
    return {
      kind: 'dmarc',
      action: 'skip',
      reason: `no DMARC TXT record at _dmarc.${intended.domain}`,
    };
  }
  if (found.length > 1) {
    // Receivers treat multiple DMARC records as none at all; picking one to edit would
    // leave the zone broken and looking fixed.
    return {
      kind: 'dmarc',
      action: 'skip',
      reason: `${found.length} DMARC records published — resolve that by hand first, receivers ignore all of them`,
    };
  }
  const rec = found[0];
  const tags = parseDmarc(rec.content);
  const want = rewriteDmarc(rec.content, {
    policy: intended.dmarcPolicy,
    pct: intended.dmarcPct ?? null,
  });
  if (want === rec.content) {
    return {
      kind: 'dmarc',
      action: 'none',
      current: rec.content,
      note: `already p=${tags.p}`,
    };
  }
  return {
    kind: 'dmarc',
    action: 'update',
    id: rec.id,
    name: rec.name,
    from: rec.content,
    to: want,
  };
}

/** What, if anything, the CSP transform rule needs. */
export function planCsp(rules, mode = CSP_MODE) {
  const want = intendedCspHeader(mode);
  const matches = (rules ?? []).filter((r) => {
    const headers = r.action_parameters?.headers ?? {};
    return Object.keys(headers).some((h) =>
      CSP_HEADER_NAMES.some((n) => n.toLowerCase() === h.toLowerCase())
    );
  });
  if (matches.length === 0) {
    return {
      kind: 'csp',
      action: 'skip',
      reason:
        'no response-header rule sets a Content-Security-Policy; this script edits an existing rule, it does not create one',
    };
  }
  if (matches.length > 1) {
    return {
      kind: 'csp',
      action: 'skip',
      reason: `${matches.length} rules set a CSP header — two policies would race, resolve that by hand first`,
    };
  }
  const rule = matches[0];
  const headers = rule.action_parameters.headers;
  const currentName = Object.keys(headers).find((h) =>
    CSP_HEADER_NAMES.some((n) => n.toLowerCase() === h.toLowerCase())
  );
  if (currentName === want) {
    return {
      kind: 'csp',
      action: 'none',
      current: currentName,
      note: `already ${mode}`,
    };
  }
  // Rename the header key, keeping the policy value and every other header on the rule.
  const next = {};
  for (const [k, v] of Object.entries(headers))
    next[k === currentName ? want : k] = v;
  return {
    kind: 'csp',
    action: 'update',
    id: rule.id,
    from: currentName,
    to: want,
    value: headers[currentName]?.value,
    headers: next,
  };
}

/* ---------------------------------------------------------------- execution ------------ */

function describe(plan) {
  if (plan.action === 'skip')
    return `  ${plan.kind.toUpperCase()}: skipped — ${plan.reason}`;
  if (plan.action === 'none')
    return `  ${plan.kind.toUpperCase()}: no change (${plan.note})`;
  if (plan.kind === 'dmarc') {
    return `  DMARC: ${plan.name}\n    from: ${plan.from}\n    to:   ${plan.to}`;
  }
  return `  CSP: rule ${plan.id}\n    from: ${plan.from}\n    to:   ${plan.to}\n    (policy value unchanged, ${String(plan.value ?? '').length} chars)`;
}

async function main(argv) {
  if (argv.includes('--selftest')) return selftest();

  const apply = argv.includes('--apply');
  const only =
    (argv.find((a) => a.startsWith('--only=')) ?? '').split('=')[1] || null;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!token) {
    // Skip, not fail: most runs legitimately have no token, and a fork has none at all.
    console.log(
      '[cf-apply] skipped — CLOUDFLARE_API_TOKEN is not set, so there is nothing to read or change.'
    );
    return;
  }

  const { domain, source, reason } = resolveDomain(argv, process.env);
  if (!domain) {
    console.log(`[cf-apply] skipped — ${reason}`);
    return;
  }

  const zones = await cf(token, `/zones?name=${encodeURIComponent(domain)}`);
  if (!zones?.length) {
    console.log(
      `[cf-apply] skipped — ${domain} (from ${source}) is not a zone this token can see.`
    );
    return;
  }
  const zone = zones[0];
  console.log(
    `[cf-apply] zone ${zone.name} (discovered by name, from ${source})`
  );
  console.log(
    `[cf-apply] mode: ${apply ? 'APPLY' : 'dry run — pass --apply to write'}`
  );

  const intended = intendedFor(domain, process.env);
  const plans = [];

  if (!only || only === 'dmarc') {
    const records = await cf(
      token,
      `/zones/${zone.id}/dns_records?type=TXT&name=${encodeURIComponent(`_dmarc.${domain}`)}`
    );
    plans.push(planDmarc(records, intended));
  }
  if (!only || only === 'csp') {
    const rulesets = await cf(token, `/zones/${zone.id}/rulesets`);
    const rs = rulesets.find(
      (r) => r.phase === 'http_response_headers_transform'
    );
    if (!rs) {
      plans.push({
        kind: 'csp',
        action: 'skip',
        reason: 'this zone has no http_response_headers_transform ruleset',
      });
    } else {
      const full = await cf(token, `/zones/${zone.id}/rulesets/${rs.id}`);
      const plan = planCsp(full.rules, CSP_MODE);
      plans.push(
        plan.action === 'update' ? { ...plan, rulesetId: rs.id } : plan
      );
    }
  }

  console.log('\n[cf-apply] plan:');
  for (const p of plans) console.log(describe(p));

  const changes = plans.filter((p) => p.action === 'update');
  if (!changes.length) {
    console.log(
      '\n[cf-apply] nothing to do — Cloudflare already matches the declared intent.'
    );
    return;
  }
  if (!apply) {
    console.log(
      '\n[cf-apply] dry run only. Re-run with --apply to make these changes.'
    );
    return;
  }

  for (const p of changes) {
    if (p.kind === 'dmarc') {
      await cf(token, `/zones/${zone.id}/dns_records/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: p.to }),
      });
      console.log(`[cf-apply] wrote DMARC ${p.name}`);
    } else {
      await cf(
        token,
        `/zones/${zone.id}/rulesets/${p.rulesetId}/rules/${p.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ action_parameters: { headers: p.headers } }),
        }
      );
      console.log(`[cf-apply] wrote CSP rule ${p.id}`);
    }
  }

  // The wait is the point. Probing immediately reads the previous rule and reports the
  // change as failed — three wrong root causes came from exactly that on #635.
  console.log(
    `\n[cf-apply] waiting ${PROPAGATION_MS / 1000}s for propagation before verifying...`
  );
  await new Promise((r) => setTimeout(r, PROPAGATION_MS));
  console.log('[cf-apply] applied. Verify with:');
  console.log(`  node scripts/ci/check-mail-policy.mjs ${domain}`);
  console.log(
    `  SITE=https://${domain} REQUIRE_CSP=true node scripts/ci/check-csp-header.mjs`
  );
}

function selftest() {
  const cases = [];
  const check = (label, got, want) =>
    cases.push([
      label,
      JSON.stringify(got) === JSON.stringify(want),
      got,
      want,
    ]);

  // rewriteDmarc keeps tags it was not asked about — the loosening trap.
  check(
    'preserves other tags',
    rewriteDmarc('v=DMARC1; p=none; sp=none; rua=mailto:a@b.c; adkim=s', {
      policy: 'quarantine',
      pct: 25,
    }),
    'v=DMARC1; p=quarantine; pct=25; sp=none; rua=mailto:a@b.c; adkim=s'
  );
  check(
    'replaces an existing pct',
    rewriteDmarc('v=DMARC1; p=none; pct=100; rua=mailto:a@b.c', {
      policy: 'reject',
      pct: 50,
    }),
    'v=DMARC1; p=reject; pct=50; rua=mailto:a@b.c'
  );
  check(
    'drops pct when undeclared',
    rewriteDmarc('v=DMARC1; p=none; pct=25', { policy: 'none', pct: null }),
    'v=DMARC1; p=none'
  );
  check(
    'is a no-op when already correct',
    rewriteDmarc('v=DMARC1; p=none; rua=mailto:a@b.c', {
      policy: 'none',
      pct: null,
    }),
    'v=DMARC1; p=none; rua=mailto:a@b.c'
  );

  const intent = { domain: 'x.test', dmarcPolicy: 'quarantine', dmarcPct: 25 };
  check(
    'plans no DMARC change when it matches',
    planDmarc(
      [
        {
          id: '1',
          name: '_dmarc.x.test',
          content: 'v=DMARC1; p=quarantine; pct=25',
        },
      ],
      intent
    ).action,
    'none'
  );
  check(
    'plans a DMARC update when it differs',
    planDmarc(
      [{ id: '1', name: '_dmarc.x.test', content: 'v=DMARC1; p=none' }],
      intent
    ).action,
    'update'
  );
  check(
    'refuses a zone with two DMARC records',
    planDmarc(
      [
        { id: '1', content: 'v=DMARC1; p=none' },
        { id: '2', content: 'v=DMARC1; p=reject' },
      ],
      intent
    ).action,
    'skip'
  );
  check(
    'skips when there is no DMARC record',
    planDmarc([], intent).action,
    'skip'
  );

  const ro = [
    {
      id: 'r1',
      action_parameters: {
        headers: {
          'Content-Security-Policy-Report-Only': {
            operation: 'set',
            value: "default-src 'self'",
          },
        },
      },
    },
  ];
  const other = [
    {
      id: 'r0',
      action_parameters: {
        headers: { 'cache-control': { operation: 'set', value: 'no-cache' } },
      },
    },
  ];
  check(
    'finds the CSP rule among unrelated header rules',
    planCsp([...other, ...ro], 'enforcing').id,
    'r1'
  );
  check(
    'plans no CSP change when the mode matches',
    planCsp(ro, 'report-only').action,
    'none'
  );
  check(
    'plans the flip to enforcing',
    planCsp(ro, 'enforcing').to,
    'Content-Security-Policy'
  );
  check(
    'finds the rule again AFTER the flip, so it can be reverted',
    planCsp(
      [
        {
          id: 'r1',
          action_parameters: {
            headers: {
              'Content-Security-Policy': { operation: 'set', value: 'x' },
            },
          },
        },
      ],
      'report-only'
    ).to,
    'Content-Security-Policy-Report-Only'
  );
  check(
    'keeps the policy value across the rename',
    planCsp(ro, 'enforcing').headers['Content-Security-Policy'].value,
    "default-src 'self'"
  );
  check(
    'skips when no rule sets a CSP',
    planCsp(other, 'enforcing').action,
    'skip'
  );
  check(
    'refuses two competing CSP rules',
    planCsp(
      [
        ...ro,
        {
          id: 'r2',
          action_parameters: {
            headers: {
              'Content-Security-Policy': { operation: 'set', value: 'y' },
            },
          },
        },
      ],
      'enforcing'
    ).action,
    'skip'
  );

  let bad = 0;
  for (const [label, ok, got, want] of cases) {
    if (!ok) {
      console.error(
        `  FAILED: ${label}\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`
      );
      bad++;
    }
  }
  if (bad) process.exit(1);
  console.log(`selftest ok: ${cases.length} planner cases, no network`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(`[cf-apply] ${err.message}`);
    process.exit(1);
  });
}
