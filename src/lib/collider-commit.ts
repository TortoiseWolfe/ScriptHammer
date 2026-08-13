/**
 * Coalesces a burst of collider registrations into a single BVH build (#702).
 *
 * WHY THIS EXISTS. `StaticWorld.build()` is a full rebuild from scratch over every
 * triangle in the world — copy, per-triangle normals and centroids, then a binned-SAH
 * node build. There is no incremental path. Adding geometry is cheap; rebuilding is not,
 * and it gets more expensive with everything already in the world.
 *
 * `WarehouseModels` gives each of chatt's 129 landmark GLBs its own `<Suspense>` so the
 * city streams in progressively, which means they mount on ~129 DIFFERENT frames. A
 * `requestAnimationFrame` coalesce merges only what lands in the same frame, so it
 * degenerates to ~129 full rebuilds over a growing set — seconds of main-thread stalls at
 * exactly the moment the city appears. That was the reported frame drag.
 *
 * A quiet-window debounce fits the actual arrival pattern: wait for registrations to stop,
 * then build once. `maxWaitMs` is the starvation guard — a slow trickle of models must not
 * postpone collision forever, so the world is committed periodically regardless.
 */
export interface CommitScheduler {
  /** Note that work arrived; the commit fires once the burst settles. */
  schedule(): void;
  /** Drop any pending commit (unmount). */
  cancel(): void;
  /** Fire now if a commit is pending — for teardown paths that must not lose it. */
  flush(): void;
}

export interface CommitSchedulerOptions {
  /** Quiet period with no new work before committing. */
  quietMs?: number;
  /** Hard ceiling from the FIRST pending item, so a trickle still commits. */
  maxWaitMs?: number;
  /** Injected for tests; defaults to the global timer functions. */
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
}

export function createCommitScheduler(
  commit: () => void,
  {
    quietMs = 300,
    maxWaitMs = 2000,
    setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
    clearTimeoutFn = (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  }: CommitSchedulerOptions = {}
): CommitScheduler {
  let quietHandle: unknown = null;
  let ceilingHandle: unknown = null;

  const run = () => {
    if (quietHandle !== null) clearTimeoutFn(quietHandle);
    if (ceilingHandle !== null) clearTimeoutFn(ceilingHandle);
    quietHandle = null;
    ceilingHandle = null;
    commit();
  };

  return {
    schedule() {
      // Restart the quiet window on every arrival — that is what turns a burst into
      // one build instead of one per arrival.
      if (quietHandle !== null) clearTimeoutFn(quietHandle);
      quietHandle = setTimeoutFn(run, quietMs);
      // The ceiling is armed once per pending batch and NOT restarted, otherwise a
      // steady trickle could hold the commit off indefinitely — which is the whole
      // failure it exists to prevent.
      if (ceilingHandle === null) ceilingHandle = setTimeoutFn(run, maxWaitMs);
    },
    cancel() {
      if (quietHandle !== null) clearTimeoutFn(quietHandle);
      if (ceilingHandle !== null) clearTimeoutFn(ceilingHandle);
      quietHandle = null;
      ceilingHandle = null;
    },
    flush() {
      if (quietHandle === null && ceilingHandle === null) return;
      run();
    },
  };
}
