import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseTasksFile } from './tasks-parser';

/**
 * `tasks-parser.ts` had no test (#536).
 *
 * #536 calls it a "pure parser". It is not: it reads `window.location.hostname`,
 * calls `fetch` up to three times, stamps `Date.now()` into every URL, and
 * carries hardcoded totals for the two archived sprints. So the harness below
 * is a fetch double rather than a string in and an object out — and the fetch
 * behaviour (which URL, which fallback, what happens when one 404s) is most of
 * what there is to get wrong.
 */

const SPRINT_35 = `
# Tasks: Sprint 3.5 — Technical Debt Reduction

Last Updated: 2026-08-05 (some parenthetical)

- [x] T001 first thing
- [x] T002 second thing
- [ ] T003 not done yet
- [ ] T004 also not done
`;

const ARCHIVED_SPRINT_1 = `
✅ **Phase 0 Complete** — deployed
✅ **Phase 1 Complete** — storybook
✅ **Phase 2 Complete** — themes
`;

/** Build a fetch double that answers by URL substring. */
function mockFetch(routes: Record<string, { ok: boolean; body?: string }>) {
  return vi.fn(async (url: string) => {
    for (const [needle, res] of Object.entries(routes)) {
      if (url.includes(needle)) {
        return {
          ok: res.ok,
          text: async () => res.body ?? '',
        } as Response;
      }
    }
    return { ok: false, text: async () => '' } as Response;
  });
}

describe('parseTasksFile', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/specs/016-sprint-3-5/tasks.md': { ok: true, body: SPRINT_35 },
        '/docs/spec-kit/archive/': { ok: true, body: ARCHIVED_SPRINT_1 },
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads the sprint-3.5 tasks file with a cache-busting query', () => {
    // The `?t=` is not decoration — GitHub Pages caches aggressively and a
    // stale tasks.md renders a stale progress bar on /status.
    return parseTasksFile().then(() => {
      const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(url).toContain('/specs/016-sprint-3-5/tasks.md');
      expect(url).toMatch(/\?t=\d+/);
    });
  });

  it('extracts Last Updated, stopping before the parenthetical', async () => {
    const result = await parseTasksFile();
    expect(result.lastUpdated).toBe('2026-08-05');
  });

  it('counts T-prefixed tasks and the [x] ones among them', async () => {
    const result = await parseTasksFile();
    const sprint35 = result.sprints?.find((s) =>
      s.name.startsWith('Sprint 3.5')
    );
    expect(sprint35).toBeDefined();
    expect(sprint35!.totalTasks).toBe(4);
    expect(sprint35!.completedTasks).toBe(2);
    expect(sprint35!.percentage).toBe(50);
    expect(sprint35!.status).toBe('in-progress');
  });

  it('reports not-started when nothing is checked off', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/specs/016-sprint-3-5/tasks.md': {
          ok: true,
          body: 'Tasks: Sprint 3.5\n- [ ] T001\n- [ ] T002\n',
        },
      })
    );
    const result = await parseTasksFile();
    const sprint35 = result.sprints?.find((s) =>
      s.name.startsWith('Sprint 3.5')
    );
    expect(sprint35!.completedTasks).toBe(0);
    expect(sprint35!.percentage).toBe(0);
    expect(sprint35!.status).toBe('not-started');
  });

  it('carries the two archived sprints as fixed totals', async () => {
    // Sprint 1 and 2 are hardcoded because their task files are archived out of
    // the deployed tree. Pinned here so nobody "fixes" them into a parse that
    // would silently read zero.
    const result = await parseTasksFile();
    const names = result.sprints?.map((s) => s.name) ?? [];
    expect(names[0]).toBe('Sprint 1: Core');
    expect(names[1]).toBe('Sprint 2: Fix the Foundation');
    expect(result.sprints?.[0]).toMatchObject({
      completedTasks: 95,
      totalTasks: 96,
      status: 'completed',
    });
    expect(result.sprints?.[1]).toMatchObject({
      completedTasks: 65,
      totalTasks: 65,
      status: 'completed',
    });
  });

  it('totals across every sprint rather than the current one', async () => {
    const result = await parseTasksFile();
    expect(result.totalTasks).toBe(96 + 65 + 4);
    expect(result.completedTasks).toBe(95 + 65 + 2);
    expect(result.percentage).toBe(
      Math.round(((95 + 65 + 2) / (96 + 65 + 4)) * 100)
    );
  });

  it('reads Sprint 1 phase markers out of the archived file, not the current one', async () => {
    const result = await parseTasksFile();
    expect(Object.keys(result.phases)).toEqual([
      'Phase 0',
      'Phase 1',
      'Phase 2',
    ]);
    expect(result.phases['Phase 0'].complete).toBe(true);
    // Phases 3 and 4 are absent from the fixture, so they must be absent here —
    // the parser adds a key only when it sees the marker.
    expect(result.phases['Phase 3']).toBeUndefined();
  });

  it('falls back to /TASKS.md when the sprint file 404s', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/specs/016-sprint-3-5/tasks.md': { ok: false },
        '/TASKS.md': { ok: true, body: SPRINT_35 },
      })
    );
    const result = await parseTasksFile();
    expect(result.lastUpdated).toBe('2026-08-05');
    const urls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string
    );
    expect(urls.some((u) => u.includes('/TASKS.md'))).toBe(true);
  });

  it('throws when both the sprint file and the fallback are missing', async () => {
    vi.stubGlobal('fetch', mockFetch({}));
    await expect(parseTasksFile()).rejects.toThrow(
      'Failed to fetch tasks file'
    );
  });

  it('survives the archived-sprint fetch rejecting outright', async () => {
    // This one is wrapped in its own try/catch precisely so a missing archive
    // does not take down /status. If that catch is ever removed, this goes red.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/docs/spec-kit/archive/')) {
          throw new Error('network down');
        }
        return { ok: true, text: async () => SPRINT_35 } as Response;
      })
    );
    const result = await parseTasksFile();
    expect(result.sprints).toBeDefined();
    // With no archived content the parser falls back to the current file, which
    // carries no phase markers.
    expect(Object.keys(result.phases)).toEqual([]);
  });

  it('prefixes the project name only on github.io, not on the custom domain', async () => {
    const original = window.location.hostname;
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hostname: 'tortoisewolfe.github.io' },
      writable: true,
      configurable: true,
    });
    try {
      await parseTasksFile();
      const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(url.startsWith('/ScriptHammer/')).toBe(true);
    } finally {
      Object.defineProperty(window, 'location', {
        value: { ...window.location, hostname: original },
        writable: true,
        configurable: true,
      });
    }
  });

  it('counts a task ONCE even when its id is mentioned more than once (#546)', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/specs/016-sprint-3-5/tasks.md': {
          ok: true,
          body: 'Tasks: Sprint 3.5\nSummary: T001 covers the parser.\n- [x] T001 done\n',
        },
      })
    );
    const result = await parseTasksFile();
    const s = result.sprints?.find((x) => x.name.startsWith('Sprint 3.5'));
    expect(s!.totalTasks).toBe(1);
    expect(s!.completedTasks).toBe(1);
    expect(s!.percentage).toBe(100);
  });

  it('ignores quoted checkbox examples when calculating completion', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/specs/016-sprint-3-5/tasks.md': {
          ok: true,
          body: [
            'Tasks: Sprint 3.5',
            'Summary: T001 and T002 are pending.',
            '> - [x] T001 quoted example, not a completed task.',
            '- [ ] T001 actual task',
            '- [ ] T002 another actual task',
          ].join('\n'),
        },
      })
    );

    const result = await parseTasksFile();
    const sprint35 = result.sprints?.find((s) =>
      s.name.startsWith('Sprint 3.5')
    );
    expect(sprint35).toMatchObject({
      totalTasks: 2,
      completedTasks: 0,
      percentage: 0,
      status: 'not-started',
    });
  });
});
