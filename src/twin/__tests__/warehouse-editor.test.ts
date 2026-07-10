// #259 iteration 4 — the Edit mode's override reducer semantics, extracted
// pure in useWarehouseEditor.ts. These are the state transitions behind
// every editor gesture (button, hotkey, gizmo): merge-patch per slug, reset
// removes the key entirely, exclude survives round-trips.

import { describe, it, expect } from 'vitest';
import {
  flyToFrame,
  parseStoredOverrides,
  patchOverrides,
  resetOverride,
} from '../useWarehouseEditor';
import { applyOverrides } from '@/lib/placement';

describe('patchOverrides', () => {
  it('creates the slug entry on first patch', () => {
    const next = patchOverrides({}, 'hunter-museum', { yawDeg: 15 });
    expect(next).toEqual({ 'hunter-museum': { yawDeg: 15 } });
  });

  it('merges later patches field-by-field', () => {
    const a = patchOverrides({}, 'hunter-museum', { yawDeg: 15 });
    const b = patchOverrides(a, 'hunter-museum', { dx: 2.5 });
    expect(b['hunter-museum']).toEqual({ yawDeg: 15, dx: 2.5 });
  });

  it('overwrites the same field on re-patch', () => {
    const a = patchOverrides({}, 'hunter-museum', { yawDeg: 15 });
    const b = patchOverrides(a, 'hunter-museum', { yawDeg: -30 });
    expect(b['hunter-museum']).toEqual({ yawDeg: -30 });
  });

  it('leaves other slugs untouched and never mutates the input', () => {
    const prev = { 'walnut-street-bridge': { dz: -1 } };
    const next = patchOverrides(prev, 'hunter-museum', { exclude: true });
    expect(next['walnut-street-bridge']).toEqual({ dz: -1 });
    expect(prev).toEqual({ 'walnut-street-bridge': { dz: -1 } });
    expect(next).not.toBe(prev);
  });
});

describe('resetOverride', () => {
  it('removes the slug key entirely (not an empty object)', () => {
    const prev = { 'hunter-museum': { yawDeg: 15 }, other: { dx: 1 } };
    const next = resetOverride(prev, 'hunter-museum');
    expect('hunter-museum' in next).toBe(false);
    expect(next.other).toEqual({ dx: 1 });
    expect(prev['hunter-museum']).toEqual({ yawDeg: 15 }); // no mutation
  });

  it('is a no-op on unknown slugs', () => {
    expect(resetOverride({}, 'ghost')).toEqual({});
  });
});

describe('reducer output → applyOverrides round-trip', () => {
  it('an edit session composes into the same placement the emit stage produces', () => {
    // Simulate a session: rotate, nudge twice, tweak height.
    let ov = patchOverrides({}, 'hunter-museum', { yawDeg: 15 });
    ov = patchOverrides(ov, 'hunter-museum', { dx: 2 });
    ov = patchOverrides(ov, 'hunter-museum', { dx: 2.5, dz: -1 });
    ov = patchOverrides(ov, 'hunter-museum', { yOffset: -0.25 });
    const entry = { slug: 'hunter-museum', x: 100, z: -200, yawDeg: 0 };
    // The SAME shared merge the pipeline runs over the exported JSON.
    expect(applyOverrides(entry, ov['hunter-museum'])).toEqual({
      slug: 'hunter-museum',
      x: 102.5,
      z: -201,
      yawDeg: 15,
      yOffset: -0.25,
    });
  });

  it('exclude ends the model, reset resurrects it', () => {
    const entry = { slug: 'hunter-museum', x: 100, z: -200 };
    const excluded = patchOverrides({}, 'hunter-museum', { exclude: true });
    expect(applyOverrides(entry, excluded['hunter-museum'])).toBeNull();
    const restored = resetOverride(excluded, 'hunter-museum');
    expect(applyOverrides(entry, restored['hunter-museum'])).toEqual(entry);
  });
});

// #259 iter 5 — size-aware fly-to framing.
describe('flyToFrame', () => {
  it('falls back to the fixed iter-4 radii without dimensions', () => {
    const entry = { x: 100, z: -200 };
    expect(flyToFrame(entry, undefined, true).radius).toBe(80);
    expect(flyToFrame(entry, undefined, false).radius).toBe(140);
  });

  it('scales the radius to the model extent, clamped 60–600', () => {
    const bridge = {
      x: 0,
      z: 0,
      dim: [777, 41, 452] as [number, number, number],
    };
    expect(flyToFrame(bridge, undefined, true).radius).toBe(600); // clamp hi
    const statue = { x: 0, z: 0, dim: [6, 8, 5] as [number, number, number] };
    expect(flyToFrame(statue, undefined, true).radius).toBe(60); // clamp lo
    const building = {
      x: 0,
      z: 0,
      dim: [100, 30, 80] as [number, number, number],
    };
    expect(flyToFrame(building, undefined, true).radius).toBe(120); // 100×1.2
    expect(flyToFrame(building, undefined, false).radius).toBe(180); // 100×1.8
  });

  it('aims at the bbox centre, not the anchor (campus-corner origins)', () => {
    const entry = {
      x: 100,
      z: -200,
      centerOffset: [50, 30] as [number, number],
    };
    const f = flyToFrame(entry, undefined, true);
    expect(f.x).toBeCloseTo(150, 1);
    expect(f.z).toBeCloseTo(-170, 1);
  });

  it('rotates the centre offset by the effective yaw and adds dx/dz', () => {
    const entry = {
      x: 0,
      z: 0,
      centerOffset: [10, 0] as [number, number],
    };
    // +90° about Y swings local +X toward −Z.
    const f = flyToFrame(entry, { yawDeg: 90, dx: 2, dz: -3 }, true);
    expect(f.x).toBeCloseTo(2, 1);
    expect(f.z).toBeCloseTo(-13, 1);
  });
});

// #259 iter 5 — versioned localStorage envelope.
describe('parseStoredOverrides', () => {
  it('reads the v1 envelope', () => {
    expect(
      parseStoredOverrides(
        JSON.stringify({ v: 1, overrides: { a: { dx: 2 } } })
      )
    ).toEqual({ a: { dx: 2 } });
  });

  it('accepts a legacy bare map', () => {
    expect(parseStoredOverrides(JSON.stringify({ a: { yawDeg: 15 } }))).toEqual(
      { a: { yawDeg: 15 } }
    );
  });

  it('degrades to empty on garbage or null', () => {
    expect(parseStoredOverrides('not json')).toEqual({});
    expect(parseStoredOverrides(null)).toEqual({});
  });
});
