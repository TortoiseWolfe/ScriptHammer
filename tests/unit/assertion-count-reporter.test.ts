/**
 * The zero-assertion reporter must name silent tests and stay quiet otherwise (#396).
 *
 * #396's highest-value remaining item was making "a spec that runs zero assertions
 * visibly different from one that runs twelve". Every entry in that catalogue was found
 * by a person becoming suspicious of one specific test; this makes the symptom visible
 * without anyone having to suspect anything.
 *
 * The three ways a reporter like this is useless, all pinned below:
 *   - it misses a silent test (the whole point)
 *   - it slanders a test that DID assert (nobody would trust it twice)
 *   - it prints a clean bill of health having observed nothing — which is the exact
 *     shape #396 catalogues, committed by the tool built to detect it
 */
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Reporter from '../e2e/reporters/assertion-count-reporter';
import type { TestCase, TestResult, TestStep } from '@playwright/test/reporter';

const testCase = (file: string, line: number, title: string) =>
  ({ location: { file, line }, title }) as unknown as TestCase;

const step = (category: string) => ({ category }) as unknown as TestStep;
const passed = () => ({ status: 'passed' }) as unknown as TestResult;

describe('assertion-count reporter (#396)', () => {
  let out: string[];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    out = [];
    spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
      out.push(a.join(' '));
    });
  });
  afterEach(() => spy.mockRestore());

  const report = () => out.join('\n');

  it('names a test that ran no assertions', () => {
    const r = new Reporter();
    const silent = testCase(
      '/repo/tests/e2e/quiet.spec.ts',
      12,
      'asserts nothing'
    );
    r.onTestEnd?.(silent, passed());
    r.onEnd?.();

    expect(report()).toContain('ran ZERO assertions');
    expect(report()).toContain('quiet.spec.ts:12');
    expect(report()).toContain('asserts nothing');
  });

  it('does not slander a test that did assert', () => {
    const r = new Reporter();
    const real = testCase('/repo/tests/e2e/loud.spec.ts', 3, 'asserts twice');
    r.onStepEnd?.(real, passed(), step('expect'));
    r.onStepEnd?.(real, passed(), step('expect'));
    r.onTestEnd?.(real, passed());
    r.onEnd?.();

    expect(report()).toContain('all ran at least one assertion');
    expect(report()).not.toContain('ZERO');
  });

  it('counts only expect steps, not every step', () => {
    // A test whose only steps are navigations has asserted nothing, however busy
    // it looked. This is exactly the #842 shape: goto, locate, loop, return.
    const r = new Reporter();
    const busy = testCase('/repo/tests/e2e/busy.spec.ts', 7, 'navigates a lot');
    for (const c of ['pw:api', 'hook', 'fixture', 'pw:api']) {
      r.onStepEnd?.(busy, passed(), step(c));
    }
    r.onTestEnd?.(busy, passed());
    r.onEnd?.();

    expect(report()).toContain('ran ZERO assertions');
    expect(report()).toContain('busy.spec.ts:7');
  });

  it('refuses to give a clean bill of health having seen nothing', () => {
    // The reporter committing the very sin it detects. If a run observes no tests —
    // a bad shard filter, a crashed setup — "all good" would be a lie of the exact
    // kind #396 exists to catalogue.
    const r = new Reporter();
    r.onEnd?.();

    expect(report()).toContain('proves nothing');
    expect(report()).not.toContain('all ran at least one assertion');
  });

  it('never throws, whatever it is asked to report on', () => {
    // It is wired into every lane, including the required one, and a reporter that
    // throws breaks the run it is only supposed to describe.
    const r = new Reporter();
    const silent = testCase('/repo/tests/e2e/quiet.spec.ts', 1, 'x');
    expect(() => {
      r.onStepEnd?.(silent, passed(), step('expect'));
      r.onTestEnd?.(silent, passed());
      r.onEnd?.();
    }).not.toThrow();
  });

  describe('gate mode (#861)', () => {
    // The point of these two: the same input must reach opposite verdicts. A gate that
    // can only ever return one answer is the defect this whole family is about.
    const silentRun = async (mode?: string) => {
      if (mode === undefined) delete process.env.ZERO_ASSERTION_GATE_MODE;
      else process.env.ZERO_ASSERTION_GATE_MODE = mode;
      process.env.ZERO_ASSERTION_OUTPUT = join(
        tmpdir(),
        `za-${Date.now()}-${Math.random()}.json`
      );
      const r = new Reporter();
      const silent = testCase(
        '/repo/tests/e2e/quiet.spec.ts',
        7,
        'asserts nothing'
      );
      r.onTestEnd?.(silent, passed());
      const verdict = await r.onEnd?.();
      const written = JSON.parse(
        readFileSync(process.env.ZERO_ASSERTION_OUTPUT, 'utf8')
      );
      rmSync(process.env.ZERO_ASSERTION_OUTPUT, { force: true });
      return { verdict, written };
    };

    it('defaults to annotate — prints, does not fail', async () => {
      const { verdict, written } = await silentRun(undefined);
      expect(verdict).toBeUndefined();
      expect(report()).toContain('does not fail the run');
      expect(written.mode).toBe('annotate');
      expect(written.silent).toHaveLength(1);
    });

    it('fails the run when the mode is block', async () => {
      const { verdict, written } = await silentRun('block');
      expect(verdict).toEqual({ status: 'failed' });
      expect(report()).toContain('failing the run');
      expect(written.mode).toBe('block');
      expect(written.silent[0]).toContain('quiet.spec.ts:7');
    });

    it('does not fail a clean run even in block mode', async () => {
      process.env.ZERO_ASSERTION_GATE_MODE = 'block';
      process.env.ZERO_ASSERTION_OUTPUT = join(
        tmpdir(),
        `za-clean-${Date.now()}.json`
      );
      const r = new Reporter();
      const real = testCase('/repo/tests/e2e/loud.spec.ts', 3, 'asserts');
      r.onStepEnd?.(real, passed(), step('expect'));
      r.onTestEnd?.(real, passed());
      expect(await r.onEnd?.()).toBeUndefined();
      const written = JSON.parse(
        readFileSync(process.env.ZERO_ASSERTION_OUTPUT, 'utf8')
      );
      rmSync(process.env.ZERO_ASSERTION_OUTPUT, { force: true });
      expect(written.silent).toEqual([]);
      expect(written.observed).toBe(1);
    });

    it('records that it observed nothing, so a vacuous shard is detectable', async () => {
      process.env.ZERO_ASSERTION_GATE_MODE = 'block';
      process.env.ZERO_ASSERTION_OUTPUT = join(
        tmpdir(),
        `za-vac-${Date.now()}.json`
      );
      const r = new Reporter();
      expect(await r.onEnd?.()).toBeUndefined();
      const written = JSON.parse(
        readFileSync(process.env.ZERO_ASSERTION_OUTPUT, 'utf8')
      );
      rmSync(process.env.ZERO_ASSERTION_OUTPUT, { force: true });
      // The reporter itself passes here; check-zero-assertions.mjs is what turns
      // `observed: 0` into a failure, because that is the shard-level question.
      expect(written.observed).toBe(0);
    });
  });
});
