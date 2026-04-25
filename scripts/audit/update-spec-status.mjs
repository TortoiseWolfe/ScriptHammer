#!/usr/bin/env node
/**
 * scripts/audit/update-spec-status.mjs
 *
 * Idempotently rewrites the `**Status**:` line and inserts a
 * `## Implementation Status` section into every features/<cat>/<NNN>/spec.md
 * based on scripts/audit/truth-table.json.
 *
 * Run inside Docker:
 *   docker compose exec scripthammer node scripts/audit/update-spec-status.mjs
 *
 * Re-running is safe — section is replaced, not appended.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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

const SECTION_MARKER_BEGIN = '<!-- AUDIT-IMPL-STATUS-BEGIN -->';
const SECTION_MARKER_END = '<!-- AUDIT-IMPL-STATUS-END -->';

function categoryDir(category) {
  // Categories are the parent dir name in features/
  return category;
}

function findSpecPath(feature) {
  const dir = resolve(REPO_ROOT, 'features', categoryDir(feature.category), feature.id);
  const spec = resolve(dir, 'spec.md');
  return existsSync(spec) ? spec : null;
}

function buildStatusLine(realStatus) {
  return `**Status**: ${STATUS_LABEL[realStatus] || realStatus}`;
}

function buildImplStatusSection(feature) {
  const lines = [
    SECTION_MARKER_BEGIN,
    '',
    '## Implementation Status',
    '',
    `**Last audited**: 2026-04-25`,
    `**Real status**: ${STATUS_LABEL[feature.real_status] || feature.real_status}`,
    `**Tracking**: ${feature.gaps.length === 0 ? 'n/a — shipped' : 'see gap-audit GitHub issues + STATUS.md'}`,
    '',
  ];

  if (feature.code_evidence?.length) {
    lines.push('### Shipped');
    for (const item of feature.code_evidence) lines.push(`- ${item}`);
    lines.push('');
  }

  if (feature.gaps?.length) {
    lines.push('### Gaps');
    for (const g of feature.gaps) lines.push(`- ${g}`);
    lines.push('');
  }

  if (feature.stability_hotspot) {
    lines.push('### Stability notes');
    lines.push(`- ${feature.stability_hotspot}`);
    lines.push('');
  }

  if (feature.notes) {
    lines.push('### Notes');
    lines.push(`- ${feature.notes}`);
    lines.push('');
  }

  lines.push(SECTION_MARKER_END);
  return lines.join('\n');
}

function patchSpec(content, feature) {
  // 1. Replace the **Status**: line
  const statusLineRegex = /^\*\*Status\*\*:.*$/m;
  let next = content.replace(statusLineRegex, buildStatusLine(feature.real_status));

  // 2. Insert or replace the Implementation Status section
  const newSection = buildImplStatusSection(feature);

  const sectionRegex = new RegExp(
    `${SECTION_MARKER_BEGIN}[\\s\\S]*?${SECTION_MARKER_END}`,
    'm'
  );

  if (sectionRegex.test(next)) {
    // Replace existing audit section
    next = next.replace(sectionRegex, newSection);
  } else {
    // Insert before the first ## heading (after the metadata block)
    // The first ## marks the start of authored content
    const firstHeadingRegex = /^## /m;
    const idx = next.search(firstHeadingRegex);
    if (idx === -1) {
      // No existing ## heading — append at the end
      next = `${next.trimEnd()}\n\n${newSection}\n`;
    } else {
      next = `${next.slice(0, idx)}${newSection}\n\n${next.slice(idx)}`;
    }
  }

  return next;
}

async function main() {
  const truthTableRaw = await readFile(TRUTH_TABLE, 'utf8');
  const truthTable = JSON.parse(truthTableRaw);

  let patched = 0;
  let skipped = 0;
  let unchanged = 0;

  for (const feature of truthTable.features) {
    const path = findSpecPath(feature);
    if (!path) {
      console.log(`SKIP ${feature.id} — no spec.md`);
      skipped++;
      continue;
    }
    const before = await readFile(path, 'utf8');
    const after = patchSpec(before, feature);
    if (before === after) {
      unchanged++;
      continue;
    }
    await writeFile(path, after, 'utf8');
    patched++;
    console.log(`OK   ${feature.id} → ${STATUS_LABEL[feature.real_status]}`);
  }

  console.log('---');
  console.log(`Patched:   ${patched}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Skipped:   ${skipped} (no spec.md)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
