/**
 * The Supabase target guard, tested by BEHAVIOUR (#877).
 *
 * WHY HERE AND NOT IN scripts/__tests__. The first version of these assertions matched the
 * guard's SOURCE TEXT, because a `node --test` file cannot import TypeScript. That is brittle
 * in a way this repo has been bitten by before, and it broke immediately: the pre-commit
 * `prettier --write` split a single-line `return { ... }` across five lines *after* the tests
 * had been run, so they passed locally and failed in CI against the committed file. The test
 * was checking the spelling of the rule rather than the rule.
 *
 * Vitest can import the module, so these call the real functions. The text assertions that
 * remain in `scripts/__tests__/supabase-target-guard.test.js` are only about WIRING — which
 * scripts call the guard, what the shell wrapper forwards, what package.json declares — none
 * of which is reachable from an import.
 *
 * The incident: on 2026-08-21 `pnpm run seed:local` wrote to the cloud project and gave every
 * account in it an `accepted` connection to every other account, which is the messaging
 * authorization itself. ~18 of those accounts belong to real people.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  classify,
  decide,
  resolveUrl,
} from '../../scripts/lib/supabase-target';

describe('classify', () => {
  it('calls every route to the local stack local', () => {
    // Three genuinely different routes to the SAME stack: the published port, the compose
    // service name the app container uses, and the docker host gateway. Missing any one of
    // them makes the guard refuse legitimate work, which is how a guard gets switched off.
    for (const url of [
      'http://127.0.0.1:54321',
      'http://localhost:54321',
      'http://supabase-kong:8000',
      'http://host.docker.internal:54321',
    ]) {
      expect(classify(url).isLocal, url).toBe(true);
    }
  });

  it('calls a hosted project remote', () => {
    const t = classify('https://ozbdyopxmeqmwnfsmglp.supabase.co');
    expect(t.isLocal).toBe(false);
    expect(t.host).toBe('ozbdyopxmeqmwnfsmglp.supabase.co');
  });

  it('treats an unparseable URL as REMOTE rather than waving it through', () => {
    // Failing safe means refusing. A string the classifier cannot understand is exactly
    // when you least want it guessing.
    const t = classify('not a url at all');
    expect(t.isLocal).toBe(false);
    expect(t.host).toBe('<unparseable>');
  });

  it('is not fooled by a hostname that merely contains a local one', () => {
    // `localhost.evil.example` and `supabase-kong.attacker.net` must not pass as local.
    for (const url of [
      'https://localhost.evil.example',
      'https://supabase-kong.attacker.net',
      'https://127.0.0.1.evil.example',
    ]) {
      expect(classify(url).isLocal, url).toBe(false);
    }
  });
});

describe('decide', () => {
  const remote = 'https://ozbdyopxmeqmwnfsmglp.supabase.co';

  it('allows a local target with no ceremony', () => {
    const d = decide({
      SUPABASE_ADMIN_URL: 'http://supabase-kong:8000',
    });
    expect(d.allowed).toBe(true);
  });

  it('refuses a remote target by default', () => {
    const d = decide({ NEXT_PUBLIC_SUPABASE_URL: remote });
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain('refusing to write to the remote project');
  });

  it('refuses when nothing is set, rather than guessing', () => {
    const d = decide({});
    expect(d.allowed).toBe(false);
    expect(d.target).toBeNull();
  });

  it('rejects a truthy override that does not name the host', () => {
    // This is the whole point of the design. `=1` would be exported once and forgotten,
    // and would then authorise every later run against anything.
    for (const allow of ['1', 'true', 'yes', 'please']) {
      const d = decide({
        NEXT_PUBLIC_SUPABASE_URL: remote,
        ALLOW_REMOTE_SUPABASE: allow,
      });
      expect(d.allowed, allow).toBe(false);
      expect(d.reason).toContain('must name the host it authorises');
    }
  });

  it('rejects an override naming a DIFFERENT host', () => {
    const d = decide({
      NEXT_PUBLIC_SUPABASE_URL: remote,
      ALLOW_REMOTE_SUPABASE: 'some-other-project.supabase.co',
    });
    expect(d.allowed).toBe(false);
  });

  it('allows a remote target when the override names it exactly', () => {
    // The gate must OPEN, or deliberate cloud seeding becomes impossible and someone
    // deletes the guard instead of using it.
    const d = decide({
      NEXT_PUBLIC_SUPABASE_URL: remote,
      ALLOW_REMOTE_SUPABASE: 'ozbdyopxmeqmwnfsmglp.supabase.co',
    });
    expect(d.allowed).toBe(true);
    expect(d.reason).toContain('explicitly authorised by name');
  });

  it('prefers SUPABASE_ADMIN_URL, matching how the seeders resolve', () => {
    // If this drifted from the seeders' own resolution order, the guard would inspect one
    // project while the script wrote to another — a gate pointed at the wrong subject.
    expect(
      resolveUrl({
        SUPABASE_ADMIN_URL: 'http://supabase-kong:8000',
        NEXT_PUBLIC_SUPABASE_URL: remote,
      })
    ).toBe('http://supabase-kong:8000');
  });
});

describe('the required CI lane keeps working', () => {
  it("classifies CI's own seeding host as local", () => {
    // e2e-local.yml runs `pnpm tsx scripts/seed-test-users.ts` against its per-runner stack.
    // If the guard stopped recognising that host, every PR would fail at the seeding step
    // rather than failing here — so the two are pinned to each other.
    const wf = readFileSync(
      join(__dirname, '..', '..', '.github', 'workflows', 'e2e-local.yml'),
      'utf8'
    );
    const m = wf.match(/SUPABASE_ADMIN_URL=([^"'\s]+)/);
    expect(
      m,
      'e2e-local.yml no longer sets SUPABASE_ADMIN_URL for seeding'
    ).toBeTruthy();
    expect(classify(m![1]).isLocal, `CI seeds against ${m![1]}`).toBe(true);
  });
});
