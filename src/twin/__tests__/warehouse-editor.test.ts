// #259 iteration 4 — the Edit mode's override reducer semantics, extracted
// pure in useWarehouseEditor.ts. These are the state transitions behind
// every editor gesture (button, hotkey, gizmo): merge-patch per slug, reset
// removes the key entirely, exclude survives round-trips.

import { describe, it, expect } from 'vitest';
import { patchOverrides, resetOverride } from '../useWarehouseEditor';
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
