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
 * What production is supposed to look like — DERIVED from the migration, not restated.
 *
 * This used to be a hand-written object literal listing ONE table, `payment_intents`, out
 * of nineteen (#1038). The check around it was sound and ran daily; it was simply asked a
 * much smaller question than its name implied, and answered it correctly while production
 * carried a live privilege escalation on `user_profiles` — a table the list had never
 * mentioned. A green result meant "one table matches the repo" and read as "production
 * matches the repo".
 *
 * Widening the list by hand would have reproduced the real defect one size larger: a
 * second declaration of intent, kept in step with the migration by memory. #1039 is what
 * that costs — the migration was hardened, no one updated the list, and a check asserting
 * the OLD intent would have gone on passing precisely because production had not moved.
 *
 * See derive-intended-schema.mjs for what is and is not asserted, and why grants are
 * claimed only for tables the migration explicitly REVOKEs from.
 */
export const INTENDED = loadIntended();

import { loadIntended } from './derive-intended-schema.mjs';

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
      // BOTH table-level and COLUMN-level grants. role_table_grants alone is blind to a
      // column-scoped GRANT, and this repo uses those deliberately -- `user_profiles`
      // narrows `authenticated` to named columns precisely so `is_admin` stays unreadable
      // (#1029). Reading only the table view reported that table as holding NOTHING and
      // called a correctly-hardened production "NARROWER, missing INSERT, SELECT, UPDATE".
      // A column grant does confer the privilege; which columns it withholds is a separate
      // question, asserted separately.
      `SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
        WHERE table_schema='public' AND table_name IN (${list})
          AND grantee IN ('anon','authenticated')
       UNION
       SELECT table_name, grantee, privilege_type FROM information_schema.column_privileges
        WHERE table_schema='public' AND table_name IN (${list})
          AND grantee IN ('anon','authenticated')`
    ),
    query(
      ref,
      token,
      // polroles carries the TO clause. `{0}` is PUBLIC, which includes anon -- the
      // distinction that let unauthenticated callers read encryption salts (#1039), and
      // one a name-only comparison cannot see.
      `SELECT c.relname AS table_name, p.polname,
              COALESCE((SELECT array_agg(r.rolname ORDER BY r.rolname)
                        FROM pg_roles r WHERE r.oid = ANY(p.polroles)),
                       ARRAY['public']) AS roles
         FROM pg_policy p
         JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname IN (${list})
          AND c.relnamespace = 'public'::regnamespace`
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
    const list = (t.grants[g.grantee] ??= []);
    if (!list.includes(g.privilege_type)) list.push(g.privilege_type);
  }
  for (const p of policies) {
    if (out[p.table_name])
      out[p.table_name].policies.push({
        name: p.polname,
        roles: pgArray(p.roles).sort(),
      });
  }
  for (const t of Object.values(out)) {
    t.policies.sort((a, b) => a.name.localeCompare(b.name));
    for (const k of Object.keys(t.grants)) t.grants[k].sort();
  }
  return out;
}

/**
 * Every function live in `public`, by name and arity.
 *
 * Arity, not just name, because the failure this catches is an OVERLOAD. Production carried
 * a second `admin_audit_trends` whose four arguments were ALL defaulted, beside a
 * two-argument version that was also fully defaulted -- so every call was ambiguous and the
 * RPC was a total outage rather than a latent risk (#1032). The migration ordered that
 * signature DROPped and nobody ran it. A name-only comparison sees two functions called
 * admin_audit_trends and one declaration of that name, and reports nothing.
 */
export async function observeFunctions(ref, token) {
  const rows = await query(
    ref,
    token,
    `SELECT proname, pronargs FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace AND prokind = 'f'`
  );
  return rows
    .map((r) => ({ name: r.proname, arity: Number(r.pronargs) }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.arity - b.arity);
}

/** Compare live functions against the migration's, both directions. Pure. */
export function evaluateFunctions(observed, intended = INTENDED) {
  const problems = [];
  const key = (f) => `${f.name}(${f.arity})`;

  // Anti-vacuity, same reasoning as the table loop below: an empty function list is a
  // failed observation, never a clean bill of health.
  if (!observed || observed.length === 0) {
    return [
      'no functions observed in public -- a failed observation, not "no drift". ' +
        'Check the project ref and the token.',
    ];
  }

  const live = new Set(observed.map(key));
  const want = new Set(intended.functions.map(key));

  for (const k of [...want].sort()) {
    if (!live.has(k)) {
      problems.push(
        `${k}: declared in the migration, ABSENT from production -- the file was edited ` +
          'and never executed against the live database.'
      );
    }
  }
  for (const k of [...live].sort()) {
    if (want.has(k)) continue;
    const base = k.slice(0, k.indexOf('('));
    const siblings = [...live].filter((x) => x.startsWith(`${base}(`));
    problems.push(
      `${k}: live in production, NOT declared in the migration.` +
        (siblings.length > 1
          ? ` ${base} has ${siblings.length} live signatures (${siblings.join(', ')}); when ` +
            'more than one is callable with the same arguments EVERY call is ambiguous and ' +
            'the RPC fails outright (#1032).'
          : ' An orphan from an older migration, or an out-of-band change.')
    );
  }
  return problems;
}

/**
 * A Postgres text[] as the Management API returns it.
 *
 * It arrives as the literal string `{authenticated}` -- not a JSON array -- so `.map()` on
 * it throws, and a `?? []` fallback around that would have quietly produced an empty role
 * list for EVERY policy, making the role comparison pass by comparing nothing.
 */
function pgArray(value) {
  if (Array.isArray(value)) return value.map((r) => String(r).toLowerCase());
  if (typeof value === 'string' && value.startsWith('{')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(',')
      .map((r) => r.replace(/^"|"$/g, '').trim().toLowerCase());
  }
  return ['public'];
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

    // GRANTS ARE ASSERTED ONLY WHERE THE FILE TOOK CONTROL. Supabase's pg_default_acl
    // already grants anon and authenticated everything on every table in public, so for a
    // table the migration never REVOKEs from, the live grant set IS the platform default
    // and the file has expressed no opinion. Asserting one there invents an intent nobody
    // wrote, fires on eighteen tables, and gets the check switched off -- which is how a
    // check stops protecting anything. `grants: null` means "not asserted"; RLS and
    // policies are still checked for those tables.
    for (const [role, wantPrivs] of Object.entries(want.grants ?? {})) {
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

    // Policies, both directions, BY NAME -- then by the roles they apply to. A policy can
    // keep its name and change meaning: production carried "Service creates profiles" as
    // TO PUBLIC WITH CHECK (true) long after the migration narrowed it to
    // TO authenticated WITH CHECK (auth.uid() = id). Same name, opposite effect, and a
    // name-only comparison called that a match (#1038).
    const wantNames = want.policies.map((p) => p.name).sort();
    const gotNames = got.policies.map((p) => p.name).sort();
    if (!same(gotNames, wantNames)) {
      const extra = gotNames.filter((p) => !wantNames.includes(p));
      const missing = wantNames.filter((p) => !gotNames.includes(p));
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

    for (const wp of want.policies) {
      const gp = got.policies.find((x) => x.name === wp.name);
      if (!gp || !gp.roles) continue; // absence is already reported above
      if (!same(gp.roles, [...wp.roles].sort())) {
        problems.push(
          `${table}: policy "${wp.name}" applies TO [${gp.roles.join(', ')}] in production, ` +
            `declared TO [${[...wp.roles].sort().join(', ')}]` +
            (gp.roles.includes('public') && !wp.roles.includes('public')
              ? ' — WIDER: `public` includes anon, so this is reachable with nothing but ' +
                'the publishable key (#1039)'
              : '')
        );
      }
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

  const [observed, liveFunctions] = await Promise.all([
    observe(ref, token),
    observeFunctions(ref, token),
  ]);
  const problems = [...evaluate(observed), ...evaluateFunctions(liveFunctions)];

  console.log(
    `Production security-schema drift — ${Object.keys(INTENDED.tables).length} tables, ` +
      `${Object.values(INTENDED.tables).reduce((n, t) => n + t.policies.length, 0)} policies, ` +
      `${INTENDED.functions.length} functions, all derived from the migration`
  );
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
    '\nProduction and this repo disagree. The intent above is READ FROM THE MIGRATION, so ' +
      'there is no second list to update — if the repo is right, EXECUTE the change against ' +
      'production, because editing the migration does nothing to a database that already ' +
      'exists (#565, #897, #1038). If PRODUCTION is right, change the migration, which is ' +
      'the only place the intent is written down.'
  );
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`::error::[prod-schema-drift] ${err.message}`);
    process.exit(1);
  });
}
