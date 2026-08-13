import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCommitScheduler } from '@/lib/collider-commit';

/**
 * One BVH build per burst of collider registrations (#702).
 *
 * WHAT WENT WRONG. The first attempt coalesced with `requestAnimationFrame`, on the
 * assumption that chatt's 129 landmark GLBs register together. They do not:
 * `WarehouseModels` wraps each model in its own `<Suspense>` so the city streams in
 * progressively, so they mount on ~129 DIFFERENT frames and a per-frame coalesce merges
 * nothing. `StaticWorld.build()` is a full rebuild from scratch with no incremental path,
 * so that became ~129 rebuilds over a growing triangle set — the frame drag the owner
 * reported as "glitchy and dragging frames".
 *
 * These tests are on fake timers so the scheduling is asserted as behaviour rather than
 * raced against real time.
 */
describe('collider commit scheduler (#702)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a 129-model stream costs a couple of builds, not 129', () => {
    const commit = vi.fn();
    const s = createCommitScheduler(commit, { quietMs: 300, maxWaitMs: 2000 });

    // 129 models arriving on 129 separate frames, ~16 ms apart — the real pattern that
    // defeated the requestAnimationFrame version. The whole stream runs 2064 ms, longer
    // than the ceiling, so the ceiling deliberately fires once part-way through: collision
    // becomes available progressively instead of only when the last GLB lands.
    for (let i = 0; i < 129; i++) {
      s.schedule();
      vi.advanceTimersByTime(16);
    }
    vi.advanceTimersByTime(300);

    expect(commit.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(
      commit.mock.calls.length,
      `129 streaming registrations cost ${commit.mock.calls.length} BVH rebuilds — the ` +
        `regression was one per model, and each rebuild is a full rebuild from scratch`
    ).toBeLessThanOrEqual(2);
  });

  it('commits once the burst goes quiet', () => {
    const commit = vi.fn();
    const s = createCommitScheduler(commit, { quietMs: 300, maxWaitMs: 2000 });
    s.schedule();
    vi.advanceTimersByTime(299);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('a slow trickle still commits — the starvation guard', () => {
    // Without the ceiling, restarting the quiet window on every arrival lets a steady
    // trickle of slow-loading models postpone collision forever: you would be walking
    // through a city that never became solid.
    const commit = vi.fn();
    const s = createCommitScheduler(commit, { quietMs: 300, maxWaitMs: 2000 });
    for (let t = 0; t < 2000; t += 100) {
      s.schedule();
      vi.advanceTimersByTime(100);
    }
    expect(
      commit,
      'a trickle shorter than the quiet window starved the commit indefinitely'
    ).toHaveBeenCalledTimes(1);
  });

  it('a later burst commits again', () => {
    // The ceiling is armed per batch; after it fires the next batch must schedule fresh.
    const commit = vi.fn();
    const s = createCommitScheduler(commit, { quietMs: 300, maxWaitMs: 2000 });
    s.schedule();
    vi.advanceTimersByTime(300);
    expect(commit).toHaveBeenCalledTimes(1);

    s.schedule();
    vi.advanceTimersByTime(300);
    expect(
      commit,
      'the scheduler stopped working after its first commit'
    ).toHaveBeenCalledTimes(2);
  });

  it('cancel drops a pending commit, and is safe when nothing is pending', () => {
    const commit = vi.fn();
    const s = createCommitScheduler(commit, { quietMs: 300, maxWaitMs: 2000 });
    s.schedule();
    s.cancel();
    vi.advanceTimersByTime(5000);
    expect(
      commit,
      'a cancelled commit fired after unmount'
    ).not.toHaveBeenCalled();
    s.cancel();
    expect(commit).not.toHaveBeenCalled();
  });

  it('flush commits immediately, and only when something is pending', () => {
    const commit = vi.fn();
    const s = createCommitScheduler(commit, { quietMs: 300, maxWaitMs: 2000 });
    s.flush();
    expect(
      commit,
      'flush built the BVH with nothing to commit'
    ).not.toHaveBeenCalled();

    s.schedule();
    s.flush();
    expect(commit).toHaveBeenCalledTimes(1);
    // The pending timers must have been cleared, not left to fire a second build.
    vi.advanceTimersByTime(5000);
    expect(
      commit,
      'flush left its timers armed — a duplicate rebuild'
    ).toHaveBeenCalledTimes(1);
  });
});
