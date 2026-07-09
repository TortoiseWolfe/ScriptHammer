// Privacy gate (#234 / #229 PR-B): client-parcel identifiers must NEVER
// appear in the committed tree. This scans exactly what git tracks — the
// local-only demo data (sites/*, public/twins/* except allowlisted,
// *.local.json, house/) is gitignored and therefore out of scope by
// construction.
//
// The protected strings are assembled from fragments below so THIS committed
// file doesn't contain them either.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SELF = 'tests/unit/no-client-address.test.ts';

// Fragment assembly — do not inline these into literals.
const HOUSE_NUM = ['26', '30'].join('');
const STREET = ['East', 'Main'].join(' ');
const LON_FRAG = ['85.', '2673'].join('');
const LAT_FRAG_A = ['35.', '02117'].join('');
const LAT_FRAG_B = ['35.', '0212'].join('');

const PATTERNS: { name: string; re: RegExp }[] = [
  {
    name: 'house number + street',
    re: new RegExp(
      `${HOUSE_NUM}\\s*,?\\s*(E|${STREET.split(' ')[0]})[.\\s]*${STREET.split(' ')[1]}`,
      'i'
    ),
  },
  { name: 'street name', re: new RegExp(`${STREET}\\s+Street`, 'i') },
  { name: 'parcel longitude', re: new RegExp(LON_FRAG.replace('.', '\\.')) },
  {
    name: 'parcel latitude (7dp)',
    re: new RegExp(LAT_FRAG_A.replace('.', '\\.')),
  },
  {
    name: 'parcel latitude (4dp)',
    re: new RegExp(`${LAT_FRAG_B.replace('.', '\\.')}\\b`),
  },
];

const TEXT_EXT = /\.(ts|tsx|js|mjs|cjs|json|md|yml|yaml|sh|css|html|svg|txt)$/;

describe('committed tree carries no client-parcel identifiers', () => {
  it('scans every git-tracked text file against the denylist', () => {
    const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
      .split('\n')
      .filter(
        (f) =>
          f &&
          TEXT_EXT.test(f) &&
          f !== SELF &&
          f !== 'pnpm-lock.yaml' &&
          // baked artifacts are large coordinate soups; their generators are
          // covered and their inputs (site configs) are scanned above
          !f.startsWith('public/twins/')
      );
    expect(files.length).toBeGreaterThan(100); // the scan actually ran

    const hits: string[] = [];
    for (const f of files) {
      let text: string;
      try {
        text = readFileSync(f, 'utf8');
      } catch {
        continue;
      }
      for (const p of PATTERNS) {
        if (p.re.test(text)) hits.push(`${f}: ${p.name}`);
      }
    }
    expect(hits, 'client-identifying strings found in committed files').toEqual(
      []
    );
  });
});
