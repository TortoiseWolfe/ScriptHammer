import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { resolveClosure } from '../../scripts/lib/edge-function-closure';

/**
 * The two anonymous Edge Functions spend their rate limit atomically, BEFORE the side effect
 * (#1245 stage A3, #1237).
 *
 * They used to call `check_rate_limit` and then `record_failed_attempt` — two round trips, so N
 * concurrent requests all passed the check before any record landed. `create-lead` recorded only
 * AFTER a successful insert, and ignored that call's error. `consume_rate_limit` counts and
 * decides in one statement; this pins that each handler calls it exactly once, before it sends
 * mail or inserts a row, and hands the answer to `limiterVerdict` (which fails closed).
 *
 * WHY AN AST, NOT A REGEX. The handlers' comments name the old pair — they are the history — and
 * a guard that greps source has passed with the code deleted because it matched its own prose.
 * Comments are not tokens, so they can neither satisfy this check nor break it. It walks the
 * DEPLOY CLOSURE, so a limiter moved into `_shared/` is still seen, and it runs its own mutations
 * on every run rather than once by hand.
 */

const FUNCTIONS = join(process.cwd(), 'supabase', 'functions');
const OLD_PAIR = new Set(['check_rate_limit', 'record_failed_attempt']);
const SEND = "fetch('https://api.resend.com";

type Anchor = (call: ts.CallExpression) => boolean;
const str = (n: ts.Node | undefined) =>
  n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
    ? n.text
    : null;

/** The side effect the limiter must come before, per function. */
const LIMITED: Record<string, { effect: string; anchor: Anchor }> = {
  'contact-message': {
    effect: 'the Resend send',
    anchor: (c) =>
      ts.isIdentifier(c.expression) &&
      c.expression.text === 'fetch' &&
      (str(c.arguments[0]) ?? '').startsWith('https://api.resend.com'),
  },
  'create-lead': {
    effect: 'the insert into leads',
    anchor: (c) =>
      ts.isPropertyAccessExpression(c.expression) &&
      c.expression.name.text === 'from' &&
      str(c.arguments[0]) === 'leads',
  },
};

type Files = Record<string, string>; // path relative to supabase/functions -> source

function walk(src: string, path: string, visit: (n: ts.Node) => void) {
  const sf = ts.createSourceFile(
    path,
    src,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const go = (n: ts.Node) => {
    visit(n);
    ts.forEachChild(n, go);
  };
  go(sf);
}

/** Every rule this file enforces, as a list of broken ones. Pure, so mutations can drive it. */
function violations(closureBySlug: Record<string, Files>): string[] {
  const out: string[] = [];
  for (const [slug, { effect, anchor }] of Object.entries(LIMITED)) {
    const files = closureBySlug[slug] ?? {};
    const entry = `${slug}/index.ts`;
    if (!files[entry]) {
      out.push(`${slug}: entry ${entry} missing from the scanned closure`);
      continue;
    }
    const consumes: { path: string; pos: number }[] = [];
    let effectPos = -1;
    let verdictCalls = 0;
    for (const [path, src] of Object.entries(files)) {
      walk(src, path, (n) => {
        const text = str(n);
        if (text !== null && OLD_PAIR.has(text)) {
          out.push(
            `${slug}: ${path} names ${text} — the two-round-trip limiter (#1237)`
          );
        }
        if (!ts.isCallExpression(n)) return;
        if (
          ts.isPropertyAccessExpression(n.expression) &&
          n.expression.name.text === 'rpc' &&
          str(n.arguments[0]) === 'consume_rate_limit'
        ) {
          consumes.push({ path, pos: n.getStart() });
        }
        if (path === entry && anchor(n) && effectPos < 0)
          effectPos = n.getStart();
        if (
          path === entry &&
          ts.isIdentifier(n.expression) &&
          n.expression.text === 'limiterVerdict'
        ) {
          verdictCalls += 1;
        }
      });
    }
    if (consumes.length !== 1) {
      out.push(
        `${slug}: ${consumes.length} consume_rate_limit calls, want exactly 1`
      );
    }
    if (effectPos < 0) {
      out.push(
        `${slug}: could not find ${effect} — the order check would be vacuous`
      );
    }
    const c = consumes[0];
    if (c && c.path !== entry) {
      out.push(
        `${slug}: consume_rate_limit is called from ${c.path}, not the handler`
      );
    } else if (c && effectPos >= 0 && c.pos > effectPos) {
      out.push(`${slug}: consume_rate_limit runs AFTER ${effect}`);
    }
    if (verdictCalls < 1) {
      out.push(
        `${slug}: the answer never reaches limiterVerdict (fail-closed rule)`
      );
    }
  }
  return out;
}

const readDisk = (p: string) => {
  const full = join(FUNCTIONS, p);
  return existsSync(full) ? readFileSync(full, 'utf8') : null;
};

function realClosures(): Record<string, Files> {
  const out: Record<string, Files> = {};
  for (const slug of Object.keys(LIMITED)) {
    const { files, missing } = resolveClosure(readDisk, slug);
    expect([...missing]).toEqual([]);
    out[slug] = Object.fromEntries(
      [...files].map((f) => [f, readDisk(f) as string])
    );
  }
  return out;
}

/** Apply `edit` to one slug's handler, asserting the edit actually changed something. */
function mutate(slug: string, edit: (src: string) => string) {
  const all = realClosures();
  const entry = `${slug}/index.ts`;
  const before = all[slug][entry];
  const after = edit(before);
  expect(after, 'the mutation must apply').not.toBe(before);
  all[slug] = { ...all[slug], [entry]: after };
  return violations(all);
}

const CONSUME = "admin.rpc('consume_rate_limit'";

/**
 * Move the whole consume statement to just after the statement that contains `anchor`, leaving
 * a stand-in so the rest still parses. Syntactically valid; only the ORDER changes.
 */
function moveConsumeAfter(s: string, anchor: string, terminator: string) {
  const i = s.indexOf(`const limit = await ${CONSUME}`);
  expect(i).toBeGreaterThan(-1);
  const stmtEnd = s.indexOf('});', i) + 3;
  const stmt = s.slice(i, stmtEnd);
  const without =
    s.slice(0, i) +
    'const limit = { data: null, error: null };' +
    s.slice(stmtEnd);
  const a = without.indexOf(anchor);
  expect(a).toBeGreaterThan(-1);
  const after = without.indexOf(terminator, a) + terminator.length;
  return without.slice(0, after) + '\n  ' + stmt + without.slice(after);
}

describe('Edge Function rate limiting is atomic and comes first (#1245 A3)', () => {
  it('the real functions obey every rule', () => {
    const closures = realClosures();
    for (const slug of Object.keys(LIMITED)) {
      expect(Object.keys(closures[slug]).length).toBeGreaterThan(0);
    }
    expect(violations(closures)).toEqual([]);
  });

  it('no Edge Function anywhere calls the two-round-trip pair', () => {
    const offenders: string[] = [];
    const scan = (dir: string) => {
      for (const d of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, d.name);
        if (d.isDirectory()) scan(full);
        else if (d.name.endsWith('.ts')) {
          walk(readFileSync(full, 'utf8'), full, (n) => {
            const text = str(n);
            if (text !== null && OLD_PAIR.has(text)) {
              offenders.push(`${relative(FUNCTIONS, full)}: ${text}`);
            }
          });
        }
      }
    };
    scan(FUNCTIONS);
    expect(offenders).toEqual([]);
  });

  describe('each mutation that restores the defect is caught', () => {
    for (const slug of Object.keys(LIMITED)) {
      it(`${slug}: renaming the call back to check_rate_limit`, () => {
        expect(
          mutate(slug, (s) =>
            s.replace(CONSUME, "admin.rpc('check_rate_limit'")
          )
        ).not.toEqual([]);
      });

      it(`${slug}: deleting the call but leaving a comment that names it`, () => {
        const v = mutate(slug, (s) =>
          s.replace(CONSUME, '// consume_rate_limit\n    admin.rpc(String()')
        );
        expect(v.join('\n')).toMatch(/0 consume_rate_limit calls/);
      });

      it(`${slug}: calling it twice, which halves the budget`, () => {
        const v = mutate(slug, (s) =>
          s.replace(CONSUME, `${CONSUME}, {}); void ${CONSUME}`)
        );
        expect(v.join('\n')).toMatch(/2 consume_rate_limit calls/);
      });

      it(`${slug}: naming the old pair through a constant`, () => {
        const v = mutate(
          slug,
          (s) => `const RPC = 'record_failed_attempt';\n${s}`
        );
        expect(v.join('\n')).toMatch(/names record_failed_attempt/);
      });

      it(`${slug}: dropping the fail-closed verdict`, () => {
        const v = mutate(slug, (s) =>
          s.replace(/limiterVerdict\(/g, 'Object(')
        );
        expect(v.join('\n')).toMatch(/never reaches limiterVerdict/);
      });

      it(`${slug}: CONTROL — a comment naming the old pair changes nothing`, () => {
        const v = mutate(
          slug,
          (s) => `// history: check_rate_limit then record_failed_attempt\n${s}`
        );
        expect(v).toEqual([]);
      });
    }

    it('create-lead: moving the limiter after the insert', () => {
      const v = mutate('create-lead', (src) =>
        moveConsumeAfter(src, ".from('leads')", '.single();')
      );
      expect(v.join('\n')).toMatch(/runs AFTER the insert into leads/);
    });

    it('contact-message: moving the limiter after the send', () => {
      const v = mutate('contact-message', (src) =>
        moveConsumeAfter(src, SEND, '});')
      );
      expect(v.join('\n')).toMatch(/runs AFTER the Resend send/);
    });
  });
});
