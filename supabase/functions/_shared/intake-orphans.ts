/**
 * Which intake uploads are orphaned, and therefore safe to delete (#560, T023).
 *
 * WHY THIS IS A SEPARATE, PURE MODULE. The sweep deletes buyers' files. If the
 * "is this orphaned?" decision is wrong by one join, the first live run destroys
 * real customer uploads and there is no undo. That decision therefore lives here,
 * as a function over plain data with no network and no client, so it can be tested
 * exhaustively — including the cases that must NOT be deleted, which are the ones
 * that matter.
 *
 * WHAT AN ORPHAN IS. A buyer uploads attachments to `intake-uploads` and only
 * afterwards submits the order that references them. An upload is therefore
 * orphaned when it is:
 *
 *   1. not referenced by ANY order's `intake_data.attachments[].path`, and
 *   2. older than the grace window (7 days).
 *
 * Both conditions are required. (1) alone would delete the file a buyer uploaded
 * ninety seconds ago while they are still filling in the form — the single most
 * likely way to turn this job into a customer-visible defect.
 *
 * WHY THE REFERENCE SET IS PASSED IN WHOLE rather than queried per object: an
 * object must be compared against EVERY order, not just recent ones. A file
 * referenced by a two-year-old order is not an orphan. Querying per object invites
 * a bounded query that silently misses the old ones.
 */

/** One object as Supabase Storage lists it. */
export interface StorageObject {
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface OrphanInput {
  /** Every object currently in the bucket. */
  objects: StorageObject[];
  /** Every path referenced by any order, from `intake_data.attachments[].path`. */
  referenced: Iterable<string>;
  /** Uploads newer than this are never touched, however unreferenced. */
  graceDays: number;
  /** Evaluation time; injected so tests do not depend on the clock. */
  now: Date;
}

export interface OrphanResult {
  orphans: StorageObject[];
  /** Unreferenced but still inside the grace window — deliberately kept. */
  tooYoung: StorageObject[];
  /** Referenced by an order, at any age. */
  referenced: StorageObject[];
  /** Listed objects with no usable timestamp; kept, never guessed about. */
  undated: StorageObject[];
}

/** A path is stored with the bucket implied, so compare on the object name alone. */
function normalise(p: string): string {
  return p.replace(/^\/+/, '').replace(/^intake-uploads\//, '');
}

/** Pull every attachment path out of a set of `intake_data` blobs. */
export function referencedPaths(intakeBlobs: unknown[]): Set<string> {
  const out = new Set<string>();
  for (const blob of intakeBlobs) {
    const attachments = (blob as { attachments?: unknown })?.attachments;
    if (!Array.isArray(attachments)) continue;
    for (const a of attachments) {
      const path = (a as { path?: unknown })?.path;
      if (typeof path === 'string' && path.length > 0) out.add(normalise(path));
    }
  }
  return out;
}

export function findOrphans({
  objects,
  referenced,
  graceDays,
  now,
}: OrphanInput): OrphanResult {
  const refs = new Set([...referenced].map(normalise));
  const cutoff = now.getTime() - graceDays * 864e5;

  const result: OrphanResult = {
    orphans: [],
    tooYoung: [],
    referenced: [],
    undated: [],
  };

  for (const obj of objects) {
    if (refs.has(normalise(obj.name))) {
      result.referenced.push(obj);
      continue;
    }

    // An object whose timestamp we cannot read is NOT assumed old. Treating an
    // unparseable date as "ancient" is the version of this bug that deletes
    // everything, so the unreadable case is surfaced instead of decided.
    const stamp = obj.created_at ?? obj.updated_at ?? null;
    const ms = stamp ? Date.parse(stamp) : NaN;
    if (!Number.isFinite(ms)) {
      result.undated.push(obj);
      continue;
    }

    if (ms < cutoff) result.orphans.push(obj);
    else result.tooYoung.push(obj);
  }

  return result;
}
