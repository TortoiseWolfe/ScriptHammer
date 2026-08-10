/**
 * The generated public-table surface must match the schema it is meant to
 * describe (#565).
 *
 * `audit_logs` and `profiles` survived in the generated types after the
 * monolithic migration dropped both legacy tables. Code could therefore type
 * check against a table that did not exist in production. Read the TypeScript
 * AST rather than grepping names: comments, relation names, and string values
 * are not table declarations.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..', '..');
const TYPES_PATH = path.join(ROOT, 'src/lib/supabase/types.ts');
const MIGRATION_PATH = path.join(
  ROOT,
  'supabase/migrations/20251006_complete_monolithic_setup.sql'
);

function propertyName(member) {
  if (!member.name) return null;
  if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) {
    return member.name.text;
  }
  return null;
}

function objectProperty(type, name, from) {
  assert.ok(ts.isTypeLiteralNode(type), `${from} must be a type literal`);
  const property = type.members.find(
    (member) => ts.isPropertySignature(member) && propertyName(member) === name
  );
  assert.ok(property?.type, `${from} has no ${name} property`);
  assert.ok(
    ts.isTypeLiteralNode(property.type),
    `${from}.${name} must be a type literal`
  );
  return property.type;
}

function publicTableNames(typesSource, fileName = 'types.ts') {
  const source = ts.createSourceFile(
    fileName,
    typesSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const database = source.statements.find(
    (statement) =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === 'Database'
  );
  assert.ok(database, `${fileName} has no Database type alias`);

  const publicSchema = objectProperty(database.type, 'public', 'Database');
  const tables = objectProperty(publicSchema, 'Tables', 'Database.public');
  const names = tables.members
    .filter(ts.isPropertySignature)
    .map(propertyName)
    .filter(Boolean)
    .sort();

  assert.ok(names.length > 0, `${fileName} declares no public tables`);
  return names;
}

function migrationTableNames(migrationSource) {
  const names = [
    ...migrationSource.matchAll(
      /^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(?:public\.)?("?)([A-Za-z_][A-Za-z0-9_]*)\1\b/gim
    ),
  ]
    .map((match) => match[2])
    .sort();

  assert.ok(names.length > 0, 'The monolithic migration declares no tables');
  assert.strictEqual(
    new Set(names).size,
    names.length,
    'The monolithic migration creates a table more than once; make the schema source unambiguous before comparing it to generated types.'
  );
  return names;
}

function assertTableSurfacesMatch(typeTables, migrationTables) {
  assert.deepStrictEqual(
    typeTables,
    migrationTables,
    `Generated public-table types differ from the monolithic schema.\n` +
      `Types only: ${typeTables.filter((name) => !migrationTables.includes(name)).join(', ') || '(none)'}\n` +
      `Schema only: ${migrationTables.filter((name) => !typeTables.includes(name)).join(', ') || '(none)'}`
  );
}

describe('generated Supabase public table types', () => {
  test('match the monolithic migration', () => {
    assertTableSurfacesMatch(
      publicTableNames(fs.readFileSync(TYPES_PATH, 'utf8'), TYPES_PATH),
      migrationTableNames(fs.readFileSync(MIGRATION_PATH, 'utf8'))
    );
  });

  test('fails closed when a generated type names a table outside the schema', () => {
    assert.throws(
      () =>
        assertTableSurfacesMatch(
          ['real_table', 'phantom_table'],
          ['real_table']
        ),
      /Types only: phantom_table/
    );
  });
});
