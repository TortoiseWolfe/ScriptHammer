/**
 * Compare what production's policies SAY against what the migration makes them say (#1062).
 *
 * WHY THIS IS SEPARATE FROM check-prod-schema-drift.mjs. That check compares production to
 * an intent PARSED from the migration, and it deliberately owns grants, because a parsed
 * file can express "this file has no opinion here" and a database cannot -- that silence is
 * the only reason the grant assertion is narrow enough to stay switched on (#1073).
 *
 * A predicate has no such nuance. The migration either declares one or it does not, and the
 * only faithful reading of what it declares is what Postgres makes of it. So this file asks
 * a different question with a different instrument: build a scratch database from the
 * migration, and diff its `pg_get_expr` output against production's.
 *
 * WHY NOT COMPARE THE MIGRATION'S TEXT DIRECTLY. Postgres stores a rewritten expression:
 * full parenthesisation, `!=` folded to `<>`, `'x'` cast to `'x'::text`,
 * `INTERVAL '15 minutes'` rewritten to `'00:15:00'::interval`, its own line breaks.
 * Measured across this repo's 83 policies on 2026-09-04:
 *
 *     migration source text vs pg_get_expr ..... 46 false positives of 83
 *     deparse vs deparse ....................... 1 difference of 83, and it was REAL
 *
 * A hand-written lexer/parser/canonicaliser was prototyped and does reconcile 83 of 83
 * today. That is exactly why it was rejected: its maintenance gradient only points one way.
 * Every future cry-wolf is settled by adding one more rule that makes it blinder, and a gate
 * that cries wolf gets switched off -- which is how this repo lost three days of Production
 * Smoke (#1061). Postgres is the normaliser on both sides, so nothing here has to be.
 *
 * WHAT THIS CATCHES THAT NOTHING ELSE DID. On 2026-09-04 production's `messages` INSERT
 * policy was missing the blocked-connection clause #352 added on 2026-08-16, so a blocked
 * user could keep messaging the person who blocked them -- for nineteen days, while
 * `Prod Schema Drift` printed "no drift" nightly, because the name, command, roles and
 * permissiveness were all identical and only the expression differed (#1071).
 *
 * IT ALSO COVERS `storage.objects`, which the schema-drift check structurally cannot: that
 * table is not created by this repo, so a column catalogue parsed from the migration has no
 * entry for it. A scratch database has the real table, so its eight policies -- including
 * the one gating customer intake files on `is_admin()` -- come along for free (#1072).
 *
 * USAGE
 *   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node scripts/ci/policy-predicates.mjs
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '../..');

/**
 * The image pin, taken from `docker-compose.yml` rather than chosen here.
 *
 * ONE PIN, NOT TWO. A second version constant is a second declaration that drifts from the
 * first by memory, which is the defect #1038 is about. If compose moves, this moves.
 *
 * PRODUCTION RUNS A DIFFERENT MAJOR (17.6 against this 15.8), and that is measured rather
 * than assumed: on 2026-09-04 all 83 policies -- command, permissiveness, roles, USING and
 * WITH CHECK -- were BYTE-IDENTICAL between a scratch database built from this migration on
 * 15.8.1.060 and production on 17.6. The deparser is stable across the gap for this corpus.
 * The job prints both `server_version_num` anyway, because that is a measurement with a
 * shelf life, not a law.
 *
 * The 17.6 image is NOT usable as the scratch here even though it matches production: it
 * does not bootstrap `storage.buckets` during initdb, so the migration aborts at the avatar
 * bucket and the container exits 3. Matching production's major would mean hand-building
 * somebody else's schema first -- the second-list trap, for no measured benefit.
 */
export const SCRATCH_IMAGE = 'supabase/postgres:15.8.1.060';

/** The one query, run identically against both sides. */
export const POLICY_QUERY = `SELECT json_agg(x ORDER BY x.sch, x.tbl, x.pol) FROM (
  SELECT n.nspname AS sch, c.relname AS tbl, p.polname AS pol,
         p.polcmd::text AS cmd, p.polpermissive AS perm,
         COALESCE((SELECT array_agg(r.rolname ORDER BY r.rolname)
                   FROM pg_roles r WHERE r.oid = ANY(p.polroles)), ARRAY['public'])::text AS roles,
         COALESCE(pg_get_expr(p.polqual, p.polrelid), '') AS qual,
         COALESCE(pg_get_expr(p.polwithcheck, p.polrelid), '') AS wc
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname IN ('public', 'storage')
) x`;

const key = (r) => `${r.sch}.${r.tbl}."${r.pol}"`;

/**
 * Compare two deparsed policy sets. PURE — no docker, no network — so the tests can drive
 * both directions, which is the only way to know this can report failure at all.
 *
 * Returns a list of human-readable problems. Empty means the two agree.
 */
export function comparePolicies(scratch, production) {
  // ANTI-VACUITY, FIRST AND LOUDEST. An empty side is a failed observation, never
  // agreement: a wrong project ref, an expired token or a scratch database that came up
  // without the migration all produce one, and every comparison below would then pass by
  // comparing nothing. That is the exact failure #903 exists for, one level down.
  if (!Array.isArray(scratch) || scratch.length === 0) {
    return [
      'the scratch database reported NO policies — it did not build from the migration. ' +
        'Not treated as agreement.',
    ];
  }
  if (!Array.isArray(production) || production.length === 0) {
    return [
      'production reported NO policies — a failed observation. Check the project ref and ' +
        'the token. Not treated as agreement.',
    ];
  }

  const problems = [];
  const A = new Map(scratch.map((r) => [key(r), r]));
  const B = new Map(production.map((r) => [key(r), r]));

  for (const k of [...A.keys()].sort()) {
    if (!B.has(k)) {
      problems.push(
        `${k}: declared in the migration, ABSENT from production — the file was edited ` +
          'and never executed against the live database.'
      );
    }
  }
  for (const k of [...B.keys()].sort()) {
    if (!A.has(k)) {
      problems.push(
        `${k}: live in production, NOT declared in the migration — an orphan from an ` +
          'older migration, or an out-of-band change.'
      );
    }
  }

  for (const k of [...A.keys()].sort()) {
    const a = A.get(k);
    const b = B.get(k);
    if (!b) continue;
    for (const [slot, field] of [
      ['USING', 'qual'],
      ['WITH CHECK', 'wc'],
    ]) {
      if (String(a[field]) === String(b[field])) continue;
      // BOTH TEXTS, AND NO DIRECTION WORD. "Wider" and "narrower" are decidable for a set
      // of privileges and are NOT decidable for a boolean expression -- a gate that guesses
      // will guess backwards on a `NOT EXISTS`, and confidently. The reader gets both
      // sides and decides.
      problems.push(
        `${k}: ${slot} differs.\n` +
          `      migration:  ${a[field] || '(none)'}\n` +
          `      production: ${b[field] || '(none)'}`
      );
    }
    // Command, permissiveness and roles are compared against the FILE by
    // check-prod-schema-drift.mjs for `public`. Nothing compares them for `storage`, so
    // they are asserted here for that schema only -- reporting them twice for `public`
    // would make one divergence read as two findings.
    if (a.sch !== 'public') {
      for (const [label, field] of [
        ['command', 'cmd'],
        ['permissiveness', 'perm'],
        ['roles', 'roles'],
      ]) {
        if (String(a[field]) === String(b[field])) continue;
        problems.push(
          `${k}: ${label} is ${b[field]} in production, ${a[field]} in the migration`
        );
      }
    }
  }
  return problems;
}

/** Run a docker command, returning {status, stdout, stderr}. */
function docker(args, opts = {}) {
  const r = spawnSync('docker', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
  return {
    status: r.status,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    error: r.error,
  };
}

/**
 * Build a throwaway database from the migration and return its deparsed policies.
 *
 * THE CONTAINER'S OWN EXIT IS THE HALF-BUILT GUARD. `migrate.sh` runs the migrations with
 * `ON_ERROR_STOP=1`, so a migration that fails takes the container down rather than serving
 * a partial schema. A readiness loop that only polls for "answers a query" would spin until
 * timeout and report a timeout; polling the container STATUS every iteration turns a broken
 * migration into an immediate, named failure. Verified by breaking the migration on
 * purpose: exit code 3, and it never answers a query.
 */
export async function buildScratch(
  name = 'sh-drift-scratch',
  migration = path.join(
    ROOT,
    'supabase/migrations/20251006_complete_monolithic_setup.sql'
  )
) {
  docker(['rm', '-f', name]);
  const run = docker([
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=scratch-only-never-reachable',
    '-e',
    'POSTGRES_HOST=/var/run/postgresql',
    '-v',
    `${path.join(ROOT, 'docker/supabase/roles.sql')}:/etc/postgresql.schema.sql:ro`,
    '-v',
    `${migration}:/docker-entrypoint-initdb.d/migrations/99999999999999_app_monolithic.sql:ro`,
    SCRATCH_IMAGE,
  ]);
  if (run.status !== 0) {
    throw new Error(
      `could not start the scratch database: ${run.stderr.trim() || run.error?.message}`
    );
  }

  // READINESS IS "THE MIGRATION HAS BEEN APPLIED", NOT "A QUERY ANSWERS".
  //
  // `SELECT 1` is not the signal, and using it cost a debugging round. The image runs the
  // migrations against a TEMPORARY server during initdb and then restarts into the real
  // one, so a trivial query succeeds while the app schema is still being built -- and the
  // NEXT query lands in the gap where the temporary server has gone and the real one has
  // not arrived, which surfaces as an empty result rather than an error.
  //
  // So: poll for a non-zero policy count that is STABLE across three consecutive reads.
  // Policies exist only after the app migration has run, and requiring the count to settle
  // spans the restart rather than racing it.
  const COUNT = `SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
                  JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname IN ('public','storage')`;
  const deadline = Date.now() + 240_000;
  let settled = [];
  for (;;) {
    const state = docker([
      'inspect',
      '-f',
      '{{.State.Status}} {{.State.ExitCode}}',
      name,
    ]);
    const [status, code] = state.stdout.trim().split(/\s+/);
    // The container's own exit is the half-built guard. migrate.sh runs with
    // ON_ERROR_STOP=1, so a migration that fails takes the container down instead of
    // serving a partial schema -- checking status every iteration turns that into an
    // immediate named failure rather than a timeout. Verified by breaking the migration on
    // purpose: exit code 3, and it never answers a query.
    if (status !== 'running') {
      const logs = docker(['logs', '--tail', '40', name]);
      throw new Error(
        `the scratch database exited (${status}, code ${code}) before it could answer — ` +
          'the migration does not apply to a fresh database. Last lines:\n' +
          `${logs.stdout}${logs.stderr}`.trim()
      );
    }
    const probe = psql(name, COUNT);
    const n = probe.status === 0 ? Number(probe.stdout.trim()) : NaN;
    if (Number.isInteger(n) && n > 0) {
      settled.push(n);
      if (settled.length >= 3 && new Set(settled.slice(-3)).size === 1) break;
    } else {
      settled = [];
    }
    if (Date.now() > deadline) {
      throw new Error(
        'the scratch database never reported a stable, non-zero policy count within 240s'
      );
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return name;
}

function psql(container, sql) {
  return docker(['exec', container, 'psql', '-U', 'postgres', '-tAc', sql]);
}

/**
 * A psql query whose result is JSON, with the failure NAMED.
 *
 * `JSON.parse(r.stdout)` on a failed or empty query throws "Unexpected end of JSON input",
 * which says nothing about which query, which container, or why -- and that is precisely
 * what it reported the first time the readiness check above was wrong.
 */
function psqlJson(container, sql, what) {
  const r = psql(container, sql);
  if (r.status !== 0) {
    throw new Error(
      `scratch query for ${what} failed: ${r.stderr.trim() || 'no stderr'}`
    );
  }
  const text = r.stdout.trim();
  if (!text) {
    throw new Error(`scratch query for ${what} returned nothing`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `scratch query for ${what} did not return JSON: ${text.slice(0, 200)}`
    );
  }
}

/** Ask the scratch database for its policies. */
export function readScratchPolicies(name) {
  return psqlJson(name, POLICY_QUERY, 'policies') ?? [];
}

const API = 'https://api.supabase.com/v1/projects';

/** One read-only SQL query against the hosted project. */
async function queryProduction(ref, token, sql) {
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

/**
 * `search_path` must be identical on both connections, and both versions get printed.
 *
 * The comparison rests on two Postgres instances deparsing the same declaration the same
 * way. `pg_get_expr` schema-qualifies a name only when it is not on the search path, so two
 * different paths produce two different texts for one unchanged policy — a false positive
 * that looks exactly like real drift.
 */
export function reconcileContext(scratchCtx, prodCtx) {
  const problems = [];
  if (scratchCtx.search_path !== prodCtx.search_path) {
    problems.push(
      `search_path differs between the two connections — scratch ` +
        `[${scratchCtx.search_path}], production [${prodCtx.search_path}]. Every ` +
        'unqualified name could deparse differently, so no comparison below is meaningful.'
    );
  }
  return problems;
}

const CONTEXT_QUERY = `SELECT current_setting('search_path') AS search_path,
                              current_setting('server_version_num') AS server_version_num`;

async function main() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!ref || !token) {
    console.error(
      '::error::[policy-predicates] SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN are ' +
        'required. Both already exist as repo secrets; a missing one is a misconfigured ' +
        'job, not a pass.'
    );
    process.exit(1);
  }

  const name = 'sh-drift-scratch';
  let built = false;
  try {
    console.log(
      `Building a scratch database from the migration (${SCRATCH_IMAGE})…`
    );
    await buildScratch(name);
    built = true;

    const scratchCtx = psqlJson(
      name,
      `SELECT row_to_json(x) FROM (${CONTEXT_QUERY}) x`,
      'connection context'
    );
    const prodCtx = (await queryProduction(ref, token, CONTEXT_QUERY))[0];

    console.log(
      `  scratch ....... PostgreSQL ${scratchCtx.server_version_num}, ` +
        `search_path [${scratchCtx.search_path}]`
    );
    console.log(
      `  production .... PostgreSQL ${prodCtx.server_version_num}, ` +
        `search_path [${prodCtx.search_path}]`
    );
    if (
      String(scratchCtx.server_version_num).slice(0, 2) !==
      String(prodCtx.server_version_num).slice(0, 2)
    ) {
      // A NOTE, NOT A FAILURE. Measured identical across 15.8/17.6 for all 83 policies on
      // 2026-09-04. If a future major ever does deparse differently, it shows up as real
      // differences below with both texts printed, which is a better signal than a version
      // number nobody can act on.
      console.log(
        '  note .......... the two run different Postgres majors. Deparser output was ' +
          'measured byte-identical across this gap; a difference below may still be worth ' +
          'checking against that.'
      );
    }

    const scratch = readScratchPolicies(name);
    const prod =
      (await queryProduction(ref, token, POLICY_QUERY))[0]?.json_agg ?? [];

    console.log(
      `  compared ...... ${scratch.length} policies from the migration against ` +
        `${prod.length} live, across public and storage`
    );

    const problems = [
      ...reconcileContext(scratchCtx, prodCtx),
      ...comparePolicies(scratch, prod),
    ];

    if (!problems.length) {
      console.log(
        '  verdict ....... every policy says the same thing on both sides'
      );
      return;
    }
    console.error(`  verdict ....... ${problems.length} problem(s)`);
    for (const p of problems) {
      console.error(`::error::[policy-predicates] ${p}`);
    }
    console.error(
      '\nA policy MEANS something different on production than the migration declares. ' +
        'The two texts are printed above; neither is assumed to be the right one. If the ' +
        'repo is right, EXECUTE the change against production, because editing the ' +
        'migration does nothing to a database that already exists (#565, #897, #1038, ' +
        '#1071). If PRODUCTION is right, change the migration, which is the only place the ' +
        'intent is written down.'
    );
    process.exit(1);
  } finally {
    if (built) docker(['rm', '-f', name]);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`::error::[policy-predicates] ${err.message}`);
    process.exit(1);
  });
}
