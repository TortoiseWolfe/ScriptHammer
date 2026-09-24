import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RATE_LIMIT_RETENTION_HOURS,
  assertRetentionOutlivesLimiter,
  limiterWindowsMinutes,
} from '../../scripts/lib/rate-limit-retention';

/**
 * The retention job may delete only buckets the limiter has finished with (#1295). Deleting one
 * it still reads would hand a throttled caller a fresh budget, so the window is read from the
 * migration rather than restated, and the job refuses to run if the two ever come close.
 */
const MIGRATION = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20251006_complete_monolithic_setup.sql'
  ),
  'utf8'
);

describe('rate_limit_attempts retention (#1295)', () => {
  it('reads both limiter windows from the migration', () => {
    // Anti-vacuity: an empty list would make the comparison below meaningless.
    expect(limiterWindowsMinutes(MIGRATION)).toEqual([15, 15]);
  });

  it('keeps rows far longer than the limiter ever looks back', () => {
    expect(() => assertRetentionOutlivesLimiter(MIGRATION)).not.toThrow();
    expect(RATE_LIMIT_RETENTION_HOURS * 60).toBeGreaterThanOrEqual(15 * 10);
  });

  it('refuses to run if a limiter window grows toward the retention period', () => {
    const longer = MIGRATION.replace(
      "v_window INTERVAL := interval '15 minutes'",
      "v_window INTERVAL := interval '300 minutes'"
    );
    expect(longer).not.toBe(MIGRATION);
    expect(() => assertRetentionOutlivesLimiter(longer)).toThrow(/too close/);
  });

  it('refuses to guess when a limiter function changes shape', () => {
    const reshaped = MIGRATION.replace('v_window_minutes INTEGER := 15;', '');
    expect(reshaped).not.toBe(MIGRATION);
    expect(() => limiterWindowsMinutes(reshaped)).toThrow(
      /could not read check_rate_limit/
    );
  });
});
