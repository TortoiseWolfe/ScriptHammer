/**
 * The production schema-drift comparator must be able to report failure (#903).
 *
 * A drift check that has only ever been run against a correct production reports "no
 * drift" and tells you nothing — you have observed that it does not crash, not that it
 * can see. So `evaluate()` is pure and driven here in both directions.
 *
 * The centrepiece is `would have caught #897`: the comparator is fed the ACTUAL
 * production state as measured on 2026-08-21, before the fix, and must report both the
 * excess grants and the missing admin policy. A guard built in response to an incident
 * that cannot detect that incident is theatre.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const MODULE = path.resolve(
  __dirname,
  '..',
  'ci',
  'check-prod-schema-drift.mjs'
);

/** The module is ESM; node:test runs CJS here, so import it dynamically. */
async function load() {
  return import(`file://${MODULE}`);
}

/**
 * Production as it should be — the fixture every mutation below starts from.
 *
 * `want.grants` is null for tables the migration never REVOKEs from, which is most of them
 * (#1038): the live grant set there is Supabase's platform default and the file expresses
 * no intent, so the comparator asserts nothing and this fixture supplies nothing.
 * `want.policies` are {name, roles} now, because a policy can keep its name and change
 * meaning — production carried "Service creates profiles" as TO PUBLIC WITH CHECK (true)
 * long after the migration narrowed it.
 */
function healthy(INTENDED) {
  const out = {};
  for (const [table, want] of Object.entries(INTENDED.tables)) {
    out[table] = {
      rls: want.rls,
      grants: want.grants
        ? Object.fromEntries(
            Object.entries(want.grants).map(([r, p]) => [r, [...p].sort()])
          )
        : {},
      // The SCOPE of each grant, which is what `role_table_grants` and `column_privileges`
      // answer separately (#1062). A healthy production holds exactly what the migration
      // grants table-wide, and exactly the named columns where it grants column-scoped.
      tableGrants: want.tableGrants
        ? Object.fromEntries(
            Object.entries(want.tableGrants).map(([r, p]) => [r, [...p].sort()])
          )
        : {},
      columnGrants: want.columnGrants
        ? Object.fromEntries(
            Object.entries(want.columnGrants).map(([r, byPriv]) => [
              r,
              Object.fromEntries(
                Object.entries(byPriv).map(([pr, c]) => [pr, [...c].sort()])
              ),
            ])
          )
        : {},
      policies: want.policies
        .map((p) => ({
          name: p.name,
          roles: [...p.roles].sort(),
          cmd: p.cmd,
          permissive: p.permissive,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      triggers: [...(want.triggers ?? [])].sort(),
    };
  }
  return out;
}

/** A live function list matching the migration exactly, bodies included. */
function healthyFunctions(INTENDED) {
  return INTENDED.functions.map((f) => ({
    name: f.name,
    arity: f.arity,
    body: f.body,
    securityDefiner: f.securityDefiner,
    config: [...f.config],
  }));
}

/** A deep copy, so a mutation in one case cannot leak into the next. */
const clone = (x) => JSON.parse(JSON.stringify(x));

describe('production schema-drift comparator (#903)', () => {
  it('reports nothing when production matches INTENDED', async () => {
    // The control that proves the comparator can PASS. Without it every assertion below
    // is satisfied by a function that always returns problems.
    const { evaluate, INTENDED } = await load();
    assert.deepStrictEqual(evaluate(healthy(INTENDED), INTENDED), []);
  });

  it('WOULD HAVE CAUGHT #897 — the real pre-fix production state', async () => {
    // Measured live on 2026-08-21 before the fix: both roles held everything, and the
    // admin policy was absent while the other nine "Admin can view%" policies existed.
    // This sat undetected for three weeks.
    const { evaluate, INTENDED } = await load();
    const asItWas = {
      payment_intents: {
        rls: true,
        grants: {
          anon: [
            'DELETE',
            'INSERT',
            'REFERENCES',
            'SELECT',
            'TRIGGER',
            'TRUNCATE',
            'UPDATE',
          ],
          authenticated: [
            'DELETE',
            'INSERT',
            'REFERENCES',
            'SELECT',
            'TRIGGER',
            'TRUNCATE',
            'UPDATE',
          ],
        },
        policies: [
          'Payment intents are immutable',
          'Payment intents cannot be deleted by users',
          'Users can create own payment intents',
          'Users can view own payment intents',
        ],
      },
    };
    const problems = evaluate(asItWas, INTENDED).join('\n');

    assert.match(problems, /anon holds .*UPDATE/, 'missed anon holding UPDATE');
    assert.match(
      problems,
      /authenticated holds .*UPDATE/,
      'missed authenticated holding UPDATE — the #565 revoke that never reached prod'
    );
    assert.match(
      problems,
      /WIDER/,
      'did not name the direction of the grant drift'
    );
    assert.match(
      problems,
      /MISSING "Admin can view all payment intents"/,
      'missed the policy production was missing'
    );
  });

  it('a table absent from production is a FAILURE, not a pass', async () => {
    // The anti-vacuity case, and the most dangerous one: a wrong project ref or an
    // expired token yields an empty observation. Reporting "no drift" there is worse
    // than no check at all, because it reports reassurance.
    const { evaluate, INTENDED } = await load();
    const problems = evaluate({}, INTENDED);
    assert.ok(problems.length > 0, 'an empty observation reported no drift');
    assert.match(problems.join('\n'), /NOT FOUND in production/);
  });

  it('names the direction: WIDER when production has extra privileges', async () => {
    const { evaluate, INTENDED } = await load();
    const obs = healthy(INTENDED);
    obs.payment_intents.grants.authenticated = ['DELETE', 'INSERT', 'SELECT'];
    const problems = evaluate(obs, INTENDED).join('\n');
    assert.match(problems, /WIDER by DELETE/);
    assert.doesNotMatch(problems, /NARROWER/);
  });

  it('names the direction: NARROWER when a privilege is gone', async () => {
    // Not a security problem, but a real signal — most likely #559 T025 landed and
    // INTENDED here was not updated. Opposite meaning, so it must read differently.
    const { evaluate, INTENDED } = await load();
    const obs = healthy(INTENDED);
    obs.payment_intents.grants.authenticated = [];
    const problems = evaluate(obs, INTENDED).join('\n');
    assert.match(problems, /NARROWER, missing SELECT/);
    assert.doesNotMatch(problems, /WIDER/);
  });

  it('catches a policy that exists in production but is not declared here', async () => {
    const { evaluate, INTENDED } = await load();
    const obs = healthy(INTENDED);
    obs.payment_intents.policies = [
      ...obs.payment_intents.policies,
      { name: 'Something nobody declared', roles: ['public'] },
    ].sort((a, b) => a.name.localeCompare(b.name));
    assert.match(
      evaluate(obs, INTENDED).join('\n'),
      /UNDECLARED "Something nobody declared"/
    );
  });

  it('catches RLS being turned off', async () => {
    const { evaluate, INTENDED } = await load();
    const obs = healthy(INTENDED);
    obs.payment_intents.rls = false;
    assert.match(evaluate(obs, INTENDED).join('\n'), /RLS is DISABLED/);
  });

  it('treats an unreadable RLS state as a failed observation', async () => {
    const { evaluate, INTENDED } = await load();
    const obs = healthy(INTENDED);
    obs.payment_intents.rls = null;
    assert.match(
      evaluate(obs, INTENDED).join('\n'),
      /could not read RLS state/
    );
  });

  it('WOULD HAVE CAUGHT #1038 — the user_profiles REVOKE that never reached production', async () => {
    // The real pre-fix state, measured 2026-08-31: the migration had carried the
    // column-scoped hardening since 2026-08-28, and production still handed anon and
    // authenticated all seven privileges on user_profiles. With `Users update own profile`
    // allowing auth.uid() = id and no guard trigger, any signed-in user could set
    // is_admin = true on their own row.
    //
    // The old check could not see this: user_profiles was not among the tables it looked at.
    const { evaluate, INTENDED } = await load();
    const obs = healthy(INTENDED);
    const all = [
      'DELETE',
      'INSERT',
      'REFERENCES',
      'SELECT',
      'TRIGGER',
      'TRUNCATE',
      'UPDATE',
    ];
    obs.user_profiles.grants = { anon: [...all], authenticated: [...all] };
    const problems = evaluate(obs, INTENDED).join('\n');
    assert.match(problems, /user_profiles/);
    assert.match(problems, /WIDER/);
  });

  it('WOULD HAVE CAUGHT #1039 — a SELECT policy still open to anon', async () => {
    // user_encryption_keys carried "Anyone can view public keys" as USING (true) with no TO
    // clause, so it applied to PUBLIC — which includes anon. Every user's Argon2 salt was
    // readable with the publishable key. The policy NAME was correct throughout, so a
    // name-only comparison called production a match.
    const { evaluate, INTENDED } = await load();
    const obs = healthy(INTENDED);
    const pol = obs.user_encryption_keys.policies.find((p) =>
      /view public keys/i.test(p.name)
    );
    assert.ok(
      pol,
      'fixture must contain the public-key policy, or this proves nothing'
    );
    pol.roles = ['public'];
    const problems = evaluate(obs, INTENDED).join('\n');
    assert.match(problems, /user_encryption_keys/);
    assert.match(problems, /public/);
    assert.match(problems, /WIDER/);
  });

  it('WOULD HAVE CAUGHT #1032 — the duplicate overload that made an RPC unresolvable', async () => {
    // Production carried admin_audit_trends at BOTH 2 and 4 arguments, every argument
    // defaulted on each, so every call was ambiguous and the RPC failed outright. The
    // migration ordered the 4-arg signature DROPped and nobody ran it.
    const { evaluateFunctions, INTENDED } = await load();
    const live = [
      ...healthyFunctions(INTENDED),
      { name: 'admin_audit_trends', arity: 4 },
    ];
    const problems = evaluateFunctions(live, INTENDED).join('\n');
    assert.match(problems, /admin_audit_trends\(4\)/);
    assert.match(problems, /NOT declared/);
    assert.match(problems, /ambiguous/);
  });

  it('WOULD HAVE CAUGHT a table whose RLS enable never ran', async () => {
    const { evaluate, INTENDED } = await load();
    const obs = healthy(INTENDED);
    obs.edge_idempotency_keys.rls = false;
    assert.match(
      evaluate(obs, INTENDED).join('\n'),
      /edge_idempotency_keys: RLS is DISABLED/
    );
  });

  it('a function declared in the migration but missing from production is a failure', async () => {
    const { evaluateFunctions, INTENDED } = await load();
    const live = healthyFunctions(INTENDED).filter(
      (f) => f.name !== 'admin_user_stats'
    );
    assert.match(
      evaluateFunctions(live, INTENDED).join('\n'),
      /admin_user_stats\(0\).*ABSENT from production/
    );
  });

  it('the function comparator can PASS — otherwise the four tests above prove nothing', async () => {
    const { evaluateFunctions, INTENDED } = await load();
    assert.deepStrictEqual(
      evaluateFunctions(healthyFunctions(INTENDED), INTENDED),
      []
    );
  });

  // ---------------------------------------------------------------------------------
  // #1062 STEP 1 — the four properties the gate used to compare by NAME only.
  //
  // Each pair is deliberate: a mutation that must go red, and the healthy control that
  // must stay green. Without the second, a comparator that always returns problems passes
  // every red test in this file.
  // ---------------------------------------------------------------------------------

  it('WOULD HAVE CAUGHT #1059 — a column grant widened to the whole table', async () => {
    // `GRANT UPDATE (status) ON user_connections` is the instrument of #1059's fix: column
    // privilege is checked independently of RLS and refuses before any policy is consulted.
    // `GRANT UPDATE ON user_connections` reopens it. Both produce the SAME row in
    // information_schema.column_privileges, and until now the gate read only that union —
    // so the two were byte-identical to it.
    const { evaluate, INTENDED } = await load();
    const got = clone(healthy(INTENDED));
    const t = got.user_connections;
    t.tableGrants.authenticated = [
      ...t.tableGrants.authenticated,
      'UPDATE',
    ].sort();
    delete t.columnGrants.authenticated.UPDATE;

    const problems = evaluate(got, INTENDED);
    assert.match(
      problems.join('\n'),
      /user_connections.*WHOLE TABLE.*WIDER by UPDATE/s,
      `expected the table-wide UPDATE to be reported; got: ${problems.join(' | ')}`
    );
  });

  it('WOULD HAVE CAUGHT #1029 — user_profiles SELECT widened past is_admin', async () => {
    // The column list on user_profiles exists so `is_admin` stays unreadable. Widening
    // SELECT to the whole table re-exposes it while every policy still reads correctly.
    const { evaluate, INTENDED } = await load();
    const got = clone(healthy(INTENDED));
    got.user_profiles.tableGrants.authenticated = ['SELECT'];
    delete got.user_profiles.columnGrants.authenticated.SELECT;

    assert.match(
      evaluate(got, INTENDED).join('\n'),
      /user_profiles.*WHOLE TABLE/s
    );
  });

  it('catches a column ADDED to a column-scoped grant', async () => {
    // The direction that matters most: production granting a column the migration withholds.
    // `user_id` on conversation_members is exactly the column #1059 was about.
    const { evaluate, INTENDED } = await load();
    const got = clone(healthy(INTENDED));
    got.conversation_members.columnGrants.authenticated.UPDATE.push('user_id');

    assert.match(
      evaluate(got, INTENDED).join('\n'),
      /conversation_members.*UPDATE.*WIDER by user_id/s
    );
  });

  it('catches a privilege held at column scope that the migration grants nowhere', async () => {
    const { evaluate, INTENDED } = await load();
    const got = clone(healthy(INTENDED));
    got.user_profiles.columnGrants.authenticated.DELETE = ['id'];

    assert.match(
      evaluate(got, INTENDED).join('\n'),
      /user_profiles.*DELETE.*grants it nowhere/s
    );
  });

  it('catches a policy whose command was widened to ALL', async () => {
    // FOR SELECT flipped to FOR ALL hands the role INSERT, UPDATE and DELETE under one
    // predicate, with the name, the roles and the expression all byte-identical.
    const { evaluate, INTENDED } = await load();
    const got = clone(healthy(INTENDED));
    const p = got.messages.policies.find((x) => x.cmd === 'INSERT');
    assert.ok(p, 'fixture must contain an INSERT policy on messages');
    p.cmd = 'ALL';

    assert.match(
      evaluate(got, INTENDED).join('\n'),
      /messages.*is FOR ALL in production.*WIDER/s
    );
  });

  it('catches a policy flipped from RESTRICTIVE to PERMISSIVE', async () => {
    // A restrictive policy is ANDed with its siblings; a permissive one is ORed. Same
    // expression, opposite meaning for access.
    const { evaluate, INTENDED } = await load();
    const got = clone(healthy(INTENDED));
    got.conversation_members.policies[0].permissive =
      !got.conversation_members.policies[0].permissive;

    assert.match(
      evaluate(got, INTENDED).join('\n'),
      /conversation_members.*policy .* (PERMISSIVE|RESTRICTIVE) in production/s
    );
  });

  it('catches a trigger that never reached production', async () => {
    // `before_message_update_column_guard` is #281's fix for OR-combined UPDATE policies
    // gating rows rather than columns. Nothing asserted any trigger before this.
    const { evaluate, INTENDED } = await load();
    const got = clone(healthy(INTENDED));
    const table = Object.keys(INTENDED.tables).find(
      (t) => (INTENDED.tables[t].triggers ?? []).length > 0
    );
    assert.ok(table, 'the migration must declare at least one trigger');
    got[table].triggers = [];

    assert.match(
      evaluate(got, INTENDED).join('\n'),
      /triggers differ.*MISSING/s
    );
  });

  it('the migration declares the triggers this asserts — the floor for the above', async () => {
    const { INTENDED } = await load();
    const total = Object.values(INTENDED.tables).reduce(
      (n, t) => n + (t.triggers?.length ?? 0),
      0
    );
    // Lowering this to make a run pass is the move never to make (#396). If the trigger
    // parser silently stops matching, this is the only thing that notices.
    assert.ok(total >= 3, `parsed only ${total} triggers from the migration`);
  });

  it('WOULD HAVE CAUGHT a SECURITY DEFINER helper rewritten on production', async () => {
    // 22 of 26 public functions are SECURITY DEFINER and every serious predicate delegates
    // to four of them. `is_conversation_member` rewritten to `SELECT true` leaves all 83
    // policy expressions matching their declarations — the gate compared name and arity.
    const { evaluateFunctions, INTENDED } = await load();
    const live = clone(healthyFunctions(INTENDED));
    const f = live.find((x) => x.name === 'is_conversation_member');
    assert.ok(f, 'is_conversation_member must be declared');
    f.body = ' SELECT true; ';

    assert.match(
      evaluateFunctions(live, INTENDED).join('\n'),
      /is_conversation_member.*BODY in production differs/s
    );
  });

  it('catches SECURITY DEFINER lost, and says which direction', async () => {
    const { evaluateFunctions, INTENDED } = await load();
    const live = clone(healthyFunctions(INTENDED));
    const f = live.find((x) => x.securityDefiner);
    f.securityDefiner = false;

    assert.match(
      evaluateFunctions(live, INTENDED).join('\n'),
      /production is SECURITY INVOKER.*NARROWER/s
    );
  });

  it('catches a SECURITY DEFINER function that lost its pinned search_path', async () => {
    const { evaluateFunctions, INTENDED } = await load();
    const live = clone(healthyFunctions(INTENDED));
    const f = live.find(
      (x) =>
        x.securityDefiner && x.config.some((c) => c.startsWith('search_path='))
    );
    assert.ok(f, 'at least one SECURITY DEFINER function must pin search_path');
    f.config = [];

    assert.match(
      evaluateFunctions(live, INTENDED).join('\n'),
      /settings are \[none\] in production.*CALLER/s
    );
  });

  it('the migration parses function bodies at all — the floor for the three above', async () => {
    // Every assertion above is satisfied vacuously if `body` comes back null: the
    // comparator skips a function whose body it could not read, by design, because a
    // parser that guesses at a body would report drift on every function it misread.
    const { INTENDED } = await load();
    const withBody = INTENDED.functions.filter(
      (f) => typeof f.body === 'string' && f.body.length > 0
    );
    assert.strictEqual(
      withBody.length,
      INTENDED.functions.length,
      `${INTENDED.functions.length - withBody.length} function(s) parsed with no body; ` +
        'the body comparison silently skips those'
    );
    assert.ok(
      INTENDED.functions.filter((f) => f.securityDefiner).length >= 20,
      'expected at least 20 SECURITY DEFINER functions'
    );
  });

  it('a comment-only edit to the migration is NOT drift', async () => {
    // The counterweight for every red test above. A comparator that always reports
    // problems passes all of them; this is what it cannot pass. `--` comments are blanked
    // before parsing, and function bodies are read from the RAW text so that a comment
    // INSIDE a body still compares equal.
    const { deriveIntended } = await import(
      `file://${path.resolve(__dirname, '..', 'ci', 'derive-intended-schema.mjs')}`
    );
    const fs = require('fs');
    const migration = path.resolve(
      __dirname,
      '..',
      '..',
      'supabase',
      'migrations',
      '20251006_complete_monolithic_setup.sql'
    );
    const raw = fs.readFileSync(migration, 'utf8');
    const reworded = raw.replace(
      /^-- Enable realtime for group tables$/m,
      '-- Enable realtime for the group tables (reworded, same schema)'
    );
    assert.notStrictEqual(reworded, raw, 'the reword anchor must exist');

    assert.deepStrictEqual(
      deriveIntended(reworded),
      deriveIntended(raw),
      'rewording a comment changed the derived intent'
    );
  });

  it('blanking comments preserves length — function bodies depend on it', async () => {
    // `prosrc` stores a body byte-for-byte, `--` comments included. Bodies are therefore
    // read from the RAW migration at indices found in the masked copy, which only works
    // while masking preserves length. Removing comments instead would offset every index
    // and silently truncate bodies.
    const { stripComments } = await import(
      `file://${path.resolve(__dirname, '..', 'ci', 'derive-intended-schema.mjs')}`
    );
    const sql = 'SELECT 1; -- a trailing comment\nSELECT 2;';
    const masked = stripComments(sql);
    assert.strictEqual(masked.length, sql.length);
    assert.ok(!masked.includes('trailing comment'));
    assert.strictEqual(masked.indexOf('SELECT 2'), sql.indexOf('SELECT 2'));
  });

  it('INTENDED actually declares something', async () => {
    // If INTENDED were emptied, every test above would pass vacuously — including the
    // healthy-case control, which would compare nothing to nothing.
    const { INTENDED } = await load();
    const tables = Object.keys(INTENDED.tables);
    assert.ok(tables.length > 0, 'INTENDED declares no tables');

    // The floor that matters now (#1038). INTENDED is PARSED from the migration, so a
    // regex that quietly stops matching does not throw — it produces a smaller, still
    // plausible-looking intent, and the check goes green over whatever it no longer sees.
    // That is the failure mode this whole ticket describes, one level down. These numbers
    // are the real schema; raising them as it grows is fine, LOWERING one to make a run
    // pass is the thing never to do (#396).
    assert.ok(
      tables.length >= 19,
      `parsed only ${tables.length} tables from the migration; expected at least 19`
    );
    const policies = Object.values(INTENDED.tables).reduce(
      (n, t) => n + t.policies.length,
      0
    );
    assert.ok(
      policies >= 70,
      `parsed only ${policies} policies; expected at least 70`
    );
    assert.ok(
      INTENDED.functions.length >= 25,
      `parsed only ${INTENDED.functions.length} functions; expected at least 25`
    );

    // Every table must have SOME assertion attached, or it is being carried in the list
    // while contributing nothing.
    for (const [t, want] of Object.entries(INTENDED.tables)) {
      assert.ok(
        want.policies.length > 0 || want.rls || want.grants,
        `${t} declares nothing at all — it is in the list but asserts no property`
      );
    }

    // Grants are asserted only where the migration REVOKEs. Both forms must be understood:
    // REVOKE ALL, and the PARTIAL revokes that narrow payment_intents. Parsing only the
    // first silently dropped payment_intents to "not asserted" — a coverage loss with no
    // error, which is how this class of bug always arrives.
    const controlled = Object.entries(INTENDED.tables).filter(
      ([, t]) => t.grants
    );
    assert.ok(
      controlled.some(([n]) => n === 'payment_intents'),
      'payment_intents must keep a grant assertion — it is narrowed by PARTIAL revokes, ' +
        'and a parser that only understands REVOKE ALL loses it without saying so'
    );
    assert.deepStrictEqual(
      INTENDED.tables.payment_intents.grants,
      { anon: ['SELECT'], authenticated: ['SELECT'] },
      'the partial-revoke arithmetic must subtract from the platform default, not from {}'
    );
  });
});

describe('the drift workflow keeps the production token out of PR jobs (#903)', () => {
  const fs = require('node:fs');
  const WF = path.resolve(
    __dirname,
    '..',
    '..',
    '.github',
    'workflows',
    'prod-schema-drift.yml'
  );

  /** The `on:` block only — `pull_request` inside a comment or a job is not a trigger. */
  function triggers() {
    const text = fs.readFileSync(WF, 'utf8');
    const start = text.search(/^on:\s*$/m);
    assert.notStrictEqual(start, -1, 'no on: block found — this test is stale');
    const rest = text.slice(start);
    const end = rest.search(/^jobs:\s*$/m);
    const block = end === -1 ? rest : rest.slice(0, end);
    // Strip comments: this workflow's header explains WHY it is not PR-triggered and
    // says "pull_request" while doing so. Matching that prose would make the assertion
    // below fail on a correct file, or pass on a broken one after a reword.
    return block.replace(/^\s*#.*$/gm, '');
  }

  it('the workflow exists and its triggers were parsed', () => {
    assert.ok(fs.existsSync(WF), `${WF} is gone`);
    assert.ok(triggers().length > 0, 'parsed an empty on: block');
  });

  it('is never triggered by a pull request', () => {
    // This job holds SUPABASE_ACCESS_TOKEN. #575 and #897 are both about keeping
    // production credentials away from PR jobs, which then run an arbitrary third-party
    // dependency graph from a contributor branch.
    assert.doesNotMatch(
      triggers(),
      /^\s{2}(pull_request|pull_request_target):/m,
      'prod-schema-drift.yml became PR-triggered while holding a production credential. ' +
        'Use the schedule and push-to-main triggers; the comparator itself is already ' +
        'gated on every PR by the tests above.'
    );
  });

  it('still runs on a schedule — the cron is the whole point', () => {
    // Out-of-band production changes have no repo event behind them. #897's drift
    // arrived with no commit, so a workflow that only ran on push would have missed it
    // exactly as everything else did.
    assert.match(triggers(), /^\s{2}schedule:/m, 'the daily cron was removed');
  });
});
