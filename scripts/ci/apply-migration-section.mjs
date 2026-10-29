#!/usr/bin/env node
/**
 * Apply ONE section of the monolithic migration to the hosted Supabase project.
 *
 * WHY. The migration file is the only place schema is written down (no second migration
 * files), but nothing ever applied it to production: the Prod Schema Drift check reports,
 * it never changes anything. A new table or function therefore reached production only
 * when someone with the Management API token pasted SQL by hand. The token lives in this
 * repository as the SUPABASE_ACCESS_TOKEN secret, so the lasting route is a workflow
 * (.github/workflows/apply-migration-section.yml) that cuts one section out of the
 * migration and runs just that.
 *
 * WHAT A SECTION IS. A banner of three comment lines:
 *     -- ==========...
 *     -- TITLE (anything after the title is allowed)
 *     -- ==========...
 * The section runs from the first line of its banner to the line before the next banner
 * (or the end of the file). The workflow input is the title; it matches a banner whose
 * title starts with it, and exactly one banner must match.
 *
 * WHAT IT REFUSES. A title that is empty, matches no banner or several, a section with no
 * statements in it (comments only), and a section that carries its own BEGIN or COMMIT
 * (this script supplies the transaction, so the section is applied whole or not at all).
 * Every section should be written to run twice (CREATE ... IF NOT EXISTS, CREATE OR
 * REPLACE, DROP ... IF EXISTS), because the migration file is the record and the
 * workflow can be run again.
 *
 * USAGE
 *   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... \
 *     node scripts/ci/apply-migration-section.mjs "BAND PAGE ANONYMOUS SONG VOTES"
 *   add --print to show the SQL and stop without touching the database.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.supabase.com/v1/projects';
const RULE = /^-- ={20,}\s*$/;
const MIGRATION = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'supabase',
  'migrations',
  '20251006_complete_monolithic_setup.sql'
);

/** Every banner in the file: { start (index of its first rule line), title }. */
export function findBanners(lines) {
  const banners = [];
  for (let i = 0; i + 2 < lines.length; i++) {
    if (RULE.test(lines[i]) && RULE.test(lines[i + 2])) {
      const title = lines[i + 1].replace(/^--\s?/, '').trim();
      if (title && !RULE.test(lines[i + 1])) {
        banners.push({ start: i, title });
        i += 2;
      }
    }
  }
  return banners;
}

/**
 * Cut the section whose banner title starts with `title`. Returns { name, sql, firstLine,
 * lastLine } (1-based line numbers for the log), or throws with the reason it refuses.
 */
export function extractSection(sql, title) {
  const wanted = (title ?? '').trim();
  if (wanted.length < 8) {
    throw new Error(
      'Give the banner title (at least 8 characters), for example "BAND PAGE ANONYMOUS SONG VOTES".'
    );
  }
  const lines = sql.split('\n');
  const banners = findBanners(lines);
  const hits = banners.filter((b) =>
    b.title.toUpperCase().startsWith(wanted.toUpperCase())
  );
  if (hits.length === 0) {
    throw new Error(
      `No banner starts with "${wanted}". Banners in the file: ${banners
        .map((b) => b.title)
        .join(' | ')}`
    );
  }
  if (hits.length > 1) {
    throw new Error(
      `"${wanted}" matches ${hits.length} banners (${hits
        .map((b) => b.title)
        .join(' | ')}); give more of the title.`
    );
  }
  const hit = hits[0];
  const next = banners.find((b) => b.start > hit.start);
  const end = next ? next.start : lines.length;
  const body = lines.slice(hit.start, end).join('\n').replace(/\s+$/, '');

  const statements = body
    .split('\n')
    .filter((l) => l.trim() !== '' && !l.trim().startsWith('--'));
  if (statements.length === 0) {
    throw new Error(`The section "${hit.title}" holds no SQL (comments only).`);
  }
  if (statements.some((l) => /^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/i.test(l))) {
    throw new Error(
      `The section "${hit.title}" contains BEGIN, COMMIT or ROLLBACK; the workflow wraps the section in one transaction itself.`
    );
  }
  return {
    name: hit.title,
    sql: body,
    firstLine: hit.start + 1,
    lastLine: end,
  };
}

/** The statement sent to the database: the section, applied whole or not at all. */
export function wrapInTransaction(sectionSql) {
  return `BEGIN;\n${sectionSql}\nCOMMIT;\n`;
}

async function run(ref, token, sql) {
  const res = await fetch(`${API}/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${text.slice(0, 600)}`);
  }
  return text;
}

async function main() {
  const args = process.argv.slice(2);
  const printOnly = args.includes('--print');
  const title = args.filter((a) => a !== '--print').join(' ');

  const section = extractSection(readFileSync(MIGRATION, 'utf8'), title);
  const statement = wrapInTransaction(section.sql);
  console.log(
    `Section "${section.name}": lines ${section.firstLine}-${section.lastLine} of the migration.\n` +
      `----- SQL to run (inside BEGIN/COMMIT) -----\n${statement}----- end of SQL -----`
  );
  if (printOnly) return;

  const ref = process.env.SUPABASE_PROJECT_REF;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!ref || !token) {
    throw new Error(
      'SUPABASE_PROJECT_REF (repository variable) and SUPABASE_ACCESS_TOKEN (repository secret) are both required.'
    );
  }
  const answer = await run(ref, token, statement);
  console.log(`Applied. Management API answered: ${answer.slice(0, 300)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`::error::[apply-migration-section] ${err.message}`);
    process.exit(1);
  });
}
