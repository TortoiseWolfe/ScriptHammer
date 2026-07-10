// #259 iteration 4 — the slug is the JOIN KEY between the raw cache
// (sites/_warehouse/raw/<slug>.glb), the served GLB
// (public/twins/<site>/models/<slug>.glb) and models.json. Fetch and emit
// both call the ONE shared assignSlugs (src/lib/placement.ts via ./lib);
// these tests guard its semantics, and — when the local inventory exists —
// its agreement with the committed artifact.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { assignSlugs, slugify } from '../lib';

describe('slugify', () => {
  it('lowercases, strips quotes, collapses non-alphanumerics', () => {
    expect(slugify('Miller Park\'s "Pavilion" — Phase 2')).toBe(
      'miller-parks-pavilion-phase-2'
    );
  });

  it('trims edge dashes and caps length at 48', () => {
    expect(slugify('---Hello---')).toBe('hello');
    expect(slugify('x'.repeat(80)).length).toBe(48);
  });
});

describe('assignSlugs', () => {
  const lookup = new Map([
    ['aaaa1111-0000', { title: 'Hunter Museum' }],
    ['bbbb2222-0000', { title: 'Building in Chattanooga, TN, USA' }],
    ['cccc3333-0000', { title: 'Building in Chattanooga, TN, USA' }],
    ['dddd4444-0000', { title: 'Walnut Street Bridge' }],
  ]);
  const ids = [...lookup.keys()];

  it('gives unique titles their plain slug', () => {
    const slugs = assignSlugs(ids, lookup);
    expect(slugs.get('aaaa1111-0000')).toBe('hunter-museum');
    expect(slugs.get('dddd4444-0000')).toBe('walnut-street-bridge');
  });

  it('id-suffixes ONLY on title collision', () => {
    const slugs = assignSlugs(ids, lookup);
    expect(slugs.get('bbbb2222-0000')).toBe(
      'building-in-chattanooga-tn-usa-bbbb2222'
    );
    expect(slugs.get('cccc3333-0000')).toBe(
      'building-in-chattanooga-tn-usa-cccc3333'
    );
  });

  it('never emits duplicate slugs', () => {
    const slugs = assignSlugs(ids, lookup);
    expect(new Set(slugs.values()).size).toBe(slugs.size);
  });

  it('skips ids missing from the lookup instead of throwing', () => {
    const slugs = assignSlugs(['nope', ...ids], lookup);
    expect(slugs.has('nope')).toBe(false);
    expect(slugs.size).toBe(ids.length);
  });

  it('is stable when unrelated ids are added or removed', () => {
    const fewer = assignSlugs(
      ['aaaa1111-0000', 'bbbb2222-0000', 'cccc3333-0000'],
      lookup
    );
    // dddd removed: every survivor keeps its slug (no collision set changed).
    expect(fewer.get('aaaa1111-0000')).toBe('hunter-museum');
    expect(fewer.get('bbbb2222-0000')).toBe(
      'building-in-chattanooga-tn-usa-bbbb2222'
    );
  });
});

// Real-data agreement: run assignSlugs over the committed curation list with
// the local inventory and require exact agreement with the committed
// models.json. Any drift here means the raw cache and the served city no
// longer join. Inventory lives in gitignored sites/_warehouse/ — skip (CI,
// fresh clones) when absent.
const invPath = path.resolve('sites/_warehouse/inventory.json');
const modelsPath = path.resolve('public/twins/chatt/models/models.json');
const haveRealData = existsSync(invPath) && existsSync(modelsPath);

describe.skipIf(!haveRealData)(
  'assignSlugs ↔ committed chatt artifact',
  () => {
    it('reproduces every published slug from the curation list', () => {
      const inventory = JSON.parse(readFileSync(invPath, 'utf8'));
      const curated: { neighborhoods: { ids: string[] }[] } = JSON.parse(
        readFileSync(
          path.resolve('scripts/warehouse/curated-chatt.json'),
          'utf8'
        )
      );
      const models: { models: { slug: string; warehouseId: string }[] } =
        JSON.parse(readFileSync(modelsPath, 'utf8'));
      const byId = new Map<string, { title: string }>(
        inventory.models.map((m: { id: string; title: string }) => [m.id, m])
      );
      const ids = curated.neighborhoods.flatMap((n) => n.ids);
      const slugs = assignSlugs(ids, byId);
      expect(new Set(slugs.values()).size).toBe(slugs.size); // zero collisions
      for (const m of models.models) {
        expect(slugs.get(m.warehouseId)).toBe(m.slug);
      }
    });
  }
);
