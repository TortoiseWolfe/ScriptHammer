/**
 * No GRANT may confer a privilege that RLS blocks unconditionally (#565).
 *
 * `payment_intents` carried `GRANT SELECT, INSERT, UPDATE ... TO authenticated` while the
 * "Payment intents are immutable" policy is `FOR UPDATE USING (false)`. Nothing could
 * ever use that UPDATE. It is not a vulnerability — RLS is what actually decides — but it
 * is worse than harmless: it reads as a live capability to anyone auditing what
 * `authenticated` can do, and the security posture is exactly the thing people read this
 * file to learn.
 *
 * WHY A CROSS-CHECK RATHER THAN DELETING ONE LINE. The shape generalises: a grant and a
 * policy are written in different sections, hundreds of lines apart, and nothing relates
 * them. Removing the one instance leaves the next one just as invisible. This relates
 * them mechanically.
 *
 * WHAT IT DELIBERATELY IGNORES:
 *
 *   `service_role`      bypasses RLS entirely, so a policy says nothing about what it
 *                       can do. Flagging `GRANT ALL ... TO service_role` would be wrong.
 *   tables with no RLS  no policies means nothing is blocked; the grant is the whole
 *                       story and is not dead.
 *   partially-blocked   RLS policies are OR'd, so a privilege is only unreachable when
 *                       EVERY policy covering it is unconditionally false. One
 *                       permissive policy makes it live.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATION = path.join(
  __dirname,
  '..',
  '..',
  'supabase',
  'migrations',
  '20251006_complete_monolithic_setup.sql'
);

/** Roles that RLS actually constrains. `service_role` bypasses it. */
const RLS_BOUND_ROLES = new Set(['authenticated', 'anon']);

function sql() {
  return fs.readFileSync(MIGRATION, 'utf8');
}

/** `GRANT SELECT, INSERT ON t TO authenticated;` -> one entry per privilege. */
function grants(text) {
  const out = [];
  for (const m of text.matchAll(
    /^GRANT\s+([A-Z, ]+?)\s+ON\s+(?:public\.)?"?([a-z_]+)"?\s+TO\s+([a-z_]+);/gim
  )) {
    const role = m[3].toLowerCase();
    if (!RLS_BOUND_ROLES.has(role)) continue;
    for (const priv of m[1].split(',').map((s) => s.trim().toUpperCase())) {
      if (priv === 'ALL') continue; // widened deliberately; not this check's business
      out.push({ table: m[2].toLowerCase(), priv, role });
    }
  }
  return out;
}

/** table -> operation -> [{ name, alwaysFalse }] */
function policies(text) {
  const byTable = {};
  for (const m of text.matchAll(
    /CREATE POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?"?([a-z_]+)"?\s+([\s\S]*?);/gi
  )) {
    const [, name, table, body] = m;
    const op = (
      /FOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)/i.exec(body)?.[1] ?? 'ALL'
    ).toUpperCase();
    const alwaysFalse =
      /USING\s*\(\s*false\s*\)/i.test(body) ||
      /WITH CHECK\s*\(\s*false\s*\)/i.test(body);
    const t = (byTable[table.toLowerCase()] ??= {});
    (t[op] ??= []).push({ name, alwaysFalse });
  }
  return byTable;
}

/** Grants whose privilege every covering policy blocks unconditionally. */
function deadGrants(text) {
  const pol = policies(text);
  const dead = [];
  for (const g of grants(text)) {
    const t = pol[g.table];
    if (!t) continue; // no RLS on this table: the grant is the whole story
    const covering = [...(t[g.priv] ?? []), ...(t.ALL ?? [])];
    if (covering.length && covering.every((p) => p.alwaysFalse)) {
      dead.push(
        `${g.table}: GRANT ${g.priv} TO ${g.role} — blocked by ` +
          covering.map((p) => `"${p.name}"`).join(' + ')
      );
    }
  }
  return dead.sort();
}

describe('no GRANT confers a privilege RLS blocks outright (#565)', () => {
  it('parses a meaningful number of grants and policies', () => {
    // Non-vacuity. A regex that stopped matching would report the migration as clean,
    // which is the #396 shape this repo keeps paying for.
    const text = sql();

    assert.ok(
      grants(text).length >= 10,
      `only ${grants(text).length} role-bound grants parsed; the parser is broken`
    );
    assert.ok(
      Object.keys(policies(text)).length >= 10,
      `only ${Object.keys(policies(text)).length} tables with policies parsed`
    );
  });

  it('has no dead grants', () => {
    assert.deepEqual(
      deadGrants(sql()),
      [],
      'a GRANT confers a privilege that every covering RLS policy blocks with ' +
        '`USING (false)`. It can never be exercised, and it reads to an auditor as a ' +
        'live capability. Drop it from the GRANT **and** add an explicit REVOKE — this ' +
        'migration re-runs against existing databases, so narrowing the GRANT alone ' +
        'leaves the privilege in place everywhere it has already been applied.'
    );
  });

  it('the detector can actually fail, and does not over-fire', () => {
    // Controls in both directions. An over-eager version would flag `service_role`
    // (which bypasses RLS) or a table whose privilege is blocked by only ONE of two
    // policies — RLS ORs them, so that privilege is still live.
    const blocked = `
CREATE POLICY "immutable" ON widgets FOR UPDATE USING (false);
GRANT SELECT, UPDATE ON widgets TO authenticated;`;
    assert.equal(
      deadGrants(blocked).length,
      1,
      'a genuinely dead grant must be flagged'
    );

    const bypasses = `
CREATE POLICY "immutable" ON widgets FOR UPDATE USING (false);
GRANT ALL ON widgets TO service_role;`;
    assert.deepEqual(
      deadGrants(bypasses),
      [],
      'service_role bypasses RLS — never flag it'
    );

    const alsoPermissive = `
CREATE POLICY "immutable" ON widgets FOR UPDATE USING (false);
CREATE POLICY "owner may edit" ON widgets FOR UPDATE USING (auth.uid() = owner_id);
GRANT SELECT, UPDATE ON widgets TO authenticated;`;
    assert.deepEqual(
      deadGrants(alsoPermissive),
      [],
      'policies are OR-ed, so one permissive policy keeps the privilege live'
    );

    const noRls = `GRANT SELECT, UPDATE ON widgets TO authenticated;`;
    assert.deepEqual(
      deadGrants(noRls),
      [],
      'no policies means nothing is blocked'
    );
  });
});
