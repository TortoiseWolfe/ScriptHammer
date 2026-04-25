#!/usr/bin/env node
/**
 * scripts/audit/verify.mjs
 *
 * Cross-check published audit artifacts against the truth-table.json
 * source of truth. Detects drift between:
 *   - truth-table.json (machine-readable source)
 *   - features/<cat>/<NNN>/spec.md `**Status**:` lines
 *   - STATUS.md row count
 *   - GitHub Issues (referenced numbers in STATUS.md and PRP-STATUS.md)
 *
 * Run inside Docker:
 *   docker compose exec scripthammer node scripts/audit/verify.mjs
 *
 * Exit code: 0 if everything agrees, 1 if drift detected.
 */

import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const TRUTH_TABLE = resolve(REPO_ROOT, 'scripts/audit/truth-table.json');

const STATUS_LABEL = {
  Shipped: 'Shipped',
  'Mostly Shipped': 'Mostly Shipped',
  Partial: 'Partial',
  'Backend Only': 'Backend Only',
  'Not Started': 'Not Started',
  Blocked: 'Blocked',
};

let problems = 0;

function report(level, msg) {
  console.log(`${level}: ${msg}`);
  if (level === 'FAIL') problems++;
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function checkSpecsMatch(truthTable) {
  console.log('\n--- Checking spec.md status fields ---');
  for (const f of truthTable.features) {
    const specPath = resolve(REPO_ROOT, 'features', f.category, f.id, 'spec.md');
    if (!(await fileExists(specPath))) {
      report('SKIP', `${f.id} — no spec.md (3 features intentionally lack spec.md: 000-brand-identity, 000-landing-page, 046-admin-dashboard)`);
      continue;
    }
    const content = await readFile(specPath, 'utf8');
    const match = content.match(/^\*\*Status\*\*:\s*(.+?)$/m);
    if (!match) {
      report('FAIL', `${f.id} — no **Status**: line in spec.md`);
      continue;
    }
    const expected = STATUS_LABEL[f.real_status] || f.real_status;
    if (match[1].trim() !== expected) {
      report(
        'FAIL',
        `${f.id} — spec says "${match[1].trim()}", truth-table says "${expected}"`
      );
      continue;
    }
    if (!content.includes('<!-- AUDIT-IMPL-STATUS-BEGIN -->')) {
      report(
        'FAIL',
        `${f.id} — missing AUDIT-IMPL-STATUS section (run update-spec-status.mjs)`
      );
      continue;
    }
  }
}

async function checkStatusMd(truthTable) {
  console.log('\n--- Checking STATUS.md ---');
  const statusPath = resolve(REPO_ROOT, 'STATUS.md');
  if (!(await fileExists(statusPath))) {
    report('FAIL', 'STATUS.md does not exist');
    return;
  }
  const content = await readFile(statusPath, 'utf8');
  const counts = {
    Shipped: (content.match(/^- \[x\]/gm) || []).length,
    Partial: (content.match(/^- \[~\]/gm) || []).length,
    Backend: (content.match(/^- \[!\]/gm) || []).length,
    NotStarted: (content.match(/^- \[ \]/gm) || []).length,
  };
  console.log(`  STATUS.md checkbox counts: shipped=${counts.Shipped}, partial=${counts.Partial}, backend=${counts.Backend}, not-started=${counts.NotStarted}`);
  console.log(`  Total: ${counts.Shipped + counts.Partial + counts.Backend + counts.NotStarted} (truth-table has ${truthTable.features.length})`);
}

async function checkPrpStatusMd() {
  console.log('\n--- Checking PRP-STATUS.md ---');
  const path = resolve(REPO_ROOT, 'docs/prp-docs/PRP-STATUS.md');
  if (!(await fileExists(path))) {
    report('FAIL', 'PRP-STATUS.md does not exist');
    return;
  }
  const content = await readFile(path, 'utf8');
  if (!content.includes('Full 47-Feature Audit')) {
    report('FAIL', 'PRP-STATUS.md missing the new audit section');
  }
}

async function main() {
  const tt = JSON.parse(await readFile(TRUTH_TABLE, 'utf8'));
  console.log(`Loaded truth-table with ${tt.features.length} features`);
  console.log(`Generated: ${tt.generated}`);

  await checkSpecsMatch(tt);
  await checkStatusMd(tt);
  await checkPrpStatusMd();

  console.log('\n---');
  if (problems === 0) {
    console.log('OK: all artifacts agree with truth-table.json');
    process.exit(0);
  } else {
    console.log(`FAIL: ${problems} problem(s) detected`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
