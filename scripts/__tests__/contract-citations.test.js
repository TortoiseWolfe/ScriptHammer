/**
 * The messaging contract's Source column must name objects that actually exist (#892).
 *
 * WHY THIS EXISTS. `docs/messaging/AUTHORIZATION-CONTRACT.md` calls itself the canonical
 * catalogue that "the provider code and the conformance suite reference as the contract",
 * and CLAUDE.md and #265 both send readers to it. Its Source column used to cite line
 * numbers into the monolithic migration — `:2172`, `:2649` — and by 2026-08-21 **all
 * twelve were wrong**, two of them pointing at blank lines.
 *
 * That was structural, not carelessness. The migration is deliberately monolithic and
 * append-only (CLAUDE.md: "NEVER create separate migration files"); every insertion
 * shifts every citation below it, and nothing compared a citation to its target. A
 * reference that is never checked against its subject is the #396 defect wearing a
 * different hat.
 *
 * So the doc now cites objects by NAME, which an append-only file cannot invalidate, and
 * this test is the thing that compares them. It fails when a cited policy, function,
 * trigger or index no longer exists — e.g. after a rename.
 *
 * ANTI-VACUITY. The floor below matters more than the loop. Without it, deleting the
 * Source column — or breaking the row parser — makes this test scan zero citations and
 * report success, which is exactly the failure it was written to prevent. It asserts a
 * minimum count as well as the individual names.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC = path.join(ROOT, 'docs/messaging/AUTHORIZATION-CONTRACT.md');
const MIGRATION = path.join(
  ROOT,
  'supabase/migrations/20251006_complete_monolithic_setup.sql'
);

/**
 * Citations live only in the Source column of a clause row, and only inside backticks.
 *
 * Deliberately narrow. A looser scan would match the surrounding prose — including the
 * paragraphs in this repo's docs that DISCUSS policy names — and a guard that matches its
 * own explanatory text passes while the thing it guards is broken. That mistake has been
 * made here repeatedly; see #892 and the header of scripts/render-talk.mjs.
 */
function citations() {
  const rows = fs
    .readFileSync(DOC, 'utf8')
    .split('\n')
    .filter((l) => /\*\*C\d+\*\*/.test(l));

  const found = [];
  for (const row of rows) {
    const cells = row.split('|');
    if (cells.length < 4) continue;
    const clause = row.match(/\*\*C(\d+)\*\*/)[1];
    for (const span of cells[3].match(/`[^`]+`/g) ?? []) {
      const body = span.slice(1, -1);
      // A quoted SQL policy name: "Users can edit own messages" ON messages
      const policy = body.match(/^"([^"]+)"\s+ON\s+(\w+)$/);
      if (policy) {
        found.push({
          clause,
          kind: 'policy',
          name: policy[1],
          table: policy[2],
        });
        continue;
      }
      // A function, written with its call parens: assign_sequence_number()
      const fn = body.match(/^(\w+)\(\)$/);
      if (fn) {
        found.push({ clause, kind: 'function', name: fn[1] });
        continue;
      }
      // A trigger or index, tagged so it is not confused with prose identifiers.
      const named = body.match(/^(trigger|index)\s+(\w+)$/);
      if (named) {
        found.push({ clause, kind: named[1], name: named[2] });
      }
    }
  }
  return found;
}

/** Where the migration actually defines each kind of object. */
function definitionOf(sql, c) {
  if (c.kind === 'policy') {
    return new RegExp(
      `CREATE POLICY\\s+"${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+ON\\s+${c.table}\\b`
    ).test(sql);
  }
  if (c.kind === 'function') {
    return new RegExp(`CREATE OR REPLACE FUNCTION\\s+${c.name}\\s*\\(`).test(
      sql
    );
  }
  if (c.kind === 'trigger') {
    return new RegExp(`CREATE TRIGGER\\s+${c.name}\\b`).test(sql);
  }
  return new RegExp(`CREATE (UNIQUE )?INDEX[^;]*\\b${c.name}\\b`).test(sql);
}

test('every object the contract cites exists in the migration', () => {
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  const cited = citations();

  const missing = cited.filter((c) => !definitionOf(sql, c));
  assert.deepStrictEqual(
    missing.map((c) => `C${c.clause}: ${c.kind} ${c.name}`),
    [],
    'the contract cites objects the migration does not define — rename, or fix the citation'
  );
});

test('the citation scan is not vacuous', () => {
  const cited = citations();
  // 14 clauses carry rule text; C4 and C6 are deliberately undefined, and C29/C30 cite
  // TypeScript rather than SQL. Twelve SQL-backed clauses is the floor, and each cites at
  // least one object. If this drops, the parser broke or the column was emptied — either
  // way the test above went quietly green without checking anything.
  assert.ok(
    cited.length >= 12,
    `expected at least 12 cited SQL objects, scanned ${cited.length} — ` +
      'the Source column or this parser has changed shape, and the citation check ' +
      'above is no longer looking at anything'
  );
  const clauses = new Set(cited.map((c) => c.clause));
  assert.ok(
    clauses.size >= 10,
    `citations cover only ${clauses.size} clauses — expected at least 10`
  );
});
