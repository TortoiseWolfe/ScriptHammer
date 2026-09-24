/**
 * One browser auth client, so the #1255 settings cannot be bypassed.
 *
 * Login CSRF is closed by two options on the client in `src/lib/supabase/client.ts`:
 * `flowType: 'pkce'` and a `detectSessionInUrl` that is only true on the two landing pages.
 * Any other client built in `src/` would start with supabase-js's defaults — which read a
 * session out of the URL on every page — and reopen the hole while every test here stayed green.
 *
 * Read through the TypeScript AST, not a regex, so a comment that mentions an option cannot
 * satisfy or trip the guard. The mutations at the bottom prove it can fail.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..', '..');

/** Files allowed to build a Supabase client, and why. */
const ALLOWED: Record<string, string> = {
  'src/lib/supabase/client.ts':
    'the browser client — the one this guard protects',
  'src/lib/supabase/server.ts':
    "@supabase/ssr's server client: it needs a server, which the static export never has, and it reads no URL",
};

const AUTH_OPTIONS = new Set(['detectSessionInUrl', 'flowType']);
const CLIENT_FACTORIES: Record<string, Set<string>> = {
  '@supabase/supabase-js': new Set(['createClient']),
  '@supabase/ssr': new Set(['createBrowserClient', 'createServerClient']),
};
/** Constructed directly rather than through a factory. Importing one as a type is fine. */
const CLIENT_CLASSES = new Set([
  'SupabaseClient',
  'GoTrueClient',
  'AuthClient',
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) &&
      !/\.(test|stories|accessibility\.test)\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

/** Every place a file builds a client or sets one of the two options, as `file:line what`. */
export function clientSites(fileName: string, text: string): string[] {
  const source = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const sites: string[] = [];
  const at = (node: ts.Node, what: string) =>
    sites.push(
      `${fileName}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${what}`
    );

  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.importClause?.isTypeOnly
    ) {
      const factories = CLIENT_FACTORIES[node.moduleSpecifier.text];
      const named = node.importClause?.namedBindings;
      if (factories && named && ts.isNamedImports(named)) {
        for (const spec of named.elements) {
          const imported = (spec.propertyName ?? spec.name).text;
          if (!spec.isTypeOnly && factories.has(imported)) {
            at(spec, `imports ${imported} from ${node.moduleSpecifier.text}`);
          }
        }
      }
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      CLIENT_CLASSES.has(node.expression.text)
    ) {
      at(node, `constructs ${node.expression.text}`);
    }
    if (
      (ts.isPropertyAssignment(node) ||
        ts.isShorthandPropertyAssignment(node)) &&
      ts.isIdentifier(node.name) &&
      AUTH_OPTIONS.has(node.name.text)
    ) {
      at(node, `sets ${node.name.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return sites;
}

describe('one browser auth client (#1255)', () => {
  it('builds a client and sets its URL-session options only where allowed', () => {
    const files = sourceFiles(join(ROOT, 'src'));
    // The walk actually ran: an empty list would pass the assertion below.
    expect(files.length).toBeGreaterThan(200);

    const outside = files.flatMap((path) => {
      const rel = relative(ROOT, path);
      return rel in ALLOWED ? [] : clientSites(rel, readFileSync(path, 'utf8'));
    });
    expect(outside).toEqual([]);
  });

  it('control: the browser client is found where it is built', () => {
    const sites = clientSites(
      'src/lib/supabase/client.ts',
      readFileSync(join(ROOT, 'src/lib/supabase/client.ts'), 'utf8')
    );
    expect(sites.some((s) => s.includes('imports createClient'))).toBe(true);
    expect(sites.some((s) => s.includes('sets flowType'))).toBe(true);
    expect(sites.some((s) => s.includes('sets detectSessionInUrl'))).toBe(true);
  });

  describe('mutations: each shape of a second client is caught', () => {
    it.each([
      [
        "import { createClient } from '@supabase/supabase-js';\nexport const c = createClient('u', 'k');",
        'imports createClient',
      ],
      [
        "import { createClient as make } from '@supabase/supabase-js';",
        'imports createClient',
      ],
      [
        "import { createBrowserClient } from '@supabase/ssr';",
        'imports createBrowserClient',
      ],
      [
        "import { GoTrueClient } from '@supabase/auth-js';\nexport const a = new GoTrueClient({});",
        'constructs GoTrueClient',
      ],
      [
        "import { SupabaseClient } from '@supabase/supabase-js';\nexport const c = new SupabaseClient('u', 'k');",
        'constructs SupabaseClient',
      ],
      [
        'export const o = { auth: { detectSessionInUrl: true } };',
        'sets detectSessionInUrl',
      ],
      [
        "const flowType = 'implicit';\nexport const o = { flowType };",
        'sets flowType',
      ],
    ])('%s', (text, expected) => {
      expect(clientSites('src/x.ts', text).join('\n')).toContain(expected);
    });

    it.each([
      "import type { SupabaseClient } from '@supabase/supabase-js';",
      "import { type User } from '@supabase/supabase-js';",
      "import { SupabaseClient } from '@supabase/supabase-js';\nexport function f(c: SupabaseClient) { return c; }",
      '// detectSessionInUrl: true in a comment is not a client',
      "const note = 'flowType: implicit';",
    ])('ignores %s', (text) => {
      expect(clientSites('src/x.ts', text)).toEqual([]);
    });
  });
});
