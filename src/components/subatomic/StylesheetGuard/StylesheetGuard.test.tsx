import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StylesheetGuard from './StylesheetGuard';

/**
 * Mostly the SHAPE of the emitted script — plus the one part that is real logic.
 *
 * jsdom cannot reproduce the bug: it does not fetch stylesheets, so a `<link>`
 * never 404s and `document.styleSheets` never carries an empty external sheet.
 * The behavioural proof lives in `scripts/check-stale-html.mjs`, which drives a
 * real Chromium, covers healthy / all-dead / one-dead / re-arm / anti-loop, and is
 * mutation-proven — disabling the guard fails the required `accessibility` check.
 *
 * What is worth pinning HERE is the set of properties whose loss would make that
 * runtime guard dangerous or dead, and which a careless edit could remove without
 * any browser noticing: the deferral to `load`, and the fact that it navigates
 * rather than reloads.
 *
 * The THROTTLE is different — it is `sessionStorage` plus arithmetic, which jsdom
 * executes faithfully — so it is run rather than pattern-matched. `new Function` is
 * safe here: its only input is this component's own compiled-in template literal,
 * which is exactly what ships, and executing what ships is the point.
 */
describe('StylesheetGuard', () => {
  const scriptText = () => {
    const { container } = render(<StylesheetGuard />);
    const script = container.querySelector('script');
    expect(script).not.toBeNull();
    return script!.innerHTML;
  };

  /**
   * The script explains in comments WHY it avoids `location.reload()` and
   * `DOMContentLoaded`, so a naive absence check matches the prose and fails on
   * correct code — which is exactly what happened when these were first written.
   * Assert against code only.
   */
  const codeOnly = () =>
    scriptText()
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');

  it('renders an inline script and nothing visible', () => {
    const { container } = render(<StylesheetGuard />);
    const script = container.querySelector('script');
    expect(script).toBeInTheDocument();
    expect(script?.textContent?.length ?? 0).toBeGreaterThan(0);
  });

  /**
   * THE THROTTLE IS REAL LOGIC, SO TEST IT AS LOGIC (#752).
   *
   * The stylesheet detection needs a browser, but the decision about whether to arm
   * at all is just `sessionStorage` and clock arithmetic — jsdom runs that exactly
   * as a browser would. Running it beats matching its source: this was a regex
   * against `sessionStorage.getItem(...) return`, which passed for the once-per-tab
   * bug and would have passed for any rearrangement that broke the rule.
   *
   * Arming is observable: a script that intends to act registers a `load` listener,
   * and a throttled one returns before it can.
   */
  const armsAfter = (stored: string | null) => {
    sessionStorage.clear();
    if (stored !== null)
      sessionStorage.setItem('sh-stylesheet-recovered', stored);
    const listeners: string[] = [];
    const original = window.addEventListener;
    window.addEventListener = ((type: string, ...rest: unknown[]) => {
      listeners.push(type);
      return (original as unknown as (...a: unknown[]) => void).call(
        window,
        type,
        ...rest
      );
    }) as typeof window.addEventListener;
    try {
      new Function(scriptText())();
    } finally {
      window.addEventListener = original;
    }
    return listeners.includes('load');
  };

  it('arms on a tab that has never recovered', () => {
    // The positive control. Without it every assertion below passes just as well
    // against a script that never arms at all.
    expect(armsAfter(null)).toBe(true);
  });

  it('cannot loop — it stays disarmed right after a recovery', () => {
    // A reload loop is strictly worse than an unstyled page, so this is the single
    // most important property of the script.
    expect(armsAfter(String(Date.now()))).toBe(false);
  });

  it('re-arms an hour after the last recovery (#752)', () => {
    // It used to be once per tab forever, which stranded exactly the long-lived
    // tabs this guard exists for.
    expect(armsAfter(String(Date.now() - 2 * 3600_000))).toBe(true);
  });

  it('records the recovery time, not a boolean', () => {
    const s = scriptText();
    expect(s).toContain('sh-stylesheet-recovered');
    expect(s).toContain('sessionStorage.setItem(KEY, String(Date.now()))');
  });

  it('waits for load, not DOMContentLoaded', () => {
    // At DOMContentLoaded a stylesheet may still be in flight and would read as
    // missing, turning a slow network into a reload.
    expect(codeOnly()).toContain("addEventListener('load'");
    expect(codeOnly()).not.toContain('DOMContentLoaded');
  });

  it('navigates to a fresh URL rather than calling reload()', () => {
    // location.reload() can re-serve the same cached document, which is exactly
    // what is broken.
    const s = codeOnly();
    expect(s).toContain('location.replace');
    expect(s).not.toMatch(/location\.reload\s*\(/);
  });

  it('decides on empty rule lists, not on styleSheets.length', () => {
    // Inline <style> and framework-injected sheets inflate `.length`, so it is
    // never 0 even when every external sheet is gone. Two earlier detectors could
    // never fire; see the component docblock.
    const s = codeOnly();
    expect(s).toContain('cssRules');
    expect(s).not.toMatch(/document\.styleSheets\.length\s*===?\s*0/);
  });

  it('only recovers when EVERY same-origin sheet is dead', () => {
    // Conservative by design: one dead sheet is not obviously fixed by refetching.
    expect(scriptText()).toContain('empty < external');
  });

  it('is wrapped so a missing sessionStorage cannot break the page', () => {
    const s = scriptText();
    expect(s).toContain('try {');
    expect(s).toContain('catch');
  });
});
