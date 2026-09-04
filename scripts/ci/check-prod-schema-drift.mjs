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

/** `pg_policy.polcmd` as the migration spells it in `FOR <cmd>`. */
const POLCMD = {
  r: 'SELECT',
  a: 'INSERT',
  w: 'UPDATE',
  d: 'DELETE',
  '*': 'ALL',
};

/**
 * The platform default, repeated from the derivation side ON PURPOSE.
 *
 * It is used here only to give `GRANT ALL` an expected set. Importing the constant would
 * couple two files that are meant to be independently readable, and the value is fixed by
 * Supabase's `pg_default_acl`, not by this repo.
 */
const ALL_PRIVILEGES = [
  'DELETE',
  'INSERT',
  'REFERENCES',
  'SELECT',
  'TRIGGER',
  'TRUNCATE',
  'UPDATE',
];

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

  const [tableGrantRows, columnGrantRows, policies, rls, triggers] =
    await Promise.all([
      // TWO QUERIES, NOT A UNION. These views answer different questions and UNIONing them
      // discarded the difference -- which is the whole of blind spot #2 in #1062.
      //
      //   role_table_grants   TABLE-level grants only. `user_profiles` has none: every
      //                       privilege it gives `authenticated` is column-scoped, so this
      //                       view reports it as holding nothing, and reading it alone once
      //                       called a correctly-hardened production "NARROWER".
      //   column_privileges   column-level grants AND every column of a table-level grant.
      //                       Presence here alone cannot distinguish the two.
      //
      // Read together they are exact: a privilege in the column view but not the table view
      // is column-scoped, and the columns listed are the granted ones. That distinction is
      // #1059's fix -- `GRANT UPDATE (status)` versus `GRANT UPDATE` on `user_connections`
      // is the difference between a group owner being able to rewrite `user_id` or not.
      //
      // information_schema, deliberately, rather than aclexplode(relacl): it omits PG17's
      // MAINTAIN, which production (17.6) grants by default and the repo's pinned image
      // (15.8) does not. Reading the catalog directly would report that skew as drift on
      // every table. MAINTAIN confers VACUUM/ANALYZE, not data access.
      query(
        ref,
        token,
        `SELECT table_name, grantee, privilege_type
           FROM information_schema.role_table_grants
          WHERE table_schema='public' AND table_name IN (${list})
            AND grantee IN ('anon','authenticated')`
      ),
      query(
        ref,
        token,
        `SELECT table_name, grantee, privilege_type, column_name
           FROM information_schema.column_privileges
          WHERE table_schema='public' AND table_name IN (${list})
            AND grantee IN ('anon','authenticated')`
      ),
      query(
        ref,
        token,
        // polroles carries the TO clause. `{0}` is PUBLIC, which includes anon -- the
        // distinction that let unauthenticated callers read encryption salts (#1039), and
        // one a name-only comparison cannot see.
        //
        // polcmd and polpermissive travel with it. Neither is implied by the predicate:
        // FOR SELECT widened to FOR ALL hands the role a DELETE path, and PERMISSIVE
        // flipped to RESTRICTIVE inverts how the expression combines with its siblings --
        // both leaving the name, the roles and the predicate byte-identical.
        `SELECT c.relname AS table_name, p.polname,
                p.polcmd::text AS cmd, p.polpermissive,
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
      query(
        ref,
        token,
        // tgisinternal excludes the triggers Postgres creates for foreign keys and
        // constraints, which no migration declares and which would otherwise read as
        // undeclared drift on every table that has a reference.
        `SELECT c.relname AS table_name, t.tgname
           FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
          WHERE c.relname IN (${list})
            AND c.relnamespace = 'public'::regnamespace
            AND NOT t.tgisinternal`
      ),
    ]);

  const out = {};
  for (const name of names)
    out[name] = {
      rls: null,
      grants: {},
      tableGrants: {},
      columnGrants: {},
      policies: [],
      triggers: [],
    };
  for (const r of rls) {
    if (out[r.table_name]) out[r.table_name].rls = r.relrowsecurity;
  }
  const note = (bag, priv) => {
    if (!bag.includes(priv)) bag.push(priv);
  };
  for (const g of tableGrantRows) {
    const t = out[g.table_name];
    if (!t) continue;
    note((t.grants[g.grantee] ??= []), g.privilege_type);
    note((t.tableGrants[g.grantee] ??= []), g.privilege_type);
  }
  for (const g of columnGrantRows) {
    const t = out[g.table_name];
    if (!t) continue;
    note((t.grants[g.grantee] ??= []), g.privilege_type);
    const byPriv = (t.columnGrants[g.grantee] ??= {});
    note((byPriv[g.privilege_type] ??= []), g.column_name);
  }
  for (const p of policies) {
    if (out[p.table_name])
      out[p.table_name].policies.push({
        name: p.polname,
        roles: pgArray(p.roles).sort(),
        cmd: POLCMD[p.cmd] ?? String(p.cmd),
        permissive: p.polpermissive === true || p.polpermissive === 't',
      });
  }
  for (const tg of triggers) {
    if (out[tg.table_name]) out[tg.table_name].triggers.push(tg.tgname);
  }
  for (const t of Object.values(out)) {
    t.policies.sort((a, b) => a.name.localeCompare(b.name));
    for (const k of Object.keys(t.grants)) t.grants[k].sort();
    for (const k of Object.keys(t.tableGrants)) t.tableGrants[k].sort();
    for (const k of Object.keys(t.columnGrants))
      for (const pr of Object.keys(t.columnGrants[k]))
        t.columnGrants[k][pr].sort();
    t.triggers.sort();
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
    // prosrc is the body as written between the dollar quotes, stored byte-for-byte.
    // prosecdef and proconfig are what decide whose privileges it runs with and what
    // search_path it resolves names against -- dropping `SET search_path = public` from a
    // SECURITY DEFINER function is a privilege-escalation primitive that leaves the body
    // completely unchanged.
    `SELECT proname, pronargs, prosrc, prosecdef, proconfig FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace AND prokind = 'f'`
  );
  return rows
    .map((r) => ({
      name: r.proname,
      arity: Number(r.pronargs),
      body: r.prosrc ?? null,
      securityDefiner: r.prosecdef === true || r.prosecdef === 't',
      config: pgArray(r.proconfig, []).sort(),
    }))
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

  // THE BODY, not just the signature. 22 of the 26 are SECURITY DEFINER and every predicate
  // worth anything delegates to four of them, so `is_conversation_member` rewritten to
  // `SELECT true` on production leaves all 83 policy expressions matching their
  // declarations. Name-and-arity comparison cannot see that at all.
  const liveByKey = new Map(observed.map((f) => [key(f), f]));
  for (const wf of intended.functions) {
    const gf = liveByKey.get(key(wf));
    if (!gf || wf.body === null || gf.body === null) continue;
    if (gf.body !== wf.body) {
      problems.push(
        `${key(wf)}: the BODY in production differs from the migration's.\n` +
          `      production: ${preview(gf.body)}\n` +
          `      migration:  ${preview(wf.body)}`
      );
    }
    if (gf.securityDefiner !== wf.securityDefiner) {
      problems.push(
        `${key(wf)}: production is SECURITY ${gf.securityDefiner ? 'DEFINER' : 'INVOKER'}, ` +
          `declared SECURITY ${wf.securityDefiner ? 'DEFINER' : 'INVOKER'}` +
          (gf.securityDefiner
            ? ' — WIDER: it runs with the owner\u2019s privileges and bypasses RLS'
            : ' — NARROWER: it now runs with the caller\u2019s privileges, so anything it ' +
              'was trusted to do on their behalf will start refusing')
      );
    }
    if (!same(gf.config, wf.config)) {
      problems.push(
        `${key(wf)}: settings are [${gf.config.join(', ') || 'none'}] in production, ` +
          `declared [${wf.config.join(', ') || 'none'}]` +
          (wf.securityDefiner &&
          wf.config.some((c) => c.startsWith('search_path=')) &&
          !gf.config.some((c) => c.startsWith('search_path='))
            ? ' — a SECURITY DEFINER function with no pinned search_path resolves unqualified ' +
              'names against the CALLER\u2019s path'
            : '')
      );
    }
  }

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
function pgArray(value, fallback = ['public']) {
  if (Array.isArray(value)) return value.map((r) => String(r).toLowerCase());
  if (typeof value === 'string' && value.startsWith('{')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(',')
      .map((r) => r.replace(/^"|"$/g, '').trim().toLowerCase());
  }
  // `proconfig` is NULL for a function that sets nothing, which is not the same shape of
  // absence as an unreadable policy role list -- hence the caller-supplied fallback.
  return fallback;
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** A one-line window on a function body, so the error names what changed. */
const preview = (text) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 160 ? `${flat.slice(0, 160)}…` : flat;
};

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
      if (!same(gotPrivs, [...wantPrivs].sort())) {
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

      // THE SCOPE OF EACH PRIVILEGE, not just its presence. The check above compares the
      // union of table-level and column-level grants, which is exactly what could not tell
      // `GRANT UPDATE (status)` from `GRANT UPDATE` -- the second is #1059's hole reopened
      // with the first still written in the migration.
      const wantTable = [...(want.tableGrants?.[role] ?? [])].sort();
      const gotTable = [...(got.tableGrants?.[role] ?? [])].sort();
      const expectedTable = wantTable.includes('ALL')
        ? [...ALL_PRIVILEGES].sort()
        : wantTable;
      if (!same(gotTable, expectedTable)) {
        const wider = gotTable.filter((p) => !expectedTable.includes(p));
        problems.push(
          `${table}: ${role} holds [${gotTable.join(', ') || 'nothing'}] on the WHOLE ` +
            `TABLE, expected [${expectedTable.join(', ') || 'nothing'}]` +
            (wider.length
              ? ` — WIDER by ${wider.join(', ')}: a table-wide grant reaches every column, ` +
                'including ones the migration deliberately withholds (#1059, #1029)'
              : '')
        );
      }

      const wantCols = want.columnGrants?.[role] ?? {};
      const gotCols = got.columnGrants?.[role] ?? {};
      for (const [priv, cols] of Object.entries(wantCols)) {
        const declared = [...cols].sort();
        const live = [...(gotCols[priv] ?? [])].sort();
        if (same(live, declared)) continue;
        const extra = live.filter((c) => !declared.includes(c));
        const missing = declared.filter((c) => !live.includes(c));
        problems.push(
          `${table}: ${role} holds ${priv} on [${live.join(', ') || 'no columns'}], ` +
            `declared on [${declared.join(', ')}]` +
            (extra.length
              ? ` — WIDER by ${extra.join(', ')}, which the migration withholds on purpose`
              : '') +
            (missing.length ? ` — NARROWER, missing ${missing.join(', ')}` : '')
        );
      }
      // A privilege live at column scope that the file grants at NEITHER scope.
      for (const priv of Object.keys(gotCols)) {
        if (priv in wantCols || expectedTable.includes(priv)) continue;
        problems.push(
          `${table}: ${role} holds ${priv} on columns ` +
            `[${gotCols[priv].join(', ')}], and the migration grants it nowhere`
        );
      }
    }

    // Triggers, by name. `before_message_update_column_guard` is #281's fix for the fact
    // that OR-combined UPDATE policies gate ROWS and not COLUMNS; nothing else would notice
    // it going missing, because every policy would still read correctly.
    const wantTriggers = [...(want.triggers ?? [])].sort();
    const gotTriggers = [...(got.triggers ?? [])].sort();
    if (!same(gotTriggers, wantTriggers)) {
      const missing = wantTriggers.filter((t) => !gotTriggers.includes(t));
      const extra = gotTriggers.filter((t) => !wantTriggers.includes(t));
      problems.push(
        `${table}: triggers differ` +
          (missing.length ? ` — MISSING ${missing.join(', ')}` : '') +
          (extra.length ? ` — UNDECLARED ${extra.join(', ')}` : '')
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
      if (gp.cmd && wp.cmd && gp.cmd !== wp.cmd) {
        problems.push(
          `${table}: policy "${wp.name}" is FOR ${gp.cmd} in production, declared FOR ` +
            `${wp.cmd}` +
            (gp.cmd === 'ALL'
              ? ' — WIDER: ALL is SELECT, INSERT, UPDATE and DELETE under one predicate'
              : '')
        );
      }
      if (
        typeof gp.permissive === 'boolean' &&
        typeof wp.permissive === 'boolean' &&
        gp.permissive !== wp.permissive
      ) {
        problems.push(
          `${table}: policy "${wp.name}" is ${gp.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'} ` +
            `in production, declared ${wp.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'} — the ` +
            'same expression combines with its siblings by OR when permissive and by AND ' +
            'when restrictive, so this inverts what it does'
        );
      }
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

  const T = Object.values(INTENDED.tables);
  const columnGrants = T.reduce(
    (n, t) =>
      n +
      Object.values(t.columnGrants ?? {}).reduce(
        (m, byPriv) => m + Object.keys(byPriv).length,
        0
      ),
    0
  );
  console.log(
    `Production security-schema drift — ${T.length} tables, ` +
      `${T.reduce((n, t) => n + t.policies.length, 0)} policies, ` +
      `${INTENDED.functions.length} functions, ` +
      `${columnGrants} column-scoped grants, ` +
      `${T.reduce((n, t) => n + (t.triggers?.length ?? 0), 0)} triggers, ` +
      'all derived from the migration'
  );
  // WHAT A GREEN RESULT HERE DOES NOT MEAN. Saying so in the output is the whole lesson of
  // #1038 applied to this check itself: for months it reported "no drift" while asserting
  // one table out of nineteen, and the summary line gave the reader no way to know. Policy
  // PREDICATES are still compared by nobody -- production carried an INSERT policy on
  // `messages` missing #352's blocked-connection clause for 19 days while this printed
  // "no drift" every night (#1071). That is #1062 step 2 and it is not done.
  console.log(
    '  compares ...... RLS, policy names/roles/command/permissiveness, grants at table AND ' +
      'column scope, function bodies + SECURITY + search_path, trigger names'
  );
  console.log(
    '  does NOT ...... policy USING / WITH CHECK expressions (#1062 step 2), and anything ' +
      'outside `public` — the eight storage.objects policies are asserted by nothing (#1072)'
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
