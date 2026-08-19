/**
 * The orphan sweep must never delete a file that is still wanted (#560, T023).
 *
 * These tests are weighted deliberately towards what must SURVIVE. A sweep that
 * misses an orphan wastes a few kilobytes until the next run; a sweep that deletes
 * a live attachment destroys something a customer sent and cannot resend, with no
 * undo. The asymmetry is the whole reason this logic is a pure function.
 */
import { describe, it, expect } from 'vitest';
import {
  findOrphans,
  referencedPaths,
  type StorageObject,
} from '../../supabase/functions/_shared/intake-orphans';

const NOW = new Date('2026-08-19T00:00:00Z');
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 864e5).toISOString();

const obj = (name: string, age: number | null): StorageObject => ({
  name,
  created_at: age === null ? null : daysAgo(age),
});

const sweep = (objects: StorageObject[], referenced: string[] = []) =>
  findOrphans({ objects, referenced, graceDays: 7, now: NOW });

describe('findOrphans (#560 T023)', () => {
  it('deletes an unreferenced upload older than the grace window', () => {
    const r = sweep([obj('user-a/old.png', 30)]);
    expect(r.orphans.map((o) => o.name)).toEqual(['user-a/old.png']);
  });

  it('never deletes an upload referenced by an order, however old', () => {
    // The failure that matters. A two-year-old order's attachment is not an orphan.
    const r = sweep([obj('user-a/keep.png', 900)], ['user-a/keep.png']);
    expect(r.orphans).toEqual([]);
    expect(r.referenced.map((o) => o.name)).toEqual(['user-a/keep.png']);
  });

  it('never deletes an upload still inside the grace window', () => {
    // A buyer who uploaded 90 seconds ago is still filling in the form. Deleting
    // that file is the most likely way to make this job customer-visible.
    const r = sweep([obj('user-a/fresh.png', 0), obj('user-a/day6.png', 6)]);
    expect(r.orphans).toEqual([]);
    expect(r.tooYoung.map((o) => o.name)).toEqual([
      'user-a/fresh.png',
      'user-a/day6.png',
    ]);
  });

  it('does not treat an unreadable timestamp as ancient', () => {
    // The version of this bug that deletes everything: `Date.parse` returns NaN,
    // NaN < cutoff is false in JS — but only by luck. Surface it, never guess.
    const r = sweep([
      { name: 'user-a/nodate.png' },
      { name: 'user-a/bad.png', created_at: 'not-a-date' },
    ]);
    expect(r.orphans).toEqual([]);
    expect(r.undated.map((o) => o.name)).toEqual([
      'user-a/nodate.png',
      'user-a/bad.png',
    ]);
  });

  it('falls back to updated_at when created_at is absent', () => {
    const r = findOrphans({
      objects: [
        { name: 'user-a/u.png', created_at: null, updated_at: daysAgo(30) },
      ],
      referenced: [],
      graceDays: 7,
      now: NOW,
    });
    expect(r.orphans.map((o) => o.name)).toEqual(['user-a/u.png']);
  });

  it('matches a reference written with a bucket prefix or leading slash', () => {
    // The client composes these paths; a stored `intake-uploads/x` or `/x` must
    // still protect the object called `x`, or the sweep deletes a live attachment
    // because two layers spelled the same path differently.
    const r = sweep(
      [obj('user-a/x.png', 30), obj('user-a/y.png', 30)],
      ['intake-uploads/user-a/x.png', '/user-a/y.png']
    );
    expect(r.orphans).toEqual([]);
  });

  it('the detector can actually fail', () => {
    // A findOrphans that returned [] for everything would pass every assertion
    // above, since all but two of them assert emptiness.
    const r = sweep([obj('a', 30), obj('b', 30), obj('c', 1)], ['a']);
    expect(r.orphans.map((o) => o.name)).toEqual(['b']);
    expect(r.referenced.map((o) => o.name)).toEqual(['a']);
    expect(r.tooYoung.map((o) => o.name)).toEqual(['c']);
  });
});

describe('referencedPaths (#560 T023)', () => {
  it('collects every attachment path across orders', () => {
    const refs = referencedPaths([
      { attachments: [{ path: 'u1/a.png' }, { path: 'u1/b.pdf' }] },
      { attachments: [{ path: 'u2/c.heic' }] },
    ]);
    expect([...refs].sort()).toEqual(['u1/a.png', 'u1/b.pdf', 'u2/c.heic']);
  });

  it('survives orders with no attachments, nulls and junk', () => {
    // intake_data is free-form JSONB. A parser that threw here would abort the
    // sweep; one that returned an empty set would make every file look orphaned.
    const refs = referencedPaths([
      {},
      { attachments: null },
      { attachments: 'nope' },
      { attachments: [null, { path: 42 }, { path: '' }, { path: 'ok.png' }] },
      null,
      undefined,
    ]);
    expect([...refs]).toEqual(['ok.png']);
  });
});
