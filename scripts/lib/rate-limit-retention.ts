/**
 * Retention for `rate_limit_attempts` (#1295).
 *
 * The limiter reads only the last few minutes: `check_rate_limit` and `consume_rate_limit`
 * reset any bucket whose window is older than that, and a lock lasts one window. A row past it
 * is never read again — but nothing deleted one, so the table kept every address anyone typed
 * into the pre-#1245 sign-in form and every IP that used the contact or booking form.
 *
 * Pure, and imports nothing that runs, so `tests/unit` can check the window against the
 * migration and `tests/rls` can execute the exact DELETE this job sends to production.
 */

/** How long an untouched row is kept. Must outlive every limiter window by a wide margin. */
export const RATE_LIMIT_RETENTION_HOURS = 24;

/**
 * Every window the migration's limiter functions use, in minutes. Read from the SQL rather than
 * restated, so a longer window cannot be introduced without this job noticing.
 */
export function limiterWindowsMinutes(migrationSql: string): number[] {
  const windows: number[] = [];
  for (const fn of ['check_rate_limit', 'consume_rate_limit']) {
    const start = migrationSql.indexOf(`CREATE OR REPLACE FUNCTION ${fn}(`);
    if (start < 0) throw new Error(`${fn} is missing from the migration`);
    const body = migrationSql.slice(
      start,
      migrationSql.indexOf('\n$$;', start)
    );
    const found = [
      ...body.matchAll(/v_window_minutes\s+INTEGER\s*:=\s*(\d+)/gi),
      ...body.matchAll(
        /v_window\s+INTERVAL\s*:=\s*interval\s+'(\d+)\s+minutes'/gi
      ),
    ].map((m) => Number(m[1]));
    if (found.length === 0) {
      throw new Error(
        `could not read ${fn}'s window — its shape changed, so this job can no longer prove ` +
          'that it deletes only rows the limiter has finished with'
      );
    }
    windows.push(...found);
  }
  return windows;
}

/** Throws unless the retention period is at least ten times the longest limiter window. */
export function assertRetentionOutlivesLimiter(migrationSql: string): void {
  const longest = Math.max(...limiterWindowsMinutes(migrationSql));
  if (RATE_LIMIT_RETENTION_HOURS * 60 < longest * 10) {
    throw new Error(
      `rate_limit_attempts retention (${RATE_LIMIT_RETENTION_HOURS} h) is too close to the ` +
        `limiter's ${longest}-minute window: deleting a bucket the limiter still reads would ` +
        'hand a throttled caller a fresh budget'
    );
  }
}

/** Rows the job may delete: untouched past the retention period AND not under a live lock. */
const STALE = `updated_at < now() - interval '${RATE_LIMIT_RETENTION_HOURS} hours'
      AND (locked_until IS NULL OR locked_until < now())`;

/** Counts only — rows carry email addresses and IPs, and are never printed. */
export const RATE_LIMIT_CENSUS_SQL = `
    SELECT count(*)                               AS total,
           count(*) FILTER (WHERE ${STALE})       AS stale
    FROM rate_limit_attempts`;

export const RATE_LIMIT_DELETE_SQL = `
    WITH gone AS (DELETE FROM rate_limit_attempts WHERE ${STALE} RETURNING 1)
    SELECT count(*) AS deleted FROM gone`;
