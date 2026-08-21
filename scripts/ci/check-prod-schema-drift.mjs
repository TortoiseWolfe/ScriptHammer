#!/usr/bin/env node
/**
 * Compare PRODUCTION's security schema to what this repo says it should be (#903).
 *
 * WHY THIS EXISTS. #897 found that production had never received #565's `REVOKE`:
 * `authenticated` still held UPDATE on `payment_intents` three weeks after the migration
 * removed it, and production was missing the `Admin can view all payment intents` policy
 * while carrying the other nine `Admin can view%` policies. Both were found by hand, by
 * chance, while scoping an unrelated ticket.
 *
 * Nothing would have found them otherwise. `pnpm test:rls` runs against a LOCAL stack, so
 * it pins what a FRESH database gets from the migration and is structurally blind to the
 * hosted project. `tests/rls/payment-intents-grants.test.ts` says so in its own header —
 * it would have been green throughout.
 *
 * The migration is applied to production by hand, if at all. No workflow runs it. So every
 * schema change has two independent states — what the file says and what production does —
 * and until now only one was ever checked. #565's own comment named the trap and then fell
 * into it: "a migration file is not a migration".
 *
 * SHAPE. Follows `check-mail-policy.mjs`: an INTENDED declaration lives here, in the repo,
 * and `evaluate()` is pure so both directions are testable without a network. Reporting
 * only — it never issues DDL. Applying the migration to production is a separate decision
 * with a much larger blast radius.
 *
 * USAGE
 *   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node scripts/ci/check-prod-schema-drift.mjs
 */

/**
 * What production is supposed to look like.
 *
 * Deliberately NARROW — the security-relevant surface, not the whole schema. A diff of
 * everything is noise nobody reads, and a check nobody reads is not a check.
 *
 * `grants` lists the privileges each client role may hold. Supabase's platform defaults
 * hand `anon` and `authenticated` ALL privileges on every table in `public`, so anything
 * not narrowed by an explicit REVOKE will show up here as drift — which is the point.
 */
export const INTENDED = {
  tables: {
    payment_intents: {
      rls: true,
      grants: { anon: ['SELECT'], authenticated: ['INSERT', 'SELECT'] },
      // #897 restored the admin policy production was missing.
      policies: [
        'Admin can view all payment intents',
        'Payment intents are immutable',
        'Payment intents cannot be deleted by users',
        'Users can create own payment intents',
        'Users can view own payment intents',
      ],
    },
  },
};

const API = 'https://api.supabase.com/v1/projects';

/** One read-only SQL query against the hosted project. */
async function query(ref, token, sql) {
  const res = await fetch(`${API}/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    throw new Error(
      `Management API ${res.status}: ${(await res.text()).slice(0, 300)}`
    );
  }
  return res.json();
}

/** Read the live shape of the tables INTENDED names. */
export async function observe(ref, token, intended = INTENDED) {
  const names = Object.keys(intended.tables);
  const list = names.map((n) => `'${n}'`).join(', ');

  const [grants, policies, rls] = await Promise.all([
    query(
      ref,
      token,
      `SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
        WHERE table_schema='public' AND table_name IN (${list})
          AND grantee IN ('anon','authenticated')`
    ),
    query(
      ref,
      token,
      `SELECT c.relname AS table_name, p.polname FROM pg_policy p
         JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname IN (${list})`
    ),
    query(
      ref,
      token,
      `SELECT relname AS table_name, relrowsecurity FROM pg_class
        WHERE relname IN (${list}) AND relnamespace = 'public'::regnamespace`
    ),
  ]);

  const out = {};
  for (const name of names) out[name] = { rls: null, grants: {}, policies: [] };
  for (const r of rls) {
    if (out[r.table_name]) out[r.table_name].rls = r.relrowsecurity;
  }
  for (const g of grants) {
    const t = out[g.table_name];
    if (!t) continue;
    (t.grants[g.grantee] ??= []).push(g.privilege_type);
  }
  for (const p of policies) {
    if (out[p.table_name]) out[p.table_name].policies.push(p.polname);
  }
  for (const t of Object.values(out)) {
    t.policies.sort();
    for (const k of Object.keys(t.grants)) t.grants[k].sort();
  }
  return out;
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Compare observed against INTENDED. Pure — no network — so a test can drive both
 * directions, which is the only way to know this can report failure at all.
 *
 * Returns a list of human-readable problems. Empty means no drift.
 */
export function evaluate(observed, intended = INTENDED) {
  const problems = [];

  // ANTI-VACUITY, FIRST AND LOUDEST. A wrong project ref, an expired token or a renamed
  // table yields an empty observation, and every comparison below would then pass by
  // checking nothing — a drift check silently inspecting an empty set is worse than no
  // check, because it reports reassurance. This is the exact failure #903 is about.
  for (const [table, want] of Object.entries(intended.tables)) {
    const got = observed?.[table];
    if (!got) {
      problems.push(
        `${table}: NOT FOUND in production. Either the table was renamed/dropped, or this ` +
          'check is pointed at the wrong project. Not treated as "no drift".'
      );
      continue;
    }
    if (got.rls === null || got.rls === undefined) {
      problems.push(
        `${table}: could not read RLS state — treat as a failed observation`
      );
    } else if (got.rls !== want.rls) {
      problems.push(
        `${table}: RLS is ${got.rls ? 'ENABLED' : 'DISABLED'}, expected ` +
          `${want.rls ? 'ENABLED' : 'DISABLED'}`
      );
    }

    for (const [role, wantPrivs] of Object.entries(want.grants)) {
      const gotPrivs = got.grants[role] ?? [];
      if (same(gotPrivs, [...wantPrivs].sort())) continue;
      const extra = gotPrivs.filter((p) => !wantPrivs.includes(p));
      const missing = wantPrivs.filter((p) => !gotPrivs.includes(p));
      // Direction matters: WIDER is a privilege production should not have, NARROWER
      // usually means a deliberate repo change has not been declared here yet. Saying
      // "they differ" leaves the reader to work out which, and they mean opposite things.
      problems.push(
        `${table}: ${role} holds [${gotPrivs.join(', ') || 'nothing'}], expected ` +
          `[${wantPrivs.join(', ')}]` +
          (extra.length ? ` — WIDER by ${extra.join(', ')}` : '') +
          (missing.length ? ` — NARROWER, missing ${missing.join(', ')}` : '')
      );
    }

    const wantPolicies = [...want.policies].sort();
    if (!same(got.policies, wantPolicies)) {
      const extra = got.policies.filter((p) => !wantPolicies.includes(p));
      const missing = wantPolicies.filter((p) => !got.policies.includes(p));
      problems.push(
        `${table}: policies differ` +
          (missing.length
            ? ` — MISSING ${missing.map((p) => `"${p}"`).join(', ')}`
            : '') +
          (extra.length
            ? ` — UNDECLARED ${extra.map((p) => `"${p}"`).join(', ')}`
            : '')
      );
    }
  }
  return problems;
}

async function main() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!ref || !token) {
    console.error(
      '::error::[prod-schema-drift] SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN are required. ' +
        'Both already exist as repo secrets; a missing one is a misconfigured job, not a pass.'
    );
    process.exit(1);
  }

  const observed = await observe(ref, token);
  const problems = evaluate(observed);

  console.log('Production security-schema drift');
  for (const [table, got] of Object.entries(observed)) {
    console.log(
      `  ${table}: rls=${got.rls}, policies=${got.policies.length}, ` +
        Object.entries(got.grants)
          .map(([r, p]) => `${r}=[${p.join(',')}]`)
          .join(' ')
    );
  }

  if (!problems.length) {
    console.log('  verdict ....... no drift');
    return;
  }
  console.error(`  verdict ....... ${problems.length} problem(s)`);
  for (const p of problems) console.error(`::error::[prod-schema-drift] ${p}`);
  console.error(
    '\nProduction and this repo disagree. If the production state is correct, update ' +
      'INTENDED in scripts/ci/check-prod-schema-drift.mjs so the intent is recorded. If the ' +
      'repo is correct, EXECUTE the change against production — editing the migration alone ' +
      'does nothing to a database that already exists (#565, #897).'
  );
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`::error::[prod-schema-drift] ${err.message}`);
    process.exit(1);
  });
}
