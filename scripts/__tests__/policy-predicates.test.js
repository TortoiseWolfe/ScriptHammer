/**
 * The predicate comparator must be able to report failure (#1062).
 *
 * The centrepiece is `WOULD HAVE CAUGHT #352`: the comparator is fed the ACTUAL texts
 * measured on 2026-09-04 — production's `messages` INSERT policy without the
 * blocked-connection clause, against what the migration produces with it — and must report
 * exactly one difference, on that policy, with both texts. A guard built in response to an
 * incident that cannot detect that incident is theatre.
 *
 * Everything here is PURE: no docker, no network. The orchestration around it was exercised
 * for real and both of its failure paths were driven on purpose — a C30-stripped migration
 * produced exactly one difference end-to-end, and a syntactically broken migration made the
 * container exit 3 and was reported as a named failure in 7 seconds rather than a timeout.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const MODULE = path.resolve(__dirname, '..', 'ci', 'policy-predicates.mjs');
const load = () => import(`file://${MODULE}`);

/**
 * The real `messages` INSERT policy, as Postgres deparsed it on 2026-09-04.
 *
 * WITH the C30 clause — what the migration produces, and what production has had since the
 * fix was applied.
 */
const WITH_C30 =
  '((sender_id = auth.uid()) AND ((EXISTS ( SELECT 1\n' +
  '   FROM conversations c\n' +
  '  WHERE ((c.id = messages.conversation_id) AND (c.is_group = false) AND ' +
  '((c.participant_1_id = auth.uid()) OR (c.participant_2_id = auth.uid())) AND ' +
  '(NOT (EXISTS ( SELECT 1\n' +
  '           FROM user_connections uc\n' +
  "          WHERE ((uc.status = 'blocked'::text) AND (((uc.requester_id = " +
  'c.participant_1_id) AND (uc.addressee_id = c.participant_2_id)) OR ' +
  '((uc.requester_id = c.participant_2_id) AND (uc.addressee_id = ' +
  'c.participant_1_id))))))))))) OR is_conversation_member(conversation_id)))';

/** WITHOUT it — the state production was actually in for nineteen days. */
const WITHOUT_C30 =
  '((sender_id = auth.uid()) AND ((EXISTS ( SELECT 1\n' +
  '   FROM conversations c\n' +
  '  WHERE ((c.id = messages.conversation_id) AND (c.is_group = false) AND ' +
  '((c.participant_1_id = auth.uid()) OR (c.participant_2_id = auth.uid()))))) OR ' +
  'is_conversation_member(conversation_id)))';

const policy = (over = {}) => ({
  sch: 'public',
  tbl: 'messages',
  pol: 'Users can send messages to own conversations',
  cmd: 'a',
  perm: true,
  roles: '{public}',
  qual: '',
  wc: WITH_C30,
  ...over,
});

/** A small healthy corpus spanning both schemas. */
const healthy = () => [
  policy(),
  policy({
    tbl: 'conversations',
    pol: 'Users can view own conversations',
    cmd: 'r',
    qual: '(participant_1_id = auth.uid())',
    wc: '',
  }),
  policy({
    sch: 'storage',
    tbl: 'objects',
    pol: 'Buyers and operator can read intake files',
    cmd: 'r',
    roles: '{authenticated}',
    qual: "((bucket_id = 'intake'::text) AND is_admin(auth.uid()))",
    wc: '',
  }),
];

const clone = (x) => JSON.parse(JSON.stringify(x));

describe('policy predicate comparator (#1062 step 2)', () => {
  it('reports nothing when both sides agree', async () => {
    // The control that proves the comparator can PASS. Without it, every assertion below is
    // satisfied by a function that always returns problems.
    const { comparePolicies } = await load();
    assert.deepStrictEqual(comparePolicies(healthy(), healthy()), []);
  });

  it('WOULD HAVE CAUGHT #352 — the blocked-connection clause missing from production', async () => {
    // The real nineteen-day divergence, in the real deparsed texts. Name, command, roles and
    // permissiveness are all identical here on purpose: those are exactly what the old gate
    // compared, and they matched throughout.
    const { comparePolicies } = await load();
    const prod = clone(healthy());
    prod[0].wc = WITHOUT_C30;

    const problems = comparePolicies(healthy(), prod);
    assert.strictEqual(
      problems.length,
      1,
      `expected exactly one difference, got ${problems.length}: ${problems.join(' | ')}`
    );
    assert.match(problems[0], /public\.messages/);
    assert.match(problems[0], /WITH CHECK differs/);
    // BOTH texts, so the reader can see what changed without going to the database.
    assert.ok(
      problems[0].includes('blocked'),
      'the migration text must be printed'
    );
    assert.match(problems[0], /migration:/);
    assert.match(problems[0], /production:/);
  });

  it('never guesses a direction on an expression', async () => {
    // WIDER/NARROWER is decidable for a set of privileges and is NOT decidable for a boolean
    // expression. A gate that guesses will guess backwards on a NOT EXISTS, confidently.
    const { comparePolicies } = await load();
    const prod = clone(healthy());
    prod[0].wc = WITHOUT_C30;

    const text = comparePolicies(healthy(), prod).join('\n');
    assert.doesNotMatch(text, /\bWIDER\b|\bNARROWER\b/);
  });

  it('catches a policy the migration declares and production does not have', async () => {
    const { comparePolicies } = await load();
    const prod = clone(healthy()).slice(1);

    assert.match(
      comparePolicies(healthy(), prod).join('\n'),
      /ABSENT from production/
    );
  });

  it('catches a policy live in production that the migration never declared', async () => {
    const { comparePolicies } = await load();
    const prod = clone(healthy());
    prod.push(
      policy({ tbl: 'orders', pol: 'left over from an old migration' })
    );

    assert.match(
      comparePolicies(healthy(), prod).join('\n'),
      /NOT declared in the migration/
    );
  });

  it('catches a USING expression that differs, not just WITH CHECK', async () => {
    const { comparePolicies } = await load();
    const prod = clone(healthy());
    prod[1].qual = '(true)';

    assert.match(
      comparePolicies(healthy(), prod).join('\n'),
      /conversations.*USING differs/s
    );
  });

  it('asserts command, permissiveness and roles for storage — nothing else does', async () => {
    // check-prod-schema-drift.mjs owns those three for `public`, so asserting them here too
    // would make one divergence read as two findings. For `storage` it cannot: that table is
    // not created by this repo, so its eight policies are asserted by nothing else (#1072).
    const { comparePolicies } = await load();

    const prodRoles = clone(healthy());
    prodRoles[2].roles = '{public}';
    assert.match(comparePolicies(healthy(), prodRoles).join('\n'), /roles is/);

    const prodCmd = clone(healthy());
    prodCmd[2].cmd = '*';
    assert.match(comparePolicies(healthy(), prodCmd).join('\n'), /command is/);

    const prodPerm = clone(healthy());
    prodPerm[2].perm = false;
    assert.match(
      comparePolicies(healthy(), prodPerm).join('\n'),
      /permissiveness is/
    );
  });

  it('catches a storage.objects predicate that changed — #1072', async () => {
    // The eight storage policies are asserted by NOTHING else: check-prod-schema-drift.mjs
    // scopes to `public`, and it structurally cannot cover them, because storage.objects is
    // not created by this repo. `Buyers and operator can read intake files` gates customer
    // uploads on is_admin(), so this is the one that matters most.
    const { comparePolicies } = await load();
    const prod = clone(healthy());
    prod[2].qual = "(bucket_id = 'intake'::text)"; // is_admin() silently dropped

    const problems = comparePolicies(healthy(), prod);
    assert.strictEqual(problems.length, 1);
    assert.match(problems[0], /storage\.objects/);
    assert.match(problems[0], /USING differs/);
    assert.ok(
      problems[0].includes('is_admin'),
      'the migration text, showing the lost admin check, must be printed'
    );
  });

  it('does NOT double-report command and roles for public', async () => {
    const { comparePolicies } = await load();
    const prod = clone(healthy());
    prod[0].cmd = '*';
    prod[0].roles = '{authenticated}';

    assert.deepStrictEqual(
      comparePolicies(healthy(), prod),
      [],
      'public command/roles belong to the schema-drift check, not this one'
    );
  });

  it('an empty scratch is a failed build, never agreement', async () => {
    const { comparePolicies } = await load();
    assert.match(
      comparePolicies([], healthy()).join('\n'),
      /scratch database reported NO policies/
    );
  });

  it('an empty production read is a failed observation, never agreement', async () => {
    // The #903 failure one level down: a wrong project ref or an expired token yields an
    // empty result, and comparing nothing to nothing passes while reporting reassurance.
    const { comparePolicies } = await load();
    assert.match(
      comparePolicies(healthy(), []).join('\n'),
      /production reported NO policies/
    );
    assert.match(comparePolicies(healthy(), null).join('\n'), /NO policies/);
  });

  it('refuses to compare when the two connections disagree on search_path', async () => {
    // pg_get_expr schema-qualifies a name only when it is NOT on the search path, so two
    // different paths produce two different texts for one unchanged policy — a false
    // positive shaped exactly like real drift.
    const { reconcileContext } = await load();
    assert.deepStrictEqual(
      reconcileContext(
        { search_path: '"$user", public, extensions' },
        { search_path: '"$user", public, extensions' }
      ),
      []
    );
    assert.match(
      reconcileContext(
        { search_path: '"$user", public, extensions' },
        { search_path: 'public' }
      ).join('\n'),
      /search_path differs/
    );
  });

  it('pins ONE Postgres version, shared with docker-compose.yml', async () => {
    // A second version constant is a second declaration that drifts from the first by
    // memory — the defect #1038 is about. This fails if compose moves and this file does not.
    const { SCRATCH_IMAGE } = await load();
    const compose = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'docker-compose.yml'),
      'utf8'
    );
    assert.ok(
      compose.includes(SCRATCH_IMAGE),
      `${SCRATCH_IMAGE} is not the image docker-compose.yml pins — the two have drifted`
    );
  });

  it('the query reads both schemas and both expression slots', async () => {
    // The floor. If the query silently stopped selecting `polwithcheck`, every WITH CHECK
    // would compare '' against '' and this whole file would pass while asserting nothing —
    // and WITH CHECK is the slot #352 was in.
    const { POLICY_QUERY } = await load();
    for (const needle of [
      'pg_get_expr(p.polqual',
      'pg_get_expr(p.polwithcheck',
      "'public', 'storage'",
      'polpermissive',
      'polcmd',
    ]) {
      assert.ok(
        POLICY_QUERY.includes(needle),
        `the policy query no longer selects ${needle}`
      );
    }
  });
});

describe('the predicate check is wired into the drift workflow', () => {
  const WORKFLOW = path.resolve(
    __dirname,
    '..',
    '..',
    '.github',
    'workflows',
    'prod-schema-drift.yml'
  );
  const yml = fs.readFileSync(WORKFLOW, 'utf8');

  it('runs the script', () => {
    assert.match(yml, /scripts\/ci\/policy-predicates\.mjs/);
  });

  it('re-runs when the script or the migration changes', () => {
    // The parser is as load-bearing as the comparator: a change to either can shrink what
    // is asserted without failing anything (#1038).
    assert.match(yml, /scripts\/ci\/policy-predicates\.mjs/);
    assert.match(yml, /supabase\/migrations/);
  });

  it('is never triggered by a pull request', () => {
    // It holds the production token. A fork PR must never be able to run it.
    assert.doesNotMatch(yml, /^\s*pull_request:/m);
  });
});
