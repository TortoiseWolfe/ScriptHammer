import { describe, it, expect } from 'vitest';
import {
  applyOverrides,
  assignSlugs,
  slugify,
  type PlacedEntry,
  type PlacementOverride,
} from './placement';

/**
 * `src/lib/placement.ts` had no co-located test (#885).
 *
 * The module is the single implementation behind three consumers, and the slug
 * it produces is the JOIN KEY between the raw Warehouse cache, the served GLB
 * and models.json. Two properties therefore matter more than any individual
 * example:
 *
 *   1. slugify's OUTPUT ALPHABET and its 48-character cap — because the slug
 *      becomes a filename.
 *   2. assignSlugs' collision rule — the id suffix is applied ONLY on
 *      collision, so any change to when it fires silently renames files and
 *      breaks the join for every unchanged building.
 *
 * `scripts/warehouse/__tests__/slugs.test.ts` covers the pipeline's real-data
 * agreement (and its happy path) via `scripts/warehouse/lib`. These tests go at
 * the other end: the edges, the unicode, and `applyOverrides`, which had no
 * coverage at all.
 *
 * Several assertions below pin behaviour that is arguably wrong. They are
 * marked SURPRISE and assert what the code actually does today; none of them
 * were "fixed" here.
 */

// applyOverrides returns T | null. Unwrap where the test has already asserted
// the entry is not excluded, so the assertions below can read exact values.
function apply<T extends PlacedEntry>(
  entry: T,
  ov: PlacementOverride | undefined
): T {
  const out = applyOverrides(entry, ov);
  if (out === null) {
    throw new Error('applyOverrides excluded an entry the test did not expect');
  }
  return out;
}

describe('slugify', () => {
  it('lowercases and joins words with single dashes', () => {
    expect(slugify('Hunter Museum of American Art')).toBe(
      'hunter-museum-of-american-art'
    );
    expect(slugify('Walnut Street Bridge')).toBe('walnut-street-bridge');
  });

  it('keeps digits', () => {
    expect(slugify('Building 42, Phase 2')).toBe('building-42-phase-2');
  });

  it('deletes the three quote characters rather than dashing them', () => {
    // Deletion (not substitution) is what keeps "Miller's" from becoming
    // "miller-s". Straight and curly apostrophes must agree, because curation
    // titles arrive with either.
    expect(slugify("Miller's Park")).toBe('millers-park');
    expect(slugify('Miller’s Park')).toBe('millers-park');
    expect(slugify('O\'Brien "The" Building’s')).toBe('obrien-the-buildings');
  });

  it('SURPRISE: the OPENING curly quote is not in the strip set, so it dashes', () => {
    // The class is /["'’]/ — U+2019 only. U+2018 falls through to the
    // separator rule, so a title quoted with a matched pair is treated
    // asymmetrically.
    expect(slugify('a‘b')).toBe('a-b');
    expect(slugify('a’b')).toBe('ab');
  });

  it('collapses any run of non-alphanumerics into one dash', () => {
    expect(slugify('A   ---   B')).toBe('a-b');
    expect(slugify('St. Elmo')).toBe('st-elmo');
    expect(slugify('snake_case')).toBe('snake-case');
    expect(slugify('a/b\\c')).toBe('a-b-c');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('---Hello---')).toBe('hello');
    expect(slugify('  spaced  ')).toBe('spaced');
    expect(slugify('!!!Bang!!!')).toBe('bang');
  });

  it('returns an empty string when nothing survives', () => {
    // An empty slug is a legal return value, and it becomes an empty join key
    // — worth knowing rather than assuming it cannot happen.
    expect(slugify('')).toBe('');
    expect(slugify('   ')).toBe('');
    expect(slugify('!!!')).toBe('');
    expect(slugify('"\'’')).toBe('');
  });

  it('caps the slug at 48 characters', () => {
    expect(slugify('x'.repeat(80))).toBe('x'.repeat(48));
    expect(slugify('x'.repeat(48))).toBe('x'.repeat(48));
    expect(slugify('x'.repeat(47))).toBe('x'.repeat(47));
  });

  it('SURPRISE: the cap is applied AFTER trimming, so it can leave a trailing dash', () => {
    // .slice(0, 48) is the last operation, so truncation can re-introduce
    // exactly the edge dash the previous step removed. That makes slugify
    // non-idempotent for inputs that hit the cap on a separator.
    const truncated = slugify('a'.repeat(47) + ' b');
    expect(truncated).toBe('a'.repeat(47) + '-');
    expect(slugify(truncated)).toBe('a'.repeat(47));
  });

  it('is otherwise idempotent — a slug fed back in is unchanged', () => {
    for (const input of [
      'Hunter Museum',
      "Miller's Park — Phase 2",
      'Building in Chattanooga, TN, USA',
      '---Hello---',
      '',
    ]) {
      const once = slugify(input);
      expect(slugify(once)).toBe(once);
    }
  });

  it('SURPRISE: does NOT normalize accents — they become separators', () => {
    // The doc comment says this alphabet is deliberately distinct from the
    // bake's geocode slugify, which NFKD-normalizes. The cost is that "Café"
    // loses its final letter entirely rather than becoming "cafe".
    expect(slugify('Café Müller')).toBe('caf-m-ller');
    expect(slugify('Straße')).toBe('stra-e');
    expect(slugify('École')).toBe('cole');
  });

  it('SURPRISE: dotted capital I lowercases to i + a combining dot, which splits the word', () => {
    // 'İ'.toLowerCase() is U+0069 U+0307; the combining mark is not [a-z0-9].
    expect(slugify('İstanbul')).toBe('i-stanbul');
  });

  it('drops non-Latin scripts entirely', () => {
    expect(slugify('日本語')).toBe('');
    expect(slugify('Москва')).toBe('');
    expect(slugify('Tokyo 東京 Tower')).toBe('tokyo-tower');
  });

  it('strips emoji and other astral characters', () => {
    expect(slugify('🏠 House')).toBe('house');
    expect(slugify('A 🏠 B')).toBe('a-b');
  });

  it('only ever emits [a-z0-9-] and never exceeds 48 characters', () => {
    // The filename invariant, asserted over the nastiest inputs above at once.
    for (const input of [
      '',
      '   ',
      '🏠🏠🏠',
      'Café Müller',
      'İstanbul',
      'A'.repeat(200),
      'a b '.repeat(40),
      '日本語',
      '<script>alert(1)</script>',
      'Building in Chattanooga, TN, USA',
    ]) {
      const out = slugify(input);
      expect(out).toMatch(/^[a-z0-9-]*$/);
      expect(out.length).toBeLessThanOrEqual(48);
    }
  });
});

describe('assignSlugs', () => {
  const lookup = new Map([
    ['1111aaaa-0000', { title: 'Hunter Museum' }],
    ['2222bbbb-0000', { title: 'Building in Chattanooga, TN, USA' }],
    ['3333cccc-0000', { title: 'Building in Chattanooga, TN, USA' }],
    ['4444dddd-0000', { title: 'Walnut Street Bridge' }],
  ]);
  const ids = [...lookup.keys()];

  it('gives an unshared title its plain slug and a shared one the id suffix', () => {
    // Whole-map equality: this pins BOTH branches of the collision rule at
    // once, so widening or narrowing it fails here.
    expect(Object.fromEntries(assignSlugs(ids, lookup))).toEqual({
      '1111aaaa-0000': 'hunter-museum',
      '2222bbbb-0000': 'building-in-chattanooga-tn-usa-2222bbbb',
      '3333cccc-0000': 'building-in-chattanooga-tn-usa-3333cccc',
      '4444dddd-0000': 'walnut-street-bridge',
    });
  });

  it('suffixes with the first 8 characters of the id', () => {
    const slugs = assignSlugs(ids, lookup);
    expect(slugs.get('2222bbbb-0000')?.endsWith('-2222bbbb')).toBe(true);
    expect(slugs.get('2222bbbb-0000')).not.toContain('2222bbbb-0000');
  });

  it('uses a short id whole when it is under 8 characters', () => {
    const short = new Map([
      ['a1', { title: 'Shed' }],
      ['a2', { title: 'Shed' }],
    ]);
    expect(Object.fromEntries(assignSlugs([...short.keys()], short))).toEqual({
      a1: 'shed-a1',
      a2: 'shed-a2',
    });
  });

  it('collides on the SLUG, not on the raw title', () => {
    // Two different titles that punctuate down to the same slug must both be
    // suffixed, or one would silently overwrite the other's GLB.
    const punct = new Map([
      ['aaaa1111-0000', { title: 'Hunter Museum' }],
      ['bbbb2222-0000', { title: 'HUNTER  museum!!' }],
    ]);
    expect(Object.fromEntries(assignSlugs([...punct.keys()], punct))).toEqual({
      'aaaa1111-0000': 'hunter-museum-aaaa1111',
      'bbbb2222-0000': 'hunter-museum-bbbb2222',
    });
  });

  it('suffixes every member of a three-way collision', () => {
    const trio = new Map([
      ['aaaa1111-0000', { title: 'Shed' }],
      ['bbbb2222-0000', { title: 'Shed' }],
      ['cccc3333-0000', { title: 'Shed' }],
    ]);
    const slugs = assignSlugs([...trio.keys()], trio);
    expect([...slugs.values()]).toEqual([
      'shed-aaaa1111',
      'shed-bbbb2222',
      'shed-cccc3333',
    ]);
  });

  it('emits no duplicate slugs for the ordinary case', () => {
    const slugs = assignSlugs(ids, lookup);
    expect(new Set(slugs.values()).size).toBe(slugs.size);
    expect(slugs.size).toBe(4);
  });

  it('skips ids missing from the lookup instead of throwing', () => {
    const slugs = assignSlugs(['no-such-id', ...ids, 'also-missing'], lookup);
    expect(slugs.has('no-such-id')).toBe(false);
    expect(slugs.has('also-missing')).toBe(false);
    expect(slugs.size).toBe(4);
    // A missing id must not count toward anyone else's collision total.
    expect(slugs.get('1111aaaa-0000')).toBe('hunter-museum');
  });

  it('returns an empty map for empty input or an empty lookup', () => {
    expect(assignSlugs([], lookup).size).toBe(0);
    expect(assignSlugs(ids, new Map()).size).toBe(0);
  });

  it('preserves the order of the ids it was given', () => {
    const slugs = assignSlugs(['4444dddd-0000', '1111aaaa-0000'], lookup);
    expect([...slugs.keys()]).toEqual(['4444dddd-0000', '1111aaaa-0000']);
  });

  it('assigns the same slug regardless of the order of the ids', () => {
    const forward = assignSlugs(ids, lookup);
    const reversed = assignSlugs([...ids].reverse(), lookup);
    for (const id of ids) {
      expect(reversed.get(id)).toBe(forward.get(id));
    }
  });

  it('is stable when an unrelated id is removed', () => {
    // Curation edits must not rename files that did not change.
    const full = assignSlugs(ids, lookup);
    const fewer = assignSlugs(
      ids.filter((id) => id !== '4444dddd-0000'),
      lookup
    );
    for (const id of fewer.keys()) {
      expect(fewer.get(id)).toBe(full.get(id));
    }
  });

  it('SURPRISE: a duplicated id counts twice and suffixes a building with no twin', () => {
    // counts is incremented per ids ENTRY, not per distinct id, so a curation
    // list that names the same building twice renames it.
    const solo = assignSlugs(['1111aaaa-0000', '1111aaaa-0000'], lookup);
    expect(solo.size).toBe(1);
    expect(solo.get('1111aaaa-0000')).toBe('hunter-museum-1111aaaa');
  });

  it('SURPRISE: colliding ids that share a prefix produce IDENTICAL slugs', () => {
    // The suffix is only 8 characters, so two same-titled buildings whose ids
    // agree on that prefix still collide — the guard test over the real
    // curation list is what rules this out in practice, not the algorithm.
    const prefixed = new Map([
      ['aaaaaaaa-1111', { title: 'Shed' }],
      ['aaaaaaaa-2222', { title: 'Shed' }],
    ]);
    const slugs = assignSlugs([...prefixed.keys()], prefixed);
    expect(slugs.get('aaaaaaaa-1111')).toBe('shed-aaaaaaaa');
    expect(slugs.get('aaaaaaaa-2222')).toBe('shed-aaaaaaaa');
    expect(new Set(slugs.values()).size).toBe(1); // duplicate join keys
  });

  it('SURPRISE: a title with no Latin characters yields an empty slug', () => {
    const cjk = new Map([['aaaa1111-0000', { title: '日本語' }]]);
    expect(assignSlugs(['aaaa1111-0000'], cjk).get('aaaa1111-0000')).toBe('');
  });

  it('SURPRISE: two empty-slug titles collide into leading-dash slugs', () => {
    const cjk = new Map([
      ['aaaa1111-0000', { title: '日本語' }],
      ['bbbb2222-0000', { title: '한국어' }],
    ]);
    const slugs = assignSlugs([...cjk.keys()], cjk);
    expect(slugs.get('aaaa1111-0000')).toBe('-aaaa1111');
    expect(slugs.get('bbbb2222-0000')).toBe('-bbbb2222');
  });

  it('never emits a slug outside the filename alphabet', () => {
    const messy = new Map([
      ['aaaa1111-0000', { title: 'Café Müller' }],
      ['bbbb2222-0000', { title: "St. Elmo's 🏠" }],
      ['cccc3333-0000', { title: 'Shed' }],
      ['dddd4444-0000', { title: 'Shed' }],
    ]);
    for (const slug of assignSlugs([...messy.keys()], messy).values()) {
      expect(slug).toMatch(/^[a-z0-9-]*$/);
    }
  });
});

describe('applyOverrides', () => {
  const entry: PlacedEntry = {
    slug: 'hunter-museum',
    x: 10,
    z: -20,
    yawDeg: 90,
    scale: 1,
    yOffset: 0,
  };

  it('returns the entry itself, not a copy, when there is no override', () => {
    // Identity matters: the runtime layer relies on unchanged entries being
    // referentially stable so React does not re-render every building.
    expect(applyOverrides(entry, undefined)).toBe(entry);
  });

  it('returns null when the override excludes the model', () => {
    expect(applyOverrides(entry, { exclude: true })).toBeNull();
  });

  it('keeps the model when exclude is explicitly false', () => {
    const out = apply(entry, { exclude: false, yawDeg: 45 });
    expect(out.yawDeg).toBe(45);
  });

  it('copies rather than mutates when the override is empty', () => {
    const out = apply(entry, {});
    expect(out).toEqual(entry);
    expect(out).not.toBe(entry);
  });

  it('adds dx/dz to the anchor rather than replacing it', () => {
    const out = apply({ ...entry, x: 10, z: -20 }, { dx: 2.5, dz: -0.5 });
    expect(out.x).toBe(12.5);
    expect(out.z).toBe(-20.5);
  });

  it('rounds the nudged anchor to 2 decimals, killing float drift', () => {
    // 0.1 + 0.2 is 0.30000000000000004 unrounded; the emit stage and the live
    // preview must be bit-identical, which is what the toFixed(2) buys.
    const out = apply({ ...entry, x: 0.1, z: 0.1 }, { dx: 0.2, dz: 0.2 });
    expect(out.x).toBe(0.3);
    expect(out.z).toBe(0.3);
    const far = apply({ ...entry, x: 1.23456, z: 9.87654 }, { dx: 1, dz: 1 });
    expect(far.x).toBe(2.23);
    expect(far.z).toBe(10.88);
  });

  it('rounds even when the nudge is zero, and leaves the anchor raw when there is none', () => {
    // The rounding lives inside the `dx !== undefined` branch, so a zero nudge
    // is NOT a no-op: it rounds. An absent nudge leaves full precision.
    expect(apply({ ...entry, x: 1.23456, z: 7.89123 }, { dx: 0 }).x).toBe(1.23);
    expect(apply({ ...entry, x: 1.23456, z: 7.89123 }, { dx: 0 }).z).toBe(
      7.89123
    );
    expect(apply({ ...entry, x: 1.23456, z: 7.89123 }, { dz: 0 }).x).toBe(
      1.23456
    );
    expect(apply({ ...entry, x: 1.23456, z: 7.89123 }, { dz: 0 }).z).toBe(7.89);
  });

  it('SURPRISE: rounding a small negative anchor produces -0', () => {
    // Number('-0.00') is -0, which is !== 0 under Object.is and survives into
    // the emitted JSON as "-0".
    const out = apply({ ...entry, x: -0.001 }, { dx: 0 });
    expect(Object.is(out.x, -0)).toBe(true);
  });

  it('replaces yaw, scale and yOffset outright', () => {
    const out = apply(entry, { yawDeg: 180, scale: 2.5, yOffset: 1.5 });
    expect(out.yawDeg).toBe(180);
    expect(out.scale).toBe(2.5); // replaced, not multiplied by the entry's 1
    expect(out.yOffset).toBe(1.5);
  });

  it('applies a zero yaw/scale/yOffset, which a truthiness check would drop', () => {
    const out = apply(
      { ...entry, yawDeg: 90, scale: 3, yOffset: 5 },
      {
        yawDeg: 0,
        scale: 0,
        yOffset: 0,
      }
    );
    expect(out.yawDeg).toBe(0);
    expect(out.scale).toBe(0);
    expect(out.yOffset).toBe(0);
  });

  it('does not round yOffset — only the x/z anchor', () => {
    expect(apply(entry, { yOffset: 0.123456 }).yOffset).toBe(0.123456);
  });

  it('treats an explicitly undefined field as absent', () => {
    const out = apply(entry, {
      yawDeg: undefined,
      scale: undefined,
      yOffset: undefined,
      dx: undefined,
      dz: undefined,
    });
    expect(out).toEqual(entry);
  });

  it('leaves the input entry untouched', () => {
    const original = { ...entry };
    applyOverrides(entry, { dx: 5, dz: 5, yawDeg: 270, scale: 4, yOffset: 9 });
    expect(entry).toEqual(original);
  });

  it('carries extra fields through untouched', () => {
    // The generic bound is structural on purpose so WarehouseModelEntry rides
    // through with its Warehouse id, url and bounds intact.
    interface WarehouseEntry extends PlacedEntry {
      warehouseId: string;
      glb: string;
      tags: string[];
    }
    const rich: WarehouseEntry = {
      slug: 'shed',
      x: 1,
      z: 2,
      warehouseId: 'aaaa1111-0000',
      glb: 'models/shed.glb',
      tags: ['warehouse'],
    };
    const out = apply(rich, { dx: 0.5 });
    expect(out).toEqual({
      slug: 'shed',
      x: 1.5,
      z: 2,
      warehouseId: 'aaaa1111-0000',
      glb: 'models/shed.glb',
      tags: ['warehouse'],
    });
    expect(out.tags).toBe(rich.tags); // shallow copy, shared references
  });

  it('applies every field of a full override at once', () => {
    expect(
      apply(entry, {
        dx: -0.05,
        dz: 0.05,
        yawDeg: 45,
        scale: 1.25,
        yOffset: -2,
      })
    ).toEqual({
      slug: 'hunter-museum',
      x: 9.95,
      z: -19.95,
      yawDeg: 45,
      scale: 1.25,
      yOffset: -2,
    });
  });

  it('drops the model even when the override also carries placement fields', () => {
    // exclude is checked before anything is applied.
    expect(
      applyOverrides(entry, { exclude: true, dx: 5, yawDeg: 45 })
    ).toBeNull();
  });
});
